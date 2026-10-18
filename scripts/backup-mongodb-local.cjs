#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGzip, createGunzip } = require("node:zlib");
const { MongoClient, BSON } = require("mongodb");

const MAGIC = Buffer.from("CLUNYB01");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const BATCH_SIZE = 1000;
const BACKUP_DIR = path.resolve(process.cwd(), "local-backups");

function deriveEncryptionKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
}

function jsonLine(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

async function getCollectionManifest(db, snapshotSession) {
  const infos = await db.listCollections({}, { nameOnly: false }).toArray();
  const collections = [];

  for (const info of infos) {
    const isView = info.type === "view";
    const collection = db.collection(info.name);
    const count = isView
      ? 0
      : await collection.countDocuments({}, { session: snapshotSession });
    const indexes = isView ? [] : await collection.indexes();

    collections.push({
      name: info.name,
      type: info.type || "collection",
      info,
      options: info.options || {},
      count,
      indexes,
    });
  }

  return collections;
}

async function* bsonRecords(db, manifest, snapshotSession, exportedCounts) {
  const metadata = {
    format: "cluny-mongodb-bson-backup",
    version: 1,
    createdAt: new Date(),
    databaseName: db.databaseName,
    collectionCount: manifest.length,
    documentCount: manifest.reduce((sum, entry) => sum + entry.count, 0),
    collections: manifest,
  };

  yield jsonLine({
    type: "manifest",
    bson: BSON.serialize(metadata).toString("base64"),
  });

  for (const entry of manifest) {
    if (entry.type === "view") continue;

    const cursor = db.collection(entry.name).find({}, {
      batchSize: BATCH_SIZE,
      session: snapshotSession,
    });

    try {
      for await (const document of cursor) {
        exportedCounts[entry.name] = (exportedCounts[entry.name] || 0) + 1;
        yield jsonLine({
          type: "document",
          collection: entry.name,
          bson: BSON.serialize(document).toString("base64"),
        });
      }
    } finally {
      await cursor.close();
    }
  }
}

async function verifyArchive(filePath, passphrase) {
  const stat = await fsp.stat(filePath);
  if (stat.size <= HEADER_BYTES + TAG_BYTES) {
    throw new Error("Backup archive is unexpectedly small.");
  }

  const handle = await fsp.open(filePath, "r");
  let header;
  let tag;
  try {
    header = Buffer.alloc(HEADER_BYTES);
    tag = Buffer.alloc(TAG_BYTES);
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, TAG_BYTES, stat.size - TAG_BYTES);
  } finally {
    await handle.close();
  }

  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Backup archive header is invalid.");
  }

  const saltStart = MAGIC.length;
  const salt = header.subarray(saltStart, saltStart + SALT_BYTES);
  const iv = header.subarray(saltStart + SALT_BYTES);
  const key = deriveEncryptionKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const encrypted = fs.createReadStream(filePath, {
    start: HEADER_BYTES,
    end: stat.size - TAG_BYTES - 1,
  });
  const gunzip = createGunzip();
  const decryptedStream = encrypted.pipe(decipher).pipe(gunzip);
  const lines = readline.createInterface({
    input: decryptedStream,
    crlfDelay: Infinity,
  });

  let metadata = null;
  const counts = Object.create(null);
  let documentCount = 0;
  try {
    for await (const line of lines) {
      if (!line) continue;
      const record = JSON.parse(line);
      if (record.type === "manifest") {
        if (metadata) throw new Error("Backup contains multiple manifests.");
        metadata = BSON.deserialize(Buffer.from(record.bson, "base64"));
        if (metadata.format !== "cluny-mongodb-bson-backup" || metadata.version !== 1) {
          throw new Error("Backup manifest version is unsupported.");
        }
      } else if (record.type === "document") {
        if (!metadata) throw new Error("Backup document appears before manifest.");
        BSON.deserialize(Buffer.from(record.bson, "base64"));
        counts[record.collection] = (counts[record.collection] || 0) + 1;
        documentCount += 1;
      } else {
        throw new Error("Backup contains an unknown record type.");
      }
    }
  } finally {
    lines.close();
  }

  if (!metadata) throw new Error("Backup manifest is missing.");
  if (documentCount !== metadata.documentCount) {
    throw new Error(`Backup document count mismatch: expected ${metadata.documentCount}, read ${documentCount}.`);
  }

  for (const collection of metadata.collections) {
    const actual = counts[collection.name] || 0;
    if (actual !== collection.count) {
      throw new Error(`Backup count mismatch for collection ${collection.name}.`);
    }
  }

  return {
    databaseName: metadata.databaseName,
    collectionCount: metadata.collectionCount,
    documentCount,
    encryptedBytes: stat.size,
  };
}

async function createBackup() {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DATABASE || "test";
  const passphrase = process.env.LOCAL_BACKUP_ENCRYPTION_KEY;
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (!passphrase || passphrase.length < 16) {
    throw new Error("LOCAL_BACKUP_ENCRYPTION_KEY must contain at least 16 characters.");
  }

  await fsp.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  await fsp.chmod(BACKUP_DIR, 0o700);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalPath = path.join(BACKUP_DIR, `cluny-${databaseName}-${stamp}.clunybackup`);
  const temporaryPath = `${finalPath}.partial`;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 20000,
    appName: "cluny-local-encrypted-backup",
  });

  try {
    await client.connect();
    const db = client.db(databaseName);
    const snapshotSession = client.startSession({ snapshot: true });

    try {
      const manifest = await getCollectionManifest(db, snapshotSession);
      const expectedDocuments = manifest.reduce((sum, entry) => sum + entry.count, 0);
      const exportedCounts = Object.create(null);
      const salt = crypto.randomBytes(SALT_BYTES);
      const iv = crypto.randomBytes(IV_BYTES);
      const key = deriveEncryptionKey(passphrase, salt);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const output = fs.createWriteStream(temporaryPath, {
        flags: "wx",
        mode: 0o600,
      });

      try {
        await new Promise((resolve, reject) => {
          output.write(Buffer.concat([MAGIC, salt, iv]), (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        await pipeline(
          Readable.from(bsonRecords(db, manifest, snapshotSession, exportedCounts)),
          createGzip({ level: 9 }),
          cipher,
          output,
        );
        await fsp.appendFile(temporaryPath, cipher.getAuthTag(), { mode: 0o600 });
        await fsp.chmod(temporaryPath, 0o600);

        const verification = await verifyArchive(temporaryPath, passphrase);
        if (
          verification.databaseName !== databaseName ||
          verification.documentCount !== expectedDocuments
        ) {
          throw new Error("Archive verification did not match the source snapshot.");
        }

        for (const entry of manifest) {
          const exported = exportedCounts[entry.name] || 0;
          if (exported !== entry.count) {
            throw new Error(`Export count mismatch for collection ${entry.name}.`);
          }
        }

        await fsp.rename(temporaryPath, finalPath);
        await fsp.chmod(finalPath, 0o600);
        console.log(JSON.stringify({
          result: "verified",
          database: verification.databaseName,
          collections: verification.collectionCount,
          documents: verification.documentCount,
          encryptedBytes: verification.encryptedBytes,
          file: path.relative(process.cwd(), finalPath),
          encrypted: true,
          bsonRoundTripVerified: true,
        }, null, 2));
      } catch (error) {
        output.destroy();
        await fsp.rm(temporaryPath, { force: true });
        throw error;
      }
    } finally {
      await snapshotSession.endSession();
    }
  } finally {
    await client.close();
  }
}

createBackup().catch((error) => {
  console.error(`Local MongoDB backup failed: ${error.message}`);
  process.exitCode = 1;
});
