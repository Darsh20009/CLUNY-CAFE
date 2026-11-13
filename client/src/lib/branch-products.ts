type BranchScopedProduct = {
  publishedBranches?: unknown;
  branchAvailability?: unknown;
};

export function isProductAvailableForBranch(
  product: BranchScopedProduct,
  branchId?: string | null,
): boolean {
  if (!branchId) return true;

  const publishedBranches = Array.isArray(product.publishedBranches)
    ? product.publishedBranches.map(String)
    : [];
  if (
    publishedBranches.length > 0 &&
    !publishedBranches.includes("*") &&
    !publishedBranches.includes(branchId)
  ) {
    return false;
  }

  const branchAvailability = Array.isArray(product.branchAvailability)
    ? product.branchAvailability
    : [];
  const branchRule = branchAvailability.find(
    (entry: any) => String(entry?.branchId) === branchId,
  ) as { isAvailable?: unknown } | undefined;

  return !(branchRule && Number(branchRule.isAvailable) === 0);
}

export function filterProductsForBranch<T extends BranchScopedProduct>(
  products: T[] | undefined,
  branchId?: string | null,
): T[] {
  return (products || []).filter((product) =>
    isProductAvailableForBranch(product, branchId),
  );
}
