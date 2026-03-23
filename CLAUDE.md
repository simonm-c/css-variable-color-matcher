# CSS Variable Color Matcher

Chrome extension that scans all CSS custom properties from web pages, filters to color values, and matches picked colors against them.

## Build

- Source files live in `src/` (TypeScript) — **never edit the `dist/` files directly**, they are compiler output
- `pnpm run build` bundles entry points via esbuild → `dist/`
- `pnpm run typecheck` runs `tsc --noEmit` for type checking
- `pnpm run fmt` formats with oxfmt
- `pnpm run lint` lints with oxlint
- `build.mjs` — esbuild build script, bundles 4 entry points (popup ESM, scanner ESM, eyedropperHandler IIFE, panelWindowManager IIFE)

## Core data type

`ColorVariable` (`src/utilities/cssParser/index.ts`) is the shared data type used throughout:
```typescript
interface ColorVariable { name: string; value: string; }
```
Variables are stored and passed as `ColorVariable[]` — arrays allow duplicate names with different values (e.g. when CSSOM-resolved and raw-parsed values differ).

## Project structure

### Composables (stateful logic, `useX()` pattern)
- `src/composables/useChrome/index.ts` — Chrome extension API wrapper (storage, tabs, scripting, messaging, windows). Exports `ChromeStorageData` (uses `ColorVariable[]`), `executeFileInFrames` (file-based script injection)
- `src/composables/useColorMatcher/index.ts` — Color matching and tiered comparison logic (`findMatches`, `isColorValue`). Takes `ColorVariable[]`

### Utilities (stateless helpers)
- `src/utilities/cssParser/index.ts` — **Shared CSS text parser**. Exports `ColorVariable` interface and `parseCssCustomProperties(cssText)` — extracts `--*` declarations from CSS text. Used by both the scanner and the CSS import feature
- `src/utilities/cssImportExport/index.ts` — Export saved lists as `.css` files (`exportListAsCss`), import `.css` files into saved lists (`triggerCssFileImport`). Uses shared CSS parser
- `src/utilities/colorParsing/index.ts` — Color parsing and OKLab distance comparison (`parseColor`, `parseLightDark`, `colorDistanceOklab`)
- `src/utilities/scanner/index.ts` — `scanFrameColorVariables()` — combines CSS text parsing (shared parser) with CSSOM walking + `getComputedStyle` resolution. Imports from `cssParser`. Returns `ColorVariable[]`
- `src/utilities/scanner/inject.ts` — Thin entry point for file-based injection (calls `scanFrameColorVariables()`)
- `src/utilities/popupRenderer/index.ts` — DOM rendering functions for popup UI (receives data + callbacks, no Chrome API calls)
- `src/utilities/themes/index.ts` — Chrome theme presets (14 M3-derived palettes), `applyTheme()` sets CSS custom properties at runtime

### Entry points
- `src/entries/popup/index.ts` — Popup entry point: wires composables, utilities, and DOM event listeners. Includes import/export wiring
- `src/utilities/eyedropperHandler/index.ts` — Content script: EyeDropper API integration, color picking
- `src/utilities/panelWindowManager/index.ts` — Service worker: panel window lifecycle (open, focus, cleanup)

### Other
- `src/styles/popup.css` — Popup styles (Chrome-matching Material Design, `light-dark()` throughout)
- `_locales/en/messages.json` — i18n strings
- `test/` — Shared test utilities (fixtures, chrome mock)
- `src/**/__tests__/` — Tests co-located with their modules
- `popup.html` — Popup markup
- `manifest.json` — Extension manifest (V3)
- `dist/` — Compiled JS output (gitignored)
- `build.mjs` — esbuild build script

## Key patterns

- Composables follow the `export function useX() { return { ... } }` pattern, encapsulating stateful or API-wrapping logic
- Utilities are pure stateless helpers that can be imported anywhere
- **Bundled entry points**: All entry points are bundled by esbuild (imports inlined). The scanner is injected via `chrome.scripting.executeScript` with `files` mode (not `func`), allowing it to import the shared CSS parser
- **Self-contained entry points**: The content script (`eyedropperHandler`) and service worker (`panelWindowManager`) are bundled as IIFE — they don't currently import shared code but could if needed
- The popup entry point (`src/entries/popup/index.ts`) is loaded as an ES module (`<script type="module">`) and can import composables/utilities freely

## Scanning logic

The scanner collects all CSS custom properties (`--*`) via two complementary approaches, then deduplicates (same name + same value → one entry, different values → both kept):

### 1. CSS text parsing (shared with import)
- Reads `<style>` elements' `textContent` and `fetch()`es CSS from `<link rel="stylesheet">` `href`s
- Parses with `parseCssCustomProperties()` from the shared `cssParser` utility
- Returns raw declared values

### 2. CSSOM walking + getComputedStyle
- Iterates `document.styleSheets` and `document.adoptedStyleSheets`, recursing into nested rules (`@layer`, `@media`, `@supports`, etc.)
- Resolves computed values via `querySelector(selector)` + `getComputedStyle()`, with fallback to `documentElement`
- Walks all elements for JS-injected custom properties (inline styles)
- Returns resolved values (var() references expanded)

Color values are filtered at display time using `parseColor()`/`parseLightDark()`.

### Known target site structure (Tailwind v4 / Vite)

- Vite dev server injects CSS via `<style>` tags (same-origin, in `document.styleSheets`)
- Tailwind v4 wraps variables in `@layer theme { :root, :host { ... } }` — scanner must recurse through `@layer` blocks
- Semantic tokens use `var()` references (e.g. `--color-content-brand-light: var(--color-blue-600)`) — `getComputedStyle` resolves these
- Some tokens use `light-dark()` and `color-mix()` functions
- Nested `@supports` blocks inside `:root, :host` for progressive enhancement
