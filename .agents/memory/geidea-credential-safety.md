---
name: Geidea credential safety
description: How startup configuration must handle Geidea merchant credentials.
---

Never embed Geidea merchant credentials or Apple Pay Merchant Identity private keys in source-controlled files, and never use hardcoded fallback credentials to seed the database. When secure environment credentials are absent, leave existing admin payment settings unchanged. Credentials or certificates that were embedded in source must be rotated before reuse. CLUNY's active Geidea credentials are for live Saudi production; use `https://api.ksamerchant.geidea.net`.

Payment credential syncing must not silently change the selected gateway. Select the provider explicitly, and never hardcode merchant integration IDs; require IDs from the merchant's own account.

**Why:** startup seeding can overwrite real merchant settings with invalid values, and source-controlled payment credentials or certificate keys are exposed to anyone with repository access. A hardcoded integration ID can route checkout to the wrong merchant setup. The user confirmed Geidea credentials are production/live.

**How to apply:** sync Geidea credentials only when explicitly configured in Replit Secrets, preserve an existing provider selection, keep the Apple Pay merchant certificate in the secure secret flow, and load Paymob integration IDs from merchant configuration. Verify database connectivity and merchant configuration before testing checkout. Never run a real charge as a diagnostic without the user's approval.
