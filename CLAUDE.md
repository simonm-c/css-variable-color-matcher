# CSS Variable Color Matcher

Chrome extension that scans all CSS custom properties from web pages, filters to color values, and matches picked colors against them.

## Build

- Source files live in `src/` (TypeScript) — **never edit the `dist/` files directly**, they are compiler output
- `pnpm run build` (or `npx tsc`) compiles `src/**/*.ts` → `dist/`
- `pnpm run fmt` formats with oxfmt
- `pnpm run lint` lints with oxlint

## Project structure

### Composables (stateful logic, `useX()` pattern)
- `src/composables/useChrome/index.ts` — Chrome extension API wrapper (storage, tabs, scripting, messaging, windows)
- `src/composables/useColorMatcher/index.ts` — Color matching and tiered comparison logic (`findMatches`, `isColorValue`)

### Utilities (stateless helpers)
- `src/utilities/colorParsing/index.ts` — Color parsing and OKLab distance comparison (`parseColor`, `parseLightDark`, `colorDistanceOklab`)
- `src/utilities/scanner/index.ts` — Self-contained `scanFrameColorVariables()` (injected into page frames, no imports)
- `src/utilities/popupRenderer/index.ts` — DOM rendering functions for popup UI (receives data + callbacks, no Chrome API calls)

### Entry points
- `src/entries/popup/index.ts` — Popup entry point: wires composables, utilities, and DOM event listeners
- `src/utilities/eyedropperHandler/index.ts` — Content script: EyeDropper API integration, color picking
- `src/utilities/panelWindowManager/index.ts` — Service worker: panel window lifecycle (open, focus, cleanup)

### Other
- `src/styles/popup.css` — Popup styles
- `test/` — Shared test utilities (fixtures, chrome mock)
- `src/**/__tests__/` — Tests co-located with their modules
- `popup.html` — Popup markup
- `manifest.json` — Extension manifest (V3)
- `dist/` — Compiled JS output (gitignored)

## Key patterns

- Composables follow the `export function useX() { return { ... } }` pattern, encapsulating stateful or API-wrapping logic
- Utilities are pure stateless helpers that can be imported anywhere
- **Self-contained entry points**: The content script (`eyedropperHandler`), service worker (`panelWindowManager`), and scanner must not use `import` — Chrome loads content scripts as classic scripts and the service worker manifest lacks `"type": "module"`. Use `chrome.*` APIs directly in these files.
- The popup entry point (`src/entries/popup/index.ts`) is loaded as an ES module (`<script type="module">`) and can import composables/utilities freely

## Scanning logic

The scanner collects all CSS custom properties (`--*`) via three stages, then filters to color values at display time using `parseColor()`/`parseLightDark()`:

1. **Stylesheet rules** — iterates `document.styleSheets` and `document.adoptedStyleSheets`, recursing into nested rules (`@layer`, `@media`, `@supports`, etc.) via `"cssRules" in rule`
2. **Computed value resolution** — for each discovered property, tries `querySelector(selector)` + `getComputedStyle()`, with fallback to `documentElement`
3. **Inline styles** — walks all elements for JS-injected custom properties

### Known target site structure (Tailwind v4 / Vite)

- Vite dev server injects CSS via `<style>` tags (same-origin, in `document.styleSheets`)
- Tailwind v4 wraps variables in `@layer theme { :root, :host { ... } }` — scanner must recurse through `@layer` blocks
- Semantic tokens use `var()` references (e.g. `--color-content-brand-light: var(--color-blue-600)`) — `getComputedStyle` resolves these
- Some tokens use `light-dark()` and `color-mix()` functions
- Nested `@supports` blocks inside `:root, :host` for progressive enhancement
