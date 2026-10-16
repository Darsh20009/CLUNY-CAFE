---
name: MongoDB Atlas access from Replit
description: Network allowlisting and database-user constraints for this app's Atlas cluster.
---

Replit workspace and deployment outbound IPs are not stable. Allowlisting one observed IP can cause intermittent Atlas connection failures. The user selected Atlas access from any IP paired with a restricted database user; keep that account limited to `readWrite` on the chosen application database, never Atlas-wide administration. Do not infer the database name from the cluster name or URI `appName`.

**Why:** the app has repeatedly lost Atlas connectivity, preventing its data and payment configuration from loading; a broad network rule is only acceptable alongside least-privilege database access.

**How to apply:** when diagnosing Atlas access, check Network Access and the database user's role in Atlas, confirm the actual database name in Browse Collections, and avoid relying on a static Replit egress address. Also check `.replit` for same-named `userenv.shared` entries: a stale inline URI can override the secret value.
