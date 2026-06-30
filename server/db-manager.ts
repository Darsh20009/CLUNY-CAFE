/**
 * Multi-Database Manager
 *
 * Supports unlimited databases via:
 *   MONGODB_URI      — First / primary DB (required)
 *   MONGODB_URI_2    — Second DB
 *   MONGODB_URI_3    — Third DB  (and so on, auto-discovered)
 *
 * Rotation strategy:
 *   1. Startup: connects all configured DBs as standbys.
 *   2. Monitor: checks active DB storage every CHECK_INTERVAL_MS.
 *   3. When storage >= STORAGE_LIMIT_MB, promotes next standby.
 *   4. Previous DBs kept alive as read-only archives.
 *   5. Storage quota errors also trigger immediate rotation.
 *
 * Adding capacity: add MONGODB_URI_3, MONGODB_URI_4 … to secrets. No code changes needed.
 */

import mongoose, { Connection } from "mongoose";

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Rotate to next DB when active DB storage reaches this many MB (Atlas M0 free = 512 MB) */
const STORAGE_LIMIT_MB = 450;

/** Alert admin when storage crosses this percentage of the limit */
const ALERT_THRESHOLD_PCT = 80;

/** How often to check storage (ms) */
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * When true, server/index.ts auto-reconnect must NOT fire — a controlled switch
 * is in progress. Use getIsControlledSwitch() to read the current value.
 */
let _isControlledSwitch = false;
export function getIsControlledSwitch(): boolean { return _isControlledSwitch; }

const MONGO_OPTS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 2,
  connectTimeoutMS: 10000,
};

// ─── Discover all configured DB URIs ─────────────────────────────────────────

function discoverUris(): string[] {
  const uris: string[] = [];
  const primary = process.env.MONGODB_URI;
  if (primary) uris.push(primary);

  for (let idx = 2; idx <= 20; idx++) {
    const uri = process.env[`MONGODB_URI_${idx}`];
    if (!uri) break;
    uris.push(uri);
  }
  return uris;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface DbSlot {
  uri: string;
  label: string;
  conn: Connection | null;
  status: "standby" | "active" | "archive" | "failed";
  storageMb: number;
  docCount: number;
  connectedAt: Date | null;
  /** True after the 80% alert has fired; reset on DB rotation so it can fire again for the new DB */
  alertSent: boolean;
}

let slots: DbSlot[] = [];
let activeIndex = 0;
let switchInProgress = false;
let monitorTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function makeLabel(idx: number): string {
  return idx === 0 ? "DB1 (MONGODB_URI)" : `DB${idx + 1} (MONGODB_URI_${idx + 1})`;
}

// ─── Storage check (uses dbStats command) ────────────────────────────────────

async function getStorageMb(db: mongoose.mongo.Db | null): Promise<number> {
  if (!db) return 0;
  try {
    const stats = await db.command({ dbStats: 1, scale: 1048576 }); // scale to MB
    return typeof stats?.storageSize === "number" ? stats.storageSize : 0;
  } catch (_) {
    return 0;
  }
}

async function getDocCount(db: mongoose.mongo.Db | null): Promise<number> {
  if (!db) return 0;
  try {
    const cols = await db.listCollections().toArray();
    let total = 0;
    await Promise.all(
      cols.map(async (c) => {
        try { total += await db.collection(c.name).estimatedDocumentCount(); } catch (_) {}
      })
    );
    return total;
  } catch (_) {
    return 0;
  }
}

// ─── Standby connection helpers ───────────────────────────────────────────────

async function connectStandby(idx: number): Promise<void> {
  const slot = slots[idx];
  if (!slot) return;

  // Close any stale connection first
  if (slot.conn && slot.conn.readyState !== 0) {
    await slot.conn.close().catch(() => {});
  }

  const conn = mongoose.createConnection(slot.uri, MONGO_OPTS);
  await conn.asPromise();
  slot.conn = conn;
  slot.connectedAt = new Date();
  slot.status = "standby";

  conn.on("error", (err) => {
    console.error(`📡 [MultiDB] ${slot.label} error:`, err.message);
  });

  conn.on("disconnected", () => {
    if (slot.status === "standby" || slot.status === "archive") {
      console.warn(`📡 [MultiDB] ${slot.label} disconnected — reconnecting…`);
      setTimeout(() => connectStandby(idx).catch(() => {}), 5000);
    }
  });
}

// ─── Initialization ───────────────────────────────────────────────────────────

export async function initMultiDb(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const uris = discoverUris();
  console.log(`🗄️  [MultiDB] Discovered ${uris.length} database(s)`);

  slots = uris.map((uri, i) => ({
    uri,
    label: makeLabel(i),
    conn: null,
    status: i === 0 ? "active" : "standby",
    storageMb: 0,
    docCount: 0,
    connectedAt: i === 0 ? new Date() : null,
    alertSent: false,
  }));

  // Connect standbys in the background — non-blocking
  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    connectStandby(i)
      .then(() => console.log(`✅ [MultiDB] ${slot.label} connected and standing by`))
      .catch((err) => {
        console.error(`⚠️  [MultiDB] ${slot.label} connection failed:`, err.message);
        slot.status = "failed";
      });
  }

  if (uris.length > 1) {
    startMonitor();
  } else {
    console.log("ℹ️  [MultiDB] Single DB mode — add MONGODB_URI_2 to enable auto-rotation");
  }
}

// ─── Legacy compat: called from server/index.ts ───────────────────────────────
export const initSecondaryConnection = initMultiDb;

// ─── Monitor ──────────────────────────────────────────────────────────────────

function startMonitor(): void {
  if (monitorTimer) return;
  console.log(`📊 [MultiDB] Storage monitor started — rotate at ${STORAGE_LIMIT_MB} MB`);

  // Run first check after 30s so DB is fully warm
  setTimeout(runCheck, 30_000);

  monitorTimer = setInterval(runCheck, CHECK_INTERVAL_MS);
}

async function runCheck(): Promise<void> {
  if (switchInProgress || activeIndex >= slots.length) return;

  const db = mongoose.connection.db ?? null;
  const storageMb = await getStorageMb(db);
  const docCount  = await getDocCount(db);

  const slot = slots[activeIndex];
  if (slot) { slot.storageMb = storageMb; slot.docCount = docCount; }

  const pct = STORAGE_LIMIT_MB > 0 ? Math.round((storageMb / STORAGE_LIMIT_MB) * 100) : 0;
  console.log(
    `📊 [MultiDB] ${slot?.label}: ${storageMb.toFixed(1)} MB / ${STORAGE_LIMIT_MB} MB` +
    ` (${pct}%) — ${docCount.toLocaleString()} docs`
  );

  // ─── 80% threshold alert (fires once per threshold crossing) ──────────────
  if (slot && !slot.alertSent && pct >= ALERT_THRESHOLD_PCT) {
    slot.alertSent = true;
    console.warn(
      `🔔 [MultiDB] ${slot.label} crossed ${ALERT_THRESHOLD_PCT}% storage threshold` +
      ` (${storageMb.toFixed(1)} MB / ${STORAGE_LIMIT_MB} MB) — sending alert`
    );
    // Fire alerts asynchronously so they don't block rotation logic
    sendStorageAlert(slot.label, storageMb, STORAGE_LIMIT_MB).catch(() => {});
  }

  if (storageMb >= STORAGE_LIMIT_MB) {
    console.warn(`⚠️  [MultiDB] ${slot?.label} reached ${storageMb.toFixed(1)} MB — rotating`);
    await rotatePrimary();
  }
}

async function sendStorageAlert(dbLabel: string, usedMb: number, limitMb: number): Promise<void> {
  const pct = Math.round((usedMb / limitMb) * 100);
  const title = `⚠️ تنبيه تخزين: ${dbLabel}`;
  const body  = `المساحة المستخدمة: ${usedMb.toFixed(1)} MB من ${limitMb} MB (${pct}%) — الرجاء إضافة قاعدة بيانات احتياطية`;

  try {
    const { fireNotifyAdmins } = await import("./notification-engine");
    await fireNotifyAdmins(title, body, {
      type: "warning",
      icon: "🗄️",
      link: "/qirox",
      tag: `db-storage-alert-${dbLabel}`,
    });
  } catch (err: any) {
    console.warn("[MultiDB] Admin push notification failed:", err.message);
  }

  try {
    const { sendDbStorageAlertEmail } = await import("./mail-service");
    await sendDbStorageAlertEmail(dbLabel, usedMb, limitMb);
  } catch (err: any) {
    console.warn("[MultiDB] Admin email alert failed:", err.message);
  }
}

// ─── Rotation ─────────────────────────────────────────────────────────────────

export async function rotatePrimary(): Promise<boolean> {
  if (switchInProgress) {
    console.warn("⚠️  [MultiDB] Rotation already in progress");
    return false;
  }

  const nextIdx = slots.findIndex((s, i) => i > activeIndex && s.status === "standby");
  if (nextIdx === -1) {
    console.error(
      "❌ [MultiDB] No standby DB available. Add MONGODB_URI_" + (slots.length + 1) + " to secrets."
    );
    return false;
  }

  switchInProgress = true;
  _isControlledSwitch = true; // prevent server/index.ts from auto-reconnecting to URI_1

  const fromSlot = slots[activeIndex];
  const toSlot   = slots[nextIdx];

  try {
    console.log(`🔄 [MultiDB] Rotating ${fromSlot?.label} → ${toSlot?.label}`);

    // Ensure next standby is connected
    if (!toSlot.conn || toSlot.conn.readyState !== 1) {
      console.log(`🔌 [MultiDB] Connecting ${toSlot.label}…`);
      await connectStandby(nextIdx);
    }

    // Gracefully disconnect current primary
    await mongoose.disconnect();

    // Reconnect default connection to next DB
    await mongoose.connect(toSlot.uri, MONGO_OPTS);

    // Update state
    if (fromSlot) fromSlot.status = "archive";
    toSlot.status    = "active";
    toSlot.conn      = null; // now managed by default connection
    toSlot.alertSent = false; // allow fresh alert for the new active DB
    activeIndex      = nextIdx;

    // Restart monitor if more standbys exist
    if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
    if (slots.some((s) => s.status === "standby")) startMonitor();

    console.log(`✅ [MultiDB] Active DB: ${toSlot.label}`);
    console.log(`📦 [MultiDB] ${fromSlot?.label} kept as archive (read-only)`);
    return true;
  } catch (err: any) {
    console.error("❌ [MultiDB] Rotation failed:", err.message);
    // Recover original connection
    try { await mongoose.connect(fromSlot!.uri, MONGO_OPTS); } catch (_) {}
    return false;
  } finally {
    switchInProgress    = false;
    _isControlledSwitch = false;
  }
}

// ─── Storage Quota Error Detection ───────────────────────────────────────────

export function isStorageQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err.code ?? err.errorLabels?.[0];
  const msg: string = (err.message ?? err.errmsg ?? "").toLowerCase();
  if (code === 8000 || code === 13297) return true;
  if (
    msg.includes("disk full") || msg.includes("quota") ||
    msg.includes("storage limit") || msg.includes("exceeded storage") ||
    (msg.includes("exceededtimelimit") && msg.includes("disk"))
  ) return true;
  if (msg.includes("not enough space") || msg.includes("storageexceeded")) return true;
  return false;
}

/** Wrap a write with reactive failover on storage quota errors */
export async function withFailover<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    if (isStorageQuotaError(err) && slots.some((s) => s.status === "standby")) {
      console.warn("⚠️  [MultiDB] Quota error on write — emergency rotation");
      const rotated = await rotatePrimary();
      if (rotated) return await operation();
    }
    throw err;
  }
}

// ─── Archive Reads ────────────────────────────────────────────────────────────

export async function findInArchive<T = any>(
  modelName: string,
  schema: mongoose.Schema,
  query: Record<string, any>
): Promise<T | null> {
  const archives = slots.filter((s) => s.status === "archive" && s.conn?.readyState === 1);
  for (const slot of archives) {
    try {
      let Model: mongoose.Model<any>;
      try { Model = slot.conn!.model(modelName); }
      catch { Model = slot.conn!.model(modelName, schema); }
      const doc = await Model.findOne(query).lean() as T | null;
      if (doc) return doc;
    } catch (err: any) {
      console.warn(`[MultiDB] Archive read error (${slot.label}):`, err.message);
    }
  }
  return null;
}

export { findInArchive as findInArchives };

// ─── Public status API ────────────────────────────────────────────────────────

export function hasSecondaryDb(): boolean    { return slots.length > 1; }
export function isUsingSecondaryDb(): boolean { return activeIndex > 0; }
export function hasStandbyDb(): boolean       { return slots.some((s) => s.status === "standby"); }
export function getTotalDbCount(): number      { return slots.length; }
export function getActivePrimaryLabel(): string { return slots[activeIndex]?.label ?? "DB1"; }

export function getDbStatus() {
  const active = slots[activeIndex];
  return {
    totalDbs:       slots.length,
    activeDb:       active?.label ?? "unknown",
    failoverActive: activeIndex > 0,
    storageLimitMb: STORAGE_LIMIT_MB,
    currentStorageMb: active?.storageMb ?? 0,
    storageUsagePct: active?.storageMb
      ? Math.round((active.storageMb / STORAGE_LIMIT_MB) * 100)
      : 0,
    currentDocCount: active?.docCount ?? 0,
    dbs: slots.map((s, i) => ({
      label:        s.label,
      status:       s.status,
      storageMb:    s.storageMb,
      docCount:     s.docCount,
      connectedAt:  s.connectedAt,
      alertSent:    s.alertSent,
      ready:
        i === activeIndex
          ? mongoose.connection.readyState === 1
          : s.conn?.readyState === 1,
    })),
  };
}

// Legacy alias
export const switchPrimaryToSecondary = rotatePrimary;
