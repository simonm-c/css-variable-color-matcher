# CSS Variable Color Matcher

Chrome extension that scans all CSS custom properties from web pages, filters to color values, and matches picked colors against them.

## Build

- Source files are `*.ts` (TypeScript) — **never edit the `.js` files directly**, they are compiler output
- `pnpm run build` (or `npx tsc`) compiles `.ts` → `.js`
- `pnpm run fmt` formats with oxfmt
- `pnpm run lint` lints with oxlint

## Project structure

- `popup.ts` — Extension popup UI, scanning trigger (`scanFrameColorVariables` injected into page frames), search/filter, saved lists
- `content.ts` — Content script: `scanDocument()`, `collectColorProps()`, eyedropper integration
- `useColor.ts` — Color parsing and distance comparison (OKLab/Redmean)
- `popup.html` / `popup.css` — Popup markup and styles
- `manifest.json` — Extension manifest (V3)

## Key patterns

- Two parallel scanning implementations exist: `scanFrameColorVariables()` in `popup.ts` (injected via `chrome.scripting.executeScript`) and `scanDocument()` in `content.ts` (content script). Changes to scanning logic must be applied to both.
- The injected function in `popup.ts` must be fully self-contained — it cannot reference external functions.

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
