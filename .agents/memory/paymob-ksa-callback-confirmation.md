---
name: Paymob KSA callback confirmation
description: Reliable server-side confirmation for CLUNY's Saudi Paymob checkout.
---

Only use a Paymob success callback after HMAC validation, and bind it to the initiated payment by merchant reference, transaction ID, amount, currency, and integration. In this project, KSA intention/transaction status lookups returned 404/405 even while a signed transaction webhook reported success. A success webhook may arrive before an order document exists because checkout creates the order after the browser returns.

**Why:** a real Apple Pay transaction reached the authenticated callback, but API polling stayed unverified and the customer return page remained pending.

**How to apply:** use a strictly matched authenticated webhook record as a server-verification fallback; never trust browser return parameters alone. Keep order creation idempotent and verify that the return path handles an authenticated callback even when provider status lookup is unavailable.
