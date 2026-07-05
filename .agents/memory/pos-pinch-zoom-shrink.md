---
name: POS pinch-zoom shrink bug
description: "Screen shrinks to a corner" complaints on an Android POS/kiosk app can be caused by accidental pinch-zoom, not by printing/iframe code — check the viewport meta tag before chasing print-flow theories.
---

## The problem
A recurring user report was "the POS screen shrinks/freezes into the top-right corner" on Android, believed for days to be caused by the receipt-printing/preview code (iframes triggering Android WebView viewport recalculation — a real, separate bug that was fixed). After that fix shipped, the exact same symptom kept happening on the **plain product-grid screen**, with no printing involved at all.

Root cause turned out to be unrelated: the app's `<meta name="viewport">` tag allowed pinch-zoom (`user-scalable=yes`, `maximum-scale=5`, no `minimum-scale`). On a busy touchscreen POS, any accidental multi-touch (a resting hand, fast double-tap) can pinch-zoom the page out. Android has no built-in "reset zoom" affordance, so the page stays zoomed out and scrolled into a corner — visually identical to a "shrink" bug — until the tab is manually reloaded.

**Why this matters**: a visually identical symptom can have two entirely unrelated root causes (iframe-triggered viewport recalculation vs. accidental pinch-zoom with no reset). Fixing the first does not fix the second, and repeatedly patching the wrong theory burns significant user trust ("I did 100 tests, still broken").

## How to apply
- For any kiosk/POS-style app (not a content site), pinch-zoom should be disabled outright: `user-scalable=no`, `maximum-scale=1.0`, `minimum-scale=1.0` in the viewport meta tag.
- Reinforce with CSS `touch-action: pan-x pan-y` on `html, body, #root` — some Android WebViews inconsistently honor the meta tag alone.
- Add a runtime safety net via the `visualViewport` API (`resize`/`scroll` listeners checking `visualViewport.scale !== 1`) that force-reapplies the viewport meta tag if zoom ever drifts, as defense in depth.
- When a visual bug report is described in general terms ("screen shrinks", "freezes"), don't assume it's tied to whatever feature was already under investigation (e.g. printing) — check for viewport/zoom-level causes independently, since they reproduce on any screen at any time.
