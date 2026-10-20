---
name: Paymob integration IDs
description: Troubleshoot Paymob Saudi Intention API failures caused by card or Apple Pay integration IDs.
---

Use distinct IDs for card payments and Apple Pay, and ensure each ID belongs to the same active Paymob merchant account as the API credentials. A successful API credential check does not mean the configured integration ID is valid. Paymob can accept authentication and then reject the intention with “Integration ID/Name does not exist in our system.”

**Why:** CLUNY's Paymob credentials were accepted while the payment intention failed because the configured integration was not recognized by that merchant account.

**How to apply:** verify the card Payment Integration ID in the active merchant dashboard and set it as `PAYMOB_INTEGRATION_IDS`; keep the Apple Pay integration ID separate. Never substitute the Apple Pay ID for card payments.
