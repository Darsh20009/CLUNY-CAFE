---
name: Dual POS pairing
description: Session and permission rules for a customer-facing POS display.
---

Use a fresh, unpersisted pairing ID for each POS page session. Route customer actions only to a POS connection with the exact same branch and pairing ID, and accept changes only while the cashier has enabled customer control. Disable changes when checkout begins.

**Why:** A customer-facing tab can be left open after a sale or cashier change; a persistent pairing could let that stale tab affect a later order.

**How to apply:** Keep the pairing branch-scoped and short-lived. After a POS reload, require staff to reopen the display rather than silently reusing an old customer tab.
