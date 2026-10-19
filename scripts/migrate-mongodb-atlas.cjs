const crypto = require("node:crypto");
const { MongoClient, BSON } = require("mongodb");

const BATCH_SIZE = 1000;
const DB_NAME = process.env.MONGODB_DATABASE || "test";
const SOURCE_DB_NAME = process.env.MONGODB_SOURCE_DATABASE || DB_NAME;
const RESUME = process.argv.includes("--resume");

function safeError(error) {
  const result = {
    name: error?.name || "Error",
    code: error?.code,
    codeName: error?.codeName,
  };
  if (error?.name === "Error" && error.message) {
    result.reason = error.message.slice(0, 180);
  }
  return result;
}

function makeClient(uri) {
  return new MongoClient(uri, {
    appName: "cluny-atlas-migration",
    maxPoolSize: 1,
    minPoolSize: 0,
    maxConnecting: 1,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 120000,
    retryReads: true,
    retryWrites: true,
  });
}

function uriHost(uri) {
  return new URL(uri).host.toLowerCase();
}

function documentDigestAdd(total, document) {
  const hash = crypto
    .createHash("sha256")
    .update(BSON.serialize(document))
    .digest();
  let carry = 0;
  for (let i = total.length - 1; i >= 0; i--) {
    const value = total[i] + hash[i] + carry;
    total[i] = value & 0xff;
    carry = value >>> 8;
  }
}

function documentDigestHex(total) {
  return total.toString("hex");
}

function collectionOptions(info) {
  const options = { ...(info.options || {}) };
  delete options.uuid;
  delete options.idIndex;
  delete options.viewOn;
  delete options.pipeline;
  return options;
}

function normalizedIndex(index) {
  const copy = { ...index };
  delete copy.ns;
  delete copy.v;
  delete copy.background;
  delete copy.ready;
  return JSON.stringify(copy);
}

async function ensureCollection(sourceDb, targetDb, info, targetNames) {
  if (targetNames.has(info.name)) return targetDb.collection(info.name);
  await targetDb.createCollection(info.name, collectionOptions(info));
  targetNames.add(info.name);
  return targetDb.collection(info.name);
}

async function copyCollection(sourceClient, sourceDb, targetDb, info, targetNames) {
  if (info.type !== "collection") {
    throw new Error(`Unsupported collection type: ${info.type}`);
  }

  const sourceCollection = sourceDb.collection(info.name);
  const targetCollectionAlreadyExisted = targetNames.has(info.name);
  const targetCollection = await ensureCollection(
    sourceDb,
    targetDb,
    info,
    targetNames,
  );
  const sourceIndexes = await sourceCollection.listIndexes().toArray();
  if (targetCollectionAlreadyExisted) {
    // The destination may be a partial run with active TTL indexes. Drop its
    // non-_id indexes during reconciliation so TTL cannot delete copied
    // snapshot records before the content check. The source indexes are
    // recreated after the check succeeds.
    const existingIndexes = await targetCollection.listIndexes().toArray();
    if (existingIndexes.some((index) => index.name !== "_id_")) {
      await targetCollection.dropIndexes();
    }
  }
  const digest = Buffer.alloc(32);
  const sourceIds = new Set();
  let copied = 0;
  let batch = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    await targetCollection.bulkWrite(
      batch.map((document) => ({
        replaceOne: {
          filter: { _id: document._id },
          replacement: document,
          upsert: true,
        },
      })),
      { ordered: false },
    );
    batch = [];
  };

  // Stream in stable _id order. A long snapshot session can outlive Atlas's
  // snapshot-history window on a large collection; the destination is
  // reconciled against exactly the documents observed by this cursor.
  const cursor = sourceCollection.find(
    {},
    { batchSize: BATCH_SIZE, noCursorTimeout: true, sort: { _id: 1 } },
  );
  try {
    for await (const document of cursor) {
      if (document._id === undefined) {
        throw new Error(`Document without _id in ${info.name}`);
      }
      documentDigestAdd(digest, document);
      sourceIds.add(BSON.serialize({ _id: document._id }).toString("base64"));
      batch.push(document);
      copied++;
      if (batch.length >= BATCH_SIZE) await flushBatch();
    }
    await flushBatch();
  } finally {
    await cursor.close().catch(() => {});
  }

  // The source remains writable during this migration. Remove only destination
  // documents whose _id is no longer present in the source snapshot, so TTL
  // expiry/deletions cannot leave stale records behind on a resumed copy.
  let staleIds = [];
  let removedStale = 0;
  const removeStale = async () => {
    if (staleIds.length === 0) return;
    const result = await targetCollection.deleteMany({ _id: { $in: staleIds } });
    removedStale += result.deletedCount || 0;
    staleIds = [];
  };
  const existingTargetIds = targetCollection.find(
    {},
    { projection: { _id: 1 }, batchSize: BATCH_SIZE },
  );
  for await (const targetDocument of existingTargetIds) {
    const key = BSON.serialize({ _id: targetDocument._id }).toString("base64");
    if (!sourceIds.has(key)) {
      staleIds.push(targetDocument._id);
      if (staleIds.length >= BATCH_SIZE) await removeStale();
    }
  }
  await removeStale();

  const targetDigest = Buffer.alloc(32);
  let targetCount = 0;
  const targetCursor = targetCollection.find({}, { batchSize: BATCH_SIZE });
  for await (const document of targetCursor) {
    documentDigestAdd(targetDigest, document);
    targetCount++;
  }

  const contentMatches =
    copied === targetCount &&
    documentDigestHex(digest) === documentDigestHex(targetDigest);

  if (!contentMatches) {
    throw new Error(`Content verification failed for ${info.name}.`);
  }

  const indexesToCreate = sourceIndexes
    .filter((index) => index.name !== "_id_")
    .map((index) => {
      const spec = { ...index };
      delete spec.ns;
      delete spec.v;
      delete spec.background;
      delete spec.ready;
      return spec;
    });
  if (indexesToCreate.length > 0) {
    await targetCollection.createIndexes(indexesToCreate);
  }

  const targetIndexes = await targetCollection.listIndexes().toArray();
  const sourceIndexSet = sourceIndexes.map(normalizedIndex).sort();
  const targetIndexSet = targetIndexes.map(normalizedIndex).sort();
  const indexesMatch =
    sourceIndexSet.length === targetIndexSet.length &&
    sourceIndexSet.every((value, index) => value === targetIndexSet[index]);
  if (!indexesMatch) {
    throw new Error(`Index verification failed for ${info.name}.`);
  }

  return {
    collection: info.name,
    documents: copied,
    indexes: sourceIndexes.length,
    staleDocumentsRemoved: removedStale,
  };
}

async function main() {
  const sourceUri = process.env.MONGODB_SOURCE_URI;
  const targetUri = process.env.MONGODB_URI;
  if (!sourceUri || !targetUri) {
    throw new Error("MONGODB_SOURCE_URI and MONGODB_URI are required.");
  }
  if (uriHost(sourceUri) === uriHost(targetUri) && SOURCE_DB_NAME === DB_NAME) {
    throw new Error("Source and destination resolve to the same cluster/database.");
  }

  const sourceClient = makeClient(sourceUri);
  const targetClient = makeClient(targetUri);
  try {
    await Promise.all([sourceClient.connect(), targetClient.connect()]);
    const sourceDb = sourceClient.db(SOURCE_DB_NAME);
    const targetDb = targetClient.db(DB_NAME);

    const sourceInfo = await sourceDb
      .listCollections({}, { nameOnly: false })
      .toArray();
    const sourceCollections = sourceInfo.filter(
      (info) => !info.name.startsWith("system."),
    );
    const targetInfo = await targetDb
      .listCollections({}, { nameOnly: true })
      .toArray();
    const targetNames = new Set(targetInfo.map((info) => info.name));
    const sourceNames = new Set(sourceCollections.map((info) => info.name));

    const unexpectedTargetCollections = [...targetNames].filter(
      (name) => !sourceNames.has(name),
    );
    if (unexpectedTargetCollections.length > 0) {
      throw new Error(
        `Destination contains collections not present in source (${unexpectedTargetCollections.length}); refusing to proceed.`,
      );
    }
    if (targetNames.size > 0 && !RESUME) {
      throw new Error(
        "Destination is not empty. Inspect it, then rerun with --resume only if it contains a partial copy from this migration.",
      );
    }

    const views = sourceCollections.filter((info) => info.type === "view");
    const collections = sourceCollections.filter(
      (info) => info.type !== "view",
    );
    if (views.length > 0) {
      throw new Error(
        `Source has ${views.length} view(s); this migration path expects collection data only.`,
      );
    }

    const results = [];
    for (let i = 0; i < collections.length; i++) {
      const result = await copyCollection(
        sourceClient,
        sourceDb,
        targetDb,
        collections[i],
        targetNames,
      );
      results.push(result);
      console.log(
        JSON.stringify({
          progress: i + 1,
          totalCollections: collections.length,
          collection: result.collection,
          documents: result.documents,
          indexes: result.indexes,
          staleDocumentsRemoved: result.staleDocumentsRemoved,
        }),
      );
    }

    const totalDocuments = results.reduce(
      (sum, result) => sum + result.documents,
      0,
    );
    console.log(
      JSON.stringify({
        result: "verified",
        sourceDatabase: SOURCE_DB_NAME,
        destinationDatabase: DB_NAME,
        collections: results.length,
        documents: totalDocuments,
        contentAndIndexesVerified: true,
        sourceMayHaveChangedDuringCopy: true,
      }),
    );
  } finally {
    await Promise.all([
      sourceClient.close().catch(() => {}),
      targetClient.close().catch(() => {}),
    ]);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "failed", ...safeError(error) }));
  process.exitCode = 1;
});
