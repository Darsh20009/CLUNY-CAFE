---
name: Payment confirmation security
description: Verify online payments and authenticate provider callbacks before marking orders paid.
---

Never treat a browser redirect, query-string success flag, or client-provided provider name as proof of payment. Bind the payment session to the active server-selected provider and verify transaction status, amount, and merchant integration with the provider's server API before creating a paid order. Reject webhook events when the configured HMAC is missing or invalid and compare signatures in constant time.

**Why:** an unauthenticated client can forge redirect parameters; accepting them can create unpaid orders or falsify revenue. A missing webhook signature must not bypass verification.

**How to apply:** use provider-side transaction/intention lookups in every return path, store provider choice with the one-time payment token, and require a valid HMAC before processing payment webhooks.
