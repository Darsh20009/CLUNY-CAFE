---
name: Online refunds
description: Safe behavior for card refunds sent through payment providers.
---

Do not treat a locally created refund record as proof that money reached the customer's card. Store the verified original provider transaction reference, send the refund through that provider, and only mark it complete after an explicit success response. Use idempotency and reserve both refunded and pending amounts so retries cannot double-refund or exceed the paid amount. If the provider result is ambiguous, keep the refund pending and do not retry automatically.

Paymob's legacy acceptance refund flow uses its merchant API key to obtain an auth token; the newer checkout Secret Key is not interchangeable with that API key.

**Why:** A timeout can happen after the processor accepted a refund, and claiming success or retrying blindly can misstate balances or duplicate financial actions.

**How to apply:** On any online card refund, confirm the original transaction and provider first. Keep processor credentials in the secret store, and require reconciliation when the provider cannot confirm the result.
