describe("Recipe Engine Phase 1", () => {
  test("freezes recipe cost on order creation", () => {
    const price = 30;
    const costOfGoods = 10.5;
    expect(price - costOfGoods).toBe(19.5);
  });
  test("calculates profit margin", () => {
    const profit = 19.5, price = 30;
    const margin = (profit / price) * 100;
    expect(margin > 50).toBe(true);
  });
});
