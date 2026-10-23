---
name: MongoDB Atlas migration with TTL data
description: Preserve expiring records and verify large live collection copies between Atlas clusters.
---

For collection copies, keep destination TTL indexes disabled until the documents have been copied and verified, then recreate the source indexes. A destination TTL monitor can delete records during verification. Avoid relying on one snapshot session for a long-running collection: Atlas snapshot history can expire before the copy finishes.

Do not use the migration script's `--resume` reconciliation mode on a populated live destination unless the user explicitly approves source-wins replacement and deletion. It replaces same-`_id` documents and removes destination documents absent from the source. When both clusters contain current data, prefer an insert-only merge for missing IDs, check secondary unique indexes first, and leave same-ID conflicts untouched until their policy is approved.

**Why:** during CLUNY Atlas migrations, active TTL indexes caused destination counts to drift and a long snapshot read failed with `SnapshotTooOld`; a populated target can also contain newer records that source-wins reconciliation would remove.

**How to apply:** use a resumable, ID-based stream; reconcile destination IDs against the source read; verify content before recreating TTL indexes. If the source stays writable, communicate that writes occurring after each collection is read may remain only on the source. For union migrations, only insert IDs missing from the destination and report unresolved same-ID conflicts separately.
