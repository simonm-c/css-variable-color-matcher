<p align="center">
  <img src="icons/icon.svg" alt="CSS Variable Color Matcher" width="128" height="128">
</p>

<h1 align="center">CSS Variable Color Matcher</h1>

<p align="center">
  Match colors to CSS custom properties on any webpage.
</p>

<p align="center">
  <a href="https://github.com/simonm-c/css-variable-color-matcher/blob/main/package.json"><img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version"></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-ISC-green" alt="License"></a>
  <img src="https://img.shields.io/badge/manifest-v3-orange" alt="Manifest V3">
  <img src="https://img.shields.io/badge/chrome-extension-yellow?logo=googlechrome&logoColor=white" alt="Chrome Extension">
</p>

---

Scan any webpage for CSS custom properties, pick a color with the built-in eyedropper, and instantly find the closest matching variable. Supports all CSS Color Level 4 syntaxes including `oklch()`, `lab()`, `color()`, `light-dark()`, and more. Save variable lists for quick comparison across pages.

Built for developers and designers working with design systems, Tailwind CSS, or any site that uses CSS custom properties for color tokens.

<!-- ## Screenshots

> TODO: Add screenshots of the extension in action

-->

## Features

- **Scan all CSS custom properties** — collects from stylesheets, adopted stylesheets, and inline styles across all frames
- **Deep rule traversal** — recurses into `@layer`, `@media`, `@supports`, and nested CSS rules (Tailwind v4 compatible)
- **Pick colors** from the page using the native EyeDropper API
- **Perceptual color matching** — uses OKLab distance with exact / close / far match tiers
- **Full CSS Color 4 support** — hex, named colors, `rgb()`, `hsl()`, `hwb()`, `oklab()`, `oklch()`, `lab()`, `lch()`, `color()` with all predefined spaces
- **`light-dark()` support** — compares picked color against both branches independently
- **Real-time search** to filter variables by name or value
- **Save & manage named lists** — save, rename, delete, and switch between variable snapshots
- **Import/export CSS files** — import `.css` files as lists, export saved lists as `.css`
- **Pop-out window** for side-by-side use alongside DevTools
- **Multi-frame scanning** — scans all iframes on the page
- **14 theme presets** — Chrome-matching Material Design UI with automatic light/dark mode
- **Internationalization** — UI strings externalized via Chrome i18n

## Installation

### From source (developer mode)

1. Clone and build:
   ```sh
   git clone https://github.com/simonm-c/css-variable-color-matcher.git
   cd css-variable-color-matcher
   pnpm install
   pnpm run build
   ```

2. Load in Chrome:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** and select the project directory

## Usage

1. **Scan** — Click the extension icon and press **Scan Variables**. The scanner collects every CSS custom property from all frames, resolving `var()` references via `getComputedStyle`. Only color values are displayed.

2. **Pick a color** — Click **Pick Color** to activate the native eyedropper. Click any pixel on the page.

3. **Review matches** — Results are sorted by perceptual distance (OKLab) and grouped into tiers:
   | Tier | Distance | Display |
   |------|----------|---------|
   | Exact | ≤ 2 | Highlighted green |
   | Close | ~5 nearest | Normal |
   | Far | ~5 more | Dimmed |

4. **Search** — Filter variables by name or resolved value.

5. **Save lists** — Save the current variable set with a name. Switch between lists to compare across pages or states.

6. **Import/Export** — Import a `.css` file as a named list, or export a saved list as `.css`.

7. **Pop out** — Open the UI in a standalone window via the pop-out button.

8. **Themes** — Choose from 14 presets (Default, Blue, Cool Grey, Grey, Aqua, Green, Viridian, Citron, Orange, Apricot, Rose, Pink, Fuchsia, Violet). Follows system light/dark preference automatically.

## Supported Color Formats

All CSS Color Level 4 syntaxes are supported. Every function accepts the `none` keyword for missing components and `/alpha` slash syntax.

<details>
<summary><strong>Color functions</strong></summary>

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

</details>

<details>
<summary><strong><code>color()</code> predefined spaces</strong></summary>

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

</details>

## Permissions

This extension requests the following Chrome permissions:

| Permission | Why it's needed |
|------------|-----------------|
| `activeTab` | Access the current tab to scan its CSS custom properties |
| `scripting` | Inject the scanner script into page frames |
| `storage` | Persist saved variable lists and theme preference |
| `host_permissions` (`<all_urls>`) | Scan CSS variables on any website and fetch cross-origin stylesheets |

The extension does not collect, transmit, or store any personal data. All data remains local to your browser.

## How Color Matching Works

Colors are compared in the [OKLab color space](https://bottosson.github.io/posts/oklab/), which is perceptually uniform — equal numeric distances correspond to equal perceived differences.

**Conversion pipeline:**

1. Parse the CSS color string into its color space components
2. Linearize via the appropriate transfer function (sRGB piecewise, Adobe RGB γ 563/256, ProPhoto γ 1.8, BT.2020 piecewise)
3. Matrix-multiply linear RGB → XYZ D65 (with Bradford chromatic adaptation for D50-based spaces)
4. Convert XYZ D65 → LMS (M1) → cube root → OKLab (M2)
5. Compute Euclidean distance, scaled to 0–255

A distance of 0 is an exact match. Distances ≤ 2 are treated as exact (imperceptible difference).

## Development

```sh
pnpm install                  # Install dependencies
pnpm run build                # Compile TypeScript → dist/
pnpm run watch                # Watch mode
pnpm run typecheck            # Type check (tsc --noEmit)
pnpm run fmt                  # Format (oxfmt)
pnpm run lint                 # Lint (oxlint)
pnpm run test                 # Unit tests (Vitest)
pnpm run test:watch           # Tests in watch mode
pnpm run test:coverage        # Tests with coverage
pnpm run test:integration     # Build + Puppeteer integration tests
pnpm run test:all             # Unit + integration tests
```

### Tech stack

- **TypeScript** — source language
- **esbuild** — bundler (4 entry points: popup ESM, scanner ESM, eyedropper IIFE, panel manager IIFE)
- **Vitest** — unit tests
- **Puppeteer** — integration tests
- **oxfmt** / **oxlint** — formatting and linting

### Project structure

```
src/
├── composables/
│   ├── useChrome/            # Chrome API wrapper (storage, tabs, scripting, messaging)
│   └── useColorMatcher/      # Color matching and tiered comparison logic
├── utilities/
│   ├── colorParsing/         # CSS Color 4 parser, color space conversions, OKLab distance
│   ├── cssParser/            # Shared CSS text parser (used by scanner and import)
│   ├── cssImportExport/      # Import/export .css files as variable lists
│   ├── scanner/              # Frame scanner (injected into pages)
│   ├── popupRenderer/        # DOM rendering functions for popup UI
│   ├── themes/               # Chrome theme presets (14 M3-derived palettes)
│   ├── eyedropperHandler/    # Content script: EyeDropper API
│   └── panelWindowManager/   # Service worker: panel window lifecycle
├── entries/
│   └── popup/                # Popup entry point
└── styles/
    └── popup.css             # Popup styles (Material Design, light-dark())
```

## Compatibility

- **Chrome** 95+ (EyeDropper API support)
- **Manifest V3**
- Not compatible with Firefox (uses Chrome-specific APIs: `chrome.scripting`, EyeDropper)

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/simonm-c/css-variable-color-matcher/issues) or submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and add tests
4. Run `pnpm run test:all && pnpm run lint && pnpm run typecheck` to verify
5. Submit a pull request

## License

[ISC](https://opensource.org/licenses/ISC)
