export interface ProductDiscountRule {
  productId: string;
  discountPercentage: number;
}

export interface CouponDiscountDefinition {
  discountPercentage?: number;
  percentage?: number;
  productDiscounts?: ProductDiscountRule[];
}

export function getCouponProductId(item: any): string {
  const value =
    item?.coffeeItemId ??
    item?.productId ??
    item?.coffeeItem?.id ??
    item?.coffeeItem?._id ??
    item?.id ??
    item?._id;
  return value == null ? "" : String(value);
}

export function calculateCouponDiscount(
  items: any[],
  coupon: CouponDiscountDefinition | null | undefined,
  getUnitPrice: (item: any) => number,
): number {
  if (!coupon || !Array.isArray(items) || items.length === 0) return 0;

  const rules = Array.isArray(coupon.productDiscounts)
    ? coupon.productDiscounts.filter((rule) => rule?.productId)
    : [];
  const rulesByProduct = new Map(
    rules.map((rule) => [String(rule.productId), Number(rule.discountPercentage) || 0]),
  );
  const isScoped = rules.length > 0;

  const amount = items.reduce((sum, item) => {
    const productId = getCouponProductId(item);
    const percentage = isScoped
      ? rulesByProduct.get(productId) ?? 0
      : Number(coupon.discountPercentage ?? coupon.percentage) || 0;
    if (percentage <= 0) return sum;

    const quantity = Math.max(0, Number(item?.quantity) || 0);
    const unitPrice = Math.max(0, Number(getUnitPrice(item)) || 0);
    return sum + unitPrice * quantity * Math.min(percentage, 100) / 100;
  }, 0);

  return Math.round(amount * 100) / 100;
}
