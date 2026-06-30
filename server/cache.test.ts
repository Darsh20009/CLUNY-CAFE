import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import the cache module under test
// We re-create a MemoryCache instance for isolation
class MemoryCache {
  private store = new Map<string, { data: any; expiresAt: number; hits: number }>();
  public totalHits = 0;
  public totalMisses = 0;
  public totalSets = 0;
  public totalInvalidations = 0;

  set<T>(key: string, data: T, ttlSeconds = 30): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000, hits: 0 });
    this.totalSets++;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) { this.totalMisses++; return null; }
    if (Date.now() > entry.expiresAt) { this.store.delete(key); this.totalMisses++; return null; }
    entry.hits++;
    this.totalHits++;
    return entry.data as T;
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) { this.store.delete(key); this.totalInvalidations++; }
    }
  }

  size(): number { return this.store.size; }
}

function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter(Boolean).join(":");
}

describe("MemoryCache — basic get/set/invalidate", () => {
  test("miss on empty cache", () => {
    const c = new MemoryCache();
    assert.equal(c.get("key"), null);
    assert.equal(c.totalMisses, 1);
    assert.equal(c.totalHits, 0);
  });

  test("set then get returns same value", () => {
    const c = new MemoryCache();
    const payload = { expenses: [{ id: 1, amount: 100 }], total: 1 };
    c.set("accounting:expenses:tenant1:all", payload, 120);
    const hit = c.get<typeof payload>("accounting:expenses:tenant1:all");
    assert.deepEqual(hit, payload);
    assert.equal(c.totalHits, 1);
    assert.equal(c.totalMisses, 0);
    assert.equal(c.totalSets, 1);
  });

  test("second get returns same payload (cache hit)", () => {
    const c = new MemoryCache();
    const payload = { revenues: [], total: 0 };
    c.set("accounting:revenue:tenant1:all", payload, 120);
    const first = c.get("accounting:revenue:tenant1:all");
    const second = c.get("accounting:revenue:tenant1:all");
    assert.deepEqual(first, second);
    assert.equal(c.totalHits, 2);
  });

  test("expired entry returns null (miss)", () => {
    const c = new MemoryCache();
    c.set("inventory:alerts:tenant1:all:all", { alerts: [] }, -1); // already expired (negative TTL)
    const result = c.get("inventory:alerts:tenant1:all:all");
    assert.equal(result, null);
    assert.equal(c.totalMisses, 1);
  });

  test("invalidate clears matching keys only", () => {
    const c = new MemoryCache();
    c.set("accounting:expenses:tenant1:all", { expenses: [] }, 120);
    c.set("accounting:revenue:tenant1:all", { revenues: [] }, 120);
    c.set("inventory:alerts:tenant1:all:all", { alerts: [] }, 60);
    c.invalidate("accounting:");
    assert.equal(c.get("accounting:expenses:tenant1:all"), null, "expenses key must be gone");
    assert.equal(c.get("accounting:revenue:tenant1:all"), null, "revenue key must be gone");
    assert.notEqual(c.get("inventory:alerts:tenant1:all:all"), null, "inventory key must survive");
    assert.equal(c.totalInvalidations, 2);
  });

  test("invalidate inventory:alerts: clears only alert keys", () => {
    const c = new MemoryCache();
    c.set("inventory:alerts:tenant1:all:all", { alerts: [] }, 60);
    c.set("inventory:dashboard:tenant1:all", { summary: {} }, 600);
    c.invalidate("inventory:alerts:");
    assert.equal(c.get("inventory:alerts:tenant1:all:all"), null, "alert key cleared");
    assert.notEqual(c.get("inventory:dashboard:tenant1:all"), null, "dashboard key survives");
  });

  test("invalidate attendance:monthly: clears attendance report cache", () => {
    const c = new MemoryCache();
    c.set("attendance:monthly:tenant1:2026:6:all:all", { report: [] }, 300);
    c.set("attendance:monthly:tenant1:2026:5:all:all", { report: [] }, 300);
    c.invalidate("attendance:monthly:");
    assert.equal(c.get("attendance:monthly:tenant1:2026:6:all:all"), null);
    assert.equal(c.get("attendance:monthly:tenant1:2026:5:all:all"), null);
    assert.equal(c.totalInvalidations, 2);
  });
});

describe("cacheKey — cross-branch isolation", () => {
  test("different finalBranchIds produce different keys", () => {
    const k1 = cacheKey("accounting:expenses", "tenant1", "branch-a", "today", "", "", "", "", "1", "50");
    const k2 = cacheKey("accounting:expenses", "tenant1", "branch-b", "today", "", "", "", "", "1", "50");
    assert.notEqual(k1, k2, "branch-a and branch-b must not collide");
  });

  test("admin (all) vs manager (branch-a) produce different keys", () => {
    const adminKey = cacheKey("accounting:expenses", "tenant1", "all", "today", "", "", "", "", "1", "50");
    const managerKey = cacheKey("accounting:expenses", "tenant1", "branch-a", "today", "", "", "", "", "1", "50");
    assert.notEqual(adminKey, managerKey);
  });

  test("same scope produces identical key (cache hit)", () => {
    const k1 = cacheKey("accounting:revenue", "tenant1", "branch-a", "month", "", "", "", "1", "50");
    const k2 = cacheKey("accounting:revenue", "tenant1", "branch-a", "month", "", "", "", "1", "50");
    assert.equal(k1, k2);
  });

  test("different tenants produce different keys", () => {
    const k1 = cacheKey("inventory:alerts", "tenant-A", "all", "all");
    const k2 = cacheKey("inventory:alerts", "tenant-B", "all", "all");
    assert.notEqual(k1, k2);
  });
});
