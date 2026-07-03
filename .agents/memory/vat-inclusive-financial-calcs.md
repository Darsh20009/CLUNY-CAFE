---
name: VAT-inclusive figures in financial calculations
description: Recurring bug pattern where order/menu totals (VAT-inclusive) were used directly as revenue in profit/margin math, inflating results. Check this whenever touching accounting/analytics code.
---

`order.totalAmount`, `order.total`, `order.subtotal`, and `item.price` are always stored VAT-inclusive (Saudi VAT, currently 15%, `VAT_RATE = 0.15`). Multiple independent profit/margin calculations across the codebase subtracted COGS directly from these VAT-inclusive figures without excluding VAT first, systematically inflating profit margins.

**Why:** VAT collected is a liability owed to ZATCA, not revenue — mixing it into revenue before subtracting COGS overstates gross profit/margin. This was found duplicated independently in the COGS analytics endpoint, the operational `AccountingEngine` (daily snapshot, profit-per-drink, profit-per-category), an inventory dashboard gross-margin stat, and the ERP income statement's order-based fallback path.

**How to apply:** Whenever adding or auditing a financial calculation that compares revenue against COGS/expenses, check whether the revenue figure originates from `order.totalAmount`/`total`/`subtotal`/`item.price` (VAT-inclusive) vs. from journal entries booked against account 4100 (already VAT-excluded, since VAT is posted separately to 2120). If it's the former, divide by `(1 + VAT_RATE)` before computing profit/margin. Two calculations that are meant to reconcile (e.g. a journal-based calc and its order-based fallback) must both apply this consistently or they'll disagree.

Note: `RecipeEngine.calculateOrderCOGS` / `createOrderItemCostSnapshot` / `calculateProfit` in `server/recipe-engine.ts` have this same bug but are dead code (unused, not called anywhere) as of July 2026 — left unfixed but worth revisiting if they're ever wired up.
