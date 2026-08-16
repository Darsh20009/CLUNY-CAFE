---
name: Android print — no iframe + no auto window.print() rule
description: On Android WebView, iframes shrink viewport AND window.print() blocks the JS thread. Both are forbidden for auto-print paths. Popup windows containing iframes (window.open + srcdoc) are also unsafe on Android, even for manual/user-initiated preview flows.
---

## Three separate Android print bugs

### Bug 1 — Viewport shrink (iframes)
Any hidden iframe in the DOM (even 1px, opacity:0) causes Android to recalculate viewport width, shrinking the entire app UI.
**Fix**: NEVER create an iframe on Android. Use `_printAndroid()` (inject into main DOM, @media print CSS).

### Bug 2 — UI freeze (window.print() on auto-print paths)
`window.print()` on Android WebView is SYNCHRONOUS and blocks the JS thread entirely for 3-8 seconds.
**Fix**: NEVER call `window.print()` from ANY auto-triggered print path on Android.

### Bug 3 — Popup windows with iframes inside (preview windows)
`window.open()` popups that inject iframes via `srcdoc` (e.g. side-by-side customer/kitchen receipt preview windows) are unreliable on Android WebView — the popup itself can render blank/frozen, independent of whether the print was auto or manual triggered.
**Fix**: even for manual/user-initiated preview actions, skip the popup+iframe UI entirely on Android — print each receipt directly via `_printDirectAsync` (which internally routes through `_printAndroid()`, no iframe, no popup). Applies to `print-utils.ts`: `openReceiptPreviewWindow` and `printTaxInvoice`'s manual-preview (`shouldAutoPrint=false`) branch.

## Auto-print vs manual-print distinction (critical)

- **Auto-print** = triggered without user gesture (after payment, online order arrival, etc.)
  → `window.print()` is FORBIDDEN on Android. Dispatch `qirox:print-error` event instead.
- **Manual-print** = user explicitly pressed a print button
  → `window.print()` is acceptable (user consciously triggered it).

## Where the Android guards live (definitive map)

| Location | Type | Guard |
|---|---|---|
| `receipt-invoice.tsx` useEffect (variant="auto") | auto | `if (isAndroidDevice) return;` AFTER thermalConfigured check |
| `printTaxInvoice` thermal catch block | auto | dispatches error event + returns on Android |
| `printTaxInvoice` shouldAutoPrint browser fallback | auto | `if (_isAndroid)` dispatches error + returns |
| `printReceiptSection` browser fallback | manual only | NO Android guard — user initiated |
| `handlePrintReceipt` (pos-system.tsx) | manual | uses `buildReceiptPreviewHtml` + `printHtmlInPage` on Android without thermal |

## Key insight: printReceiptSection is manual-only
`printReceiptSection` is ONLY called from user-initiated button handlers.
Do NOT add Android guards to its browser fallback — it would block legitimate user prints.
Auto-print goes through `printTaxInvoice(data, { autoPrint: true })`, not `printReceiptSection`.

## The three iframe sources (all guarded)
- `_printDirectAsync` → routes to `_printAndroid()` on Android
- `receipt-invoice.tsx` staged iframe → skipped on Android
- `pos-system.tsx` staged iframe → `tryStagedPrint()` returns false on Android

## How to apply
- New auto-print feature → add `if (_isAndroid) { dispatch error; return; }` before any `window.print()`
- New manual print button → use `printHtmlInPage()` directly on Android (no iframe), allow brief freeze
- New print function → check if it can be called from auto-print path; if yes, add Android guard
