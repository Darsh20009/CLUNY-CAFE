import assert from "node:assert/strict";
import { test } from "node:test";
import { filterProductsForBranch, isProductAvailableForBranch } from "../client/src/lib/branch-products";

test("products without branch restrictions remain available to both branches", () => {
  const product = { id: "global", publishedBranches: [], branchAvailability: [] };
  assert.equal(isProductAvailableForBranch(product, "branch-a"), true);
  assert.equal(isProductAvailableForBranch(product, "branch-b"), true);
});

test("branch publication hides a product from other branches", () => {
  const product = { id: "branch-a-only", publishedBranches: ["branch-a"] };
  assert.equal(isProductAvailableForBranch(product, "branch-a"), true);
  assert.equal(isProductAvailableForBranch(product, "branch-b"), false);
});

test("unavailable overrides apply only to the selected branch", () => {
  const product = {
    id: "branch-limited",
    branchAvailability: [
      { branchId: "branch-a", isAvailable: 0 },
      { branchId: "branch-b", isAvailable: 1 },
    ],
  };
  assert.equal(isProductAvailableForBranch(product, "branch-a"), false);
  assert.equal(isProductAvailableForBranch(product, "branch-b"), true);
});

test("wildcard publication includes every branch", () => {
  const product = { id: "all-branches", publishedBranches: ["*"] };
  assert.equal(isProductAvailableForBranch(product, "branch-a"), true);
  assert.equal(isProductAvailableForBranch(product, "branch-b"), true);
});

test("missing branch context does not hide products", () => {
  const product = { id: "unassigned", publishedBranches: ["branch-a"] };
  assert.equal(isProductAvailableForBranch(product), true);
});

test("filterProductsForBranch returns only products visible at that branch", () => {
  const products = [
    { id: "global", publishedBranches: [] },
    { id: "branch-a", publishedBranches: ["branch-a"] },
  ];
  assert.deepEqual(filterProductsForBranch(products, "branch-a").map((item) => item.id), ["global", "branch-a"]);
  assert.deepEqual(filterProductsForBranch(products, "branch-b").map((item) => item.id), ["global"]);
});
