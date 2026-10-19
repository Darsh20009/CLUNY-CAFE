---
name: MongoDB Atlas migration with TTL data
description: Preserve expiring records and verify large live collection copies between Atlas clusters.
---

For collection copies, keep destination TTL indexes disabled until the documents have been copied and verified, then recreate the source indexes. A destination TTL monitor can delete records during verification. Avoid relying on one snapshot session for a long-running collection: Atlas snapshot history can expire before the copy finishes.

**Why:** during a CLUNY Atlas migration, active TTL indexes caused destination counts to drift, and a long snapshot read failed with `SnapshotTooOld`.

**How to apply:** use a resumable, ID-based stream; reconcile destination IDs against the source read; verify content before recreating TTL indexes. If the source stays writable, communicate that writes occurring after each collection is read may remain only on the source.
