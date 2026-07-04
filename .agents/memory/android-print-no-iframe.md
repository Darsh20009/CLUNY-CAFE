---
name: Android print — no iframe rule
description: On Android WebView/Chrome, any hidden iframe in the DOM (even at top:-9999px) causes viewport recalculation that shrinks the entire app UI.
---

## Rule
On Android, NEVER create an iframe for printing — not hidden, not off-screen, not tiny. Even a 1px iframe with `opacity:0` is enough to trigger the bug.

## Why
Android Chrome/WebView measures ALL iframes in the DOM to calculate the page's minimum viewport width. A 302px-wide iframe (80mm paper) tells Android the page should be ~302px wide, so it zooms/shrinks the entire UI to match.

## The Fix (implemented in this codebase)
1. **`_printAndroid()` in `print-utils.ts`**: Parses fullHtml, injects body content as a hidden `<div>` in the main document, uses `@media print` CSS to show only that div, calls `window.print()` on the parent window. Zero iframes.
2. **`_printDirectAsync()`**: Routes to `_printAndroid()` when `_isAndroid` is true; desktop/iOS still use the hidden iframe path.
3. **`receipt-invoice.tsx`**: Skips staged iframe creation on Android (`isAndroidDevice` guard); `printReceipt()` calls `printHtmlInPage()` instead.
4. **`pos-system.tsx`**: Skips staged iframe creation on Android (`isAndroidDevice` guard); `tryStagedPrint()` returns false on Android.
5. **`_printCanvasImage()`**: Routes to `_printAndroid()` on Android.

## There were THREE sources of iframes — all must be guarded
- `_printDirectAsync` (central queue engine)
- `receipt-invoice.tsx` staged iframe (pre-staged for fast sync click)
- `pos-system.tsx` staged iframe (pre-staged when receipt dialog opens)

Fixing only one source leaves the others still shrinking the viewport.

## How to apply
Any new print feature that creates an iframe must check `isAndroidDevice` (exported from `print-utils.ts`) and route to `printHtmlInPage()` or `_printAndroid()` instead.
