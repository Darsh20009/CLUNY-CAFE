---
name: Reference ZIP Migration (Black Rose → CLUNY)
description: How to migrate a Black Rose branded reference project into CLUNY branding; key pitfalls and fixes.
---

## Summary
Migrated ~618 files from Black Rose reference ZIP to CLUNY CAFE branding.

## Key Rules

**brand.ts is the single source of truth.**
All brand strings (name, colors, tagline, URLs) live in `client/src/lib/brand.ts`.
Do NOT hardcode "BLACK ROSE", "blackrose.com.sa", or `hsl(345 70% 42%)` anywhere.

**@assets alias = attached_assets/ (project root), NOT client/src/assets/**
Vite config resolves `@assets/...` → `attached_assets/`. Any image imported via `@assets/` must exist in `attached_assets/` directory, not in `client/src/assets/`.

**face-recognition.ts must be a stub (no @vladmandic/face-api direct import)**
Dynamic import with `/* @vite-ignore */` is required. The package is excluded from vite optimizeDeps.

**Crimson color = BLACK ROSE brand. CLUNY uses teal.**
- BLACK ROSE primary: `hsl(345 70% 42%)`, `rgba(190,24,69,...)`, `#BE1845`, `#8B0B2A`
- CLUNY primary: `hsl(155 55% 39%)`, `rgba(45,155,110,...)`, `#2D9B6E`, `#1A6B4A`
Replace ALL of these globally including inline styles and CSS.

**CSS :root --primary must match brand.ts**
The reference CSS had `--primary: 345 70% 42%` (crimson) in `:root`. Must be changed to `155 55% 39%`.

**iOS URL scheme: cluny:// (was blackrose://)**

## How to Apply
When doing a brand migration, run these in order:
1. Write brand.ts with new values
2. `sed` replace all text strings (English + Arabic)  
3. `sed` replace all color hex/rgba/hsl values
4. Fix --primary in index.css :root block
5. Copy all image assets to attached_assets/ (not just client/src/assets/)
6. Stub any native-only libraries (face-api, Capacitor) with `/* @vite-ignore */` dynamic imports

**Why:**  
Took multiple passes to find all 3 categories of brand references: text strings, Arabic strings, and color values. Each required a separate sed pass.
