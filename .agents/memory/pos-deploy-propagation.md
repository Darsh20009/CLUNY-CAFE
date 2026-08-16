---
name: POS deploy propagation gap
description: Always-on POS/kiosk browser tabs can keep running an old JS bundle indefinitely after a deploy, even though the service worker "looks" like it auto-updates.
---

## The problem
A cashier/POS tablet often never closes its browser tab — it can stay open for days. A normal SPA only picks up new code on a full page load. People assume the service worker's `controllerchange` auto-reload (registered in `main.tsx`) covers this, but it only fires when **`sw.js`'s own file bytes change**. An ordinary code deploy (bug fixes, features) only changes the hashed JS/CS S bundle referenced by `index.html` — it does not touch `sw.js` — so `controllerchange` never fires and the tab silently keeps running stale code forever.

**Why this matters**: this exact gap made a real bug fix invisible to the user for repeated deploy cycles, and looked indistinguishable from "the fix didn't work" — a serious trust problem, especially for always-on devices.

## How to apply
- Never rely solely on service-worker `controllerchange` to guarantee always-on clients pick up new deploys.
- Use an independent deploy-detection heartbeat: periodically re-fetch `/` with `cache: 'no-store'`, extract the hashed main bundle `<script src="/assets/...">` from the fresh HTML, and compare it to the bundle actually running (`document.scripts`). On mismatch, force a reload (with a short grace period so an in-flight tap isn't lost).
- Check on `visibilitychange` too (tab regaining focus after screen lock) for faster propagation, not just a timer.
- When debugging "I already fixed this but the user still sees the old bug," always ask/check whether the device ever actually reloaded after the fix shipped — this is a very easy thing to overlook and burns a lot of trust if missed repeatedly.
