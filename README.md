# CSS Variable Color Matcher

A Chrome extension that scans all CSS custom properties from any webpage, filters to color values, and lets you match picked colors against them using perceptually accurate OKLab color distance.

Built for developers and designers working with design systems, Tailwind CSS, or any site that uses CSS custom properties for color tokens.

## Features

- **Scan all CSS custom properties** from stylesheets, adopted stylesheets, and inline styles
- **Deep rule traversal** — recurses into `@layer`, `@media`, `@supports`, and nested CSS rules (Tailwind v4 compatible)
- **Pick colors** from the page using the native EyeDropper API
- **Perceptual color matching** using OKLab distance with exact / close / far match tiers
- **`light-dark()` support** — compares picked color against both branches independently
- **Real-time search** to filter variables by name or value
- **Save named lists** of variables and switch between them to compare across pages
- **Pop-out window** for easier side-by-side use
- **Multi-frame scanning** — scans all iframes on the page
- **Chrome-matching theme** with Material Design UI and automatic dark mode support
- **Internationalization** — UI strings externalized via Chrome i18n (`_locales/`)

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/simonm-c/css-variable-color-matcher.git
   cd css-variable-color-matcher
   ```

2. Install dependencies and build:
   ```sh
   pnpm install
   pnpm run build
   ```

3. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the project directory

## Usage

1. **Scan** — Open the extension popup and click **Scan Variables**. The extension injects a scanner into all frames on the page, collecting every CSS custom property and resolving `var()` references via `getComputedStyle`. Only color values are displayed.

2. **Pick a color** — Click **Pick Color** to open the native eyedropper. Click any pixel on the page to select it.

3. **Review matches** — Picked colors are compared against all scanned variables. Results are sorted by perceptual distance and grouped into three tiers:
   - **Exact** (distance <= 2) — highlighted in green
   - **Close** (~5 nearest) — normal styling
   - **Far** (~5 more) — dimmed

4. **Search** — Use the search field to filter variables by name or resolved value.

5. **Save lists** — Enter a name and click **Save** to store the current set of variables. Switch between saved lists to compare variables across different pages or states.

6. **Pop out** — Click the pop-out button in the header to open the UI in a standalone window.

7. **Theme** — Click the palette icon in the header to choose from 14 theme presets matching Chrome's "Customize Chrome" color options (Default, Blue, Cool Grey, Grey, Aqua, Green, Viridian, Citron, Orange, Apricot, Rose, Pink, Fuchsia, Violet). The UI automatically follows your system light/dark preference via `light-dark()`.

## Supported Color Formats

The color parser supports all CSS Color Level 4 syntaxes:

| Format | Example |
|--------|---------|
| Hex | `#fff`, `#ff0000`, `#ff000080` |
| Named colors | `red`, `rebeccapurple`, `transparent` (all 148 keywords) |
| RGB/RGBA | `rgb(255 0 0)`, `rgba(255, 0, 0, 0.5)` |
| HSL/HSLA | `hsl(0 100% 50%)`, `hsla(0, 100%, 50%, 0.5)` |
| HWB | `hwb(0 0% 0%)` |
| OKLab | `oklab(0.5 0.1 -0.1)` |
| OKLCH | `oklch(0.5 0.2 180)` |
| CIE Lab | `lab(50 20 -30)` |
| CIE LCH | `lch(50 20 0)` |
| `light-dark()` | `light-dark(#fff, #000)` |

All `color()` predefined color spaces are supported:

| Color space | Example |
|-------------|---------|
| `srgb` | `color(srgb 1 0 0)` |
| `srgb-linear` | `color(srgb-linear 1 0 0)` |
| `display-p3` | `color(display-p3 1 0 0)` |
| `display-p3-linear` | `color(display-p3-linear 1 0 0)` |
| `a98-rgb` | `color(a98-rgb 1 0 0)` |
| `prophoto-rgb` | `color(prophoto-rgb 1 0 0)` |
| `rec2020` | `color(rec2020 1 0 0)` |
| `xyz` / `xyz-d65` | `color(xyz-d65 0.95 1.0 1.09)` |
| `xyz-d50` | `color(xyz-d50 0.95 1.0 0.82)` |

All color functions support the `none` keyword for missing components (e.g. `oklch(0.5 none 180)`) and `/alpha` slash syntax (e.g. `rgb(255 0 0 / 0.5)`).

## Development

```sh
pnpm run build            # Compile TypeScript → dist/
pnpm run watch            # Watch mode compilation
pnpm run fmt              # Format with oxfmt
pnpm run fmt:check        # Check formatting
pnpm run lint             # Lint with oxlint
pnpm run lint:fix         # Auto-fix lint issues
pnpm run test             # Run unit tests (Vitest)
pnpm run test:watch       # Run tests in watch mode
pnpm run test:coverage    # Run tests with coverage
pnpm run test:integration # Build + run Puppeteer integration tests
pnpm run test:all         # Run unit + integration tests
```

Source files are TypeScript in `src/`. Never edit the compiled `dist/*.js` files directly.

## Project Structure

```
src/
├── composables/
│   ├── useChrome/          # Chrome extension API wrapper (storage, tabs, scripting, messaging)
│   └── useColorMatcher/    # Color matching and tiered comparison logic
├── utilities/
│   ├── colorParsing/       # CSS Color 4 parser, color space conversions, OKLab distance
│   ├── scanner/            # Self-contained frame scanner (injected into pages)
│   ├── popupRenderer/      # DOM rendering functions for popup UI
│   ├── themes/             # Chrome theme presets (M3-derived palettes, applyTheme)
│   ├── eyedropperHandler/  # Content script: EyeDropper API integration
│   └── panelWindowManager/ # Service worker: panel window lifecycle
├── entries/
│   └── popup/              # Popup entry point: wires composables and utilities
└── styles/
    └── popup.css           # Popup styles (Chrome-matching theme, dark mode)

_locales/en/messages.json   # i18n strings
popup.html                  # Popup markup
manifest.json               # Chrome extension manifest (V3)
dist/                       # Compiled JS output (gitignored)
```

## How Color Matching Works

Colors are compared in the [OKLab color space](https://bottosson.github.io/posts/oklab/), which is perceptually uniform — equal numeric distances correspond to equal perceived differences. The pipeline:

1. Parse the CSS color string (any supported format) into its color space components
2. Apply the appropriate transfer function to linearize (e.g. sRGB gamma, Adobe RGB gamma 563/256, ProPhoto gamma 1.8, BT.2020 piecewise)
3. Matrix-multiply linear RGB → XYZ D65 (with Bradford chromatic adaptation for D50-based spaces like ProPhoto and CIE Lab)
4. Convert XYZ D65 → LMS cone response (M1 matrix) → cube root → OKLab (M2 matrix)
5. Compute Euclidean distance between two OKLab values, scaled to 0-255

A distance of 0 is an exact color match. Distances <= 2 are treated as exact matches (imperceptible difference). Results are sorted by distance so the closest matches appear first.

## License

ISC
