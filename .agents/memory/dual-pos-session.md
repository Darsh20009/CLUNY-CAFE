---
name: Dual POS pairing and wake behavior
description: Session, permission, and activity rules for the customer-facing POS display.
---

Use a fresh, unpersisted pairing ID for each POS page session. Route customer actions only to a POS connection with the exact same branch and pairing ID, and accept changes only while the cashier has enabled customer control. Disable changes when checkout begins.

**Why:** A customer-facing tab can be left open after a sale or cashier change; a persistent pairing could let that stale tab affect a later order.

**How to apply:** Keep the pairing branch-scoped and short-lived. After a POS reload, require staff to reopen the display rather than silently reusing an old customer tab.

Count clicks, touches, keys, and scrolls as immediate activity. Treat pointer movement as activity only after a meaningful distance and a short throttle; do not reset the idle-promo timer on every raw pointer event.

**Why:** Continuous minor pointer events can keep resetting the timer, preventing the product-and-QR promo screen from ever appearing.

**How to apply:** When changing Dual POS idle behavior, preserve cashier movement as a wake signal but filter pointer noise; keep explicit touch/click handling immediate.
