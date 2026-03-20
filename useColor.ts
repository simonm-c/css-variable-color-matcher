// OKLab color representation — perceptually uniform for distance comparisons
interface OklabColor {
  L: number; // [0, 1]
  a: number; // ~[-0.4, 0.4]
  b: number; // ~[-0.4, 0.4]
  alpha: number; // [0, 1]
}

// sRGB 0–255 channels for redmean distance formula
interface RgbChannels {
  r: number; // [0, 255]
  g: number; // [0, 255]
  b: number; // [0, 255]
}

// --- Matrix & math helpers ---

type Vec3 = [number, number, number];

function multiplyMatrix(m: [Vec3, Vec3, Vec3], v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

// --- sRGB gamma transfer ---

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// --- Conversion matrices ---

// Linear sRGB -> XYZ D65
const SRGB_TO_XYZ: [Vec3, Vec3, Vec3] = [
  [0.4123907992659595, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

// XYZ D65 -> Linear sRGB
const XYZ_TO_SRGB: [Vec3, Vec3, Vec3] = [
  [3.2409699419045226, -1.5373831775700939, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397696064091522, 1.0569715142428786],
];

// Linear Display-P3 -> XYZ D65
const P3_TO_XYZ: [Vec3, Vec3, Vec3] = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0.0, 0.04511338185890264, 1.043944368900976],
];

// Bradford chromatic adaptation: XYZ D50 -> XYZ D65
const D50_TO_D65: [Vec3, Vec3, Vec3] = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580106629, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];

// OKLab M1: XYZ D65 -> LMS (approximate cone response)
const OKLAB_M1: [Vec3, Vec3, Vec3] = [
  [0.8189330101, 0.3618667424, -0.1288597137],
  [0.0329845436, 0.9293118715, 0.0361456387],
  [0.0482003018, 0.2643662691, 0.633851707],
];

// OKLab M2: LMS (cube-root) -> OKLab
const OKLAB_M2: [Vec3, Vec3, Vec3] = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

// Inverse OKLab M2: OKLab -> LMS (cube-root)
const OKLAB_M2_INV: [Vec3, Vec3, Vec3] = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.0638541728],
  [1.0, -0.0894841775, -1.291485548],
];

// Inverse OKLab M1: LMS -> XYZ D65
const OKLAB_M1_INV: [Vec3, Vec3, Vec3] = [
  [1.2270138511035211, -0.5577999806518222, 0.2812561489664678],
  [-0.0405801784232806, 1.1122568696168302, -0.0716766786656012],
  [-0.0763812845057069, -0.4214819784180127, 1.5861632204407947],
];

// --- Core conversions ---

function linearSrgbToOklab(r: number, g: number, b: number): Vec3 {
  const xyz = multiplyMatrix(SRGB_TO_XYZ, [r, g, b]);
  return xyzD65ToOklab(xyz);
}

function xyzD65ToOklab(xyz: Vec3): Vec3 {
  const lms = multiplyMatrix(OKLAB_M1, xyz);
  const lms_ = [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])] as Vec3;
  return multiplyMatrix(OKLAB_M2, lms_);
}

function oklabToLinearSrgb(L: number, a: number, b: number): Vec3 {
  const lms_ = multiplyMatrix(OKLAB_M2_INV, [L, a, b]);
  const lms: Vec3 = [lms_[0] ** 3, lms_[1] ** 3, lms_[2] ** 3];
  const xyz = multiplyMatrix(OKLAB_M1_INV, lms);
  return multiplyMatrix(XYZ_TO_SRGB, xyz);
}

// --- Color space -> OKLab converters ---

function srgbToOklab(r: number, g: number, b: number): Vec3 {
  return linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
}

function hslToOklab(h: number, s: number, l: number): Vec3 {
  const [r, g, b] = hslToSrgb(h, s, l);
  return srgbToOklab(r, g, b);
}

function hwbToOklab(h: number, w: number, bk: number): Vec3 {
  // If white + black >= 1, result is a grey
  if (w + bk >= 1) {
    const grey = w / (w + bk);
    return srgbToOklab(grey, grey, grey);
  }
  const [r, g, b] = hslToSrgb(h, 1, 0.5);
  const f = 1 - w - bk;
  return srgbToOklab(r * f + w, g * f + w, b * f + w);
}

function oklchToOklab(L: number, C: number, H: number): Vec3 {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

function labToOklab(L: number, a: number, b: number): Vec3 {
  const xyz50 = labToXyzD50(L, a, b);
  const xyz65 = multiplyMatrix(D50_TO_D65, xyz50);
  return xyzD65ToOklab(xyz65);
}

function lchToOklab(L: number, C: number, H: number): Vec3 {
  const hRad = (H * Math.PI) / 180;
  return labToOklab(L, C * Math.cos(hRad), C * Math.sin(hRad));
}

function displayP3ToOklab(r: number, g: number, b: number): Vec3 {
  // Display-P3 uses same gamma as sRGB
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const xyz = multiplyMatrix(P3_TO_XYZ, [lr, lg, lb]);
  return xyzD65ToOklab(xyz);
}

// --- Helper conversions ---

function hslToSrgb(h: number, s: number, l: number): Vec3 {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [r + m, g + m, b + m];
}

function labToXyzD50(L: number, a: number, b: number): Vec3 {
  const kappa = 903.2962962962963; // (29/3)^3
  const epsilon = 0.008856451679035631; // (6/29)^3
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  // D50 illuminant
  const xn = 0.3457 / 0.3585;
  const yn = 1.0;
  const zn = (1.0 - 0.3457 - 0.3585) / 0.3585;

  const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const y = L > kappa * epsilon ? fy ** 3 : L / kappa;
  const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;

  return [x * xn, y * yn, z * zn];
}

// --- Parsing ---

function parseComponent(s: string): number {
  s = s.trim();
  if (s === "none") return 0;
  if (s.endsWith("%")) return parseFloat(s) / 100;
  return parseFloat(s);
}

function parseAlpha(parts: string[], defaultAlpha: number): number {
  const slashIdx = parts.indexOf("/");
  if (slashIdx !== -1 && slashIdx + 1 < parts.length) {
    return parseComponent(parts[slashIdx + 1]);
  }
  return defaultAlpha;
}

function splitArgs(inner: string): string[] {
  // Handle both comma-separated and space-separated syntax
  if (inner.includes(",")) {
    return inner.split(",").map((s) => s.trim());
  }
  return inner
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0);
}

function parseColor(css: string): OklabColor | null {
  const s = css.trim().toLowerCase();

  // Hex
  const hexMatch = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length <= 4) {
      // Expand shorthand
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const [L, oa, ob] = srgbToOklab(r, g, b);
    return { L, a: oa, b: ob, alpha: a };
  }

  // Functional notation: extract function name and inner content
  const funcMatch = s.match(/^([a-z][a-z0-9-]*)\((.+)\)$/);
  if (!funcMatch) return null;

  const fn = funcMatch[1];
  const inner = funcMatch[2];
  const args = splitArgs(inner);

  // Extract alpha from slash syntax for space-separated formats
  const alpha = parseAlpha(args, 1);

  // Remove "/" and alpha from args for cleaner component parsing
  const slashIdx = args.indexOf("/");
  const components = slashIdx !== -1 ? args.slice(0, slashIdx) : args;

  if ((fn === "rgb" || fn === "rgba") && components.length >= 3) {
    let r = parseFloat(components[0]);
    let g = parseFloat(components[1]);
    let b = parseFloat(components[2]);
    // Handle percentage values
    if (components[0].includes("%")) {
      r = (r / 100) * 255;
      g = (g / 100) * 255;
      b = (b / 100) * 255;
    }
    const a = fn === "rgba" && components.length >= 4 ? parseComponent(components[3]) : alpha;
    const [L, oa, ob] = srgbToOklab(r / 255, g / 255, b / 255);
    return { L, a: oa, b: ob, alpha: a };
  }

  if ((fn === "hsl" || fn === "hsla") && components.length >= 3) {
    const h = parseFloat(components[0]);
    const s2 = parseFloat(components[1]) / 100;
    const l = parseFloat(components[2]) / 100;
    const a = fn === "hsla" && components.length >= 4 ? parseComponent(components[3]) : alpha;
    const [L, oa, ob] = hslToOklab(h, s2, l);
    return { L, a: oa, b: ob, alpha: a };
  }

  if (fn === "hwb" && components.length >= 3) {
    const h = parseFloat(components[0]);
    const w = parseFloat(components[1]) / 100;
    const bk = parseFloat(components[2]) / 100;
    const [L, oa, ob] = hwbToOklab(h, w, bk);
    return { L, a: oa, b: ob, alpha };
  }

  if (fn === "oklab" && components.length >= 3) {
    const L = parseComponent(components[0]);
    const a2 = parseFloat(components[1]);
    const b2 = parseFloat(components[2]);
    return { L, a: a2, b: b2, alpha };
  }

  if (fn === "oklch" && components.length >= 3) {
    const L = parseComponent(components[0]);
    const C = parseFloat(components[1]);
    const H = parseFloat(components[2]);
    const [oL, oa, ob] = oklchToOklab(L, C, H);
    return { L: oL, a: oa, b: ob, alpha };
  }

  if (fn === "lab" && components.length >= 3) {
    const L = parseFloat(components[0]);
    const a2 = parseFloat(components[1]);
    const b2 = parseFloat(components[2]);
    const [oL, oa, ob] = labToOklab(L, a2, b2);
    return { L: oL, a: oa, b: ob, alpha };
  }

  if (fn === "lch" && components.length >= 3) {
    const L = parseFloat(components[0]);
    const C = parseFloat(components[1]);
    const H = parseFloat(components[2]);
    const [oL, oa, ob] = lchToOklab(L, C, H);
    return { L: oL, a: oa, b: ob, alpha };
  }

  if (fn === "color" && components.length >= 4) {
    const space = components[0];
    const c1 = parseFloat(components[1]);
    const c2 = parseFloat(components[2]);
    const c3 = parseFloat(components[3]);

    if (space === "srgb") {
      const [L, oa, ob] = srgbToOklab(c1, c2, c3);
      return { L, a: oa, b: ob, alpha };
    }
    if (space === "srgb-linear") {
      const [L, oa, ob] = linearSrgbToOklab(c1, c2, c3);
      return { L, a: oa, b: ob, alpha };
    }
    if (space === "display-p3") {
      const [L, oa, ob] = displayP3ToOklab(c1, c2, c3);
      return { L, a: oa, b: ob, alpha };
    }
  }

  return null;
}

// --- Public API ---

function colorDistanceOklab(a: OklabColor, b: OklabColor): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

// Extract sRGB 0–255 channels, parsing directly from the CSS source when
// the format already carries R/G/B, otherwise converting via OKLab → sRGB.
function getColorChannels(color: OklabColor, cssSource?: string): RgbChannels {
  if (cssSource) {
    const s = cssSource.trim().toLowerCase();

    // Hex — direct parse
    const hexMatch = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length <= 4) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }

    const funcMatch = s.match(/^([a-z][a-z0-9-]*)\((.+)\)$/);
    if (funcMatch) {
      const fn = funcMatch[1];
      const args = splitArgs(funcMatch[2]);
      const slashIdx = args.indexOf("/");
      const components = slashIdx !== -1 ? args.slice(0, slashIdx) : args;

      // rgb / rgba — already 0–255
      if ((fn === "rgb" || fn === "rgba") && components.length >= 3) {
        let r = parseFloat(components[0]);
        let g = parseFloat(components[1]);
        let b = parseFloat(components[2]);
        if (components[0].includes("%")) {
          r = (r / 100) * 255;
          g = (g / 100) * 255;
          b = (b / 100) * 255;
        }
        return {
          r: Math.round(clamp(r, 0, 255)),
          g: Math.round(clamp(g, 0, 255)),
          b: Math.round(clamp(b, 0, 255)),
        };
      }

      // hsl / hsla — convert via hslToSrgb
      if ((fn === "hsl" || fn === "hsla") && components.length >= 3) {
        const h = parseFloat(components[0]);
        const sat = parseFloat(components[1]) / 100;
        const l = parseFloat(components[2]) / 100;
        const [r, g, b] = hslToSrgb(h, sat, l);
        return {
          r: Math.round(clamp(r * 255, 0, 255)),
          g: Math.round(clamp(g * 255, 0, 255)),
          b: Math.round(clamp(b * 255, 0, 255)),
        };
      }

      // hwb
      if (fn === "hwb" && components.length >= 3) {
        const h = parseFloat(components[0]);
        const w = parseFloat(components[1]) / 100;
        const bk = parseFloat(components[2]) / 100;
        let r: number, g: number, b: number;
        if (w + bk >= 1) {
          const grey = w / (w + bk);
          r = g = b = grey;
        } else {
          const [br, bg, bb] = hslToSrgb(h, 1, 0.5);
          const f = 1 - w - bk;
          r = br * f + w;
          g = bg * f + w;
          b = bb * f + w;
        }
        return {
          r: Math.round(clamp(r * 255, 0, 255)),
          g: Math.round(clamp(g * 255, 0, 255)),
          b: Math.round(clamp(b * 255, 0, 255)),
        };
      }

      // color(srgb ...) and color(srgb-linear ...)
      if (fn === "color" && components.length >= 4) {
        if (components[0] === "srgb") {
          return {
            r: Math.round(clamp(parseFloat(components[1]) * 255, 0, 255)),
            g: Math.round(clamp(parseFloat(components[2]) * 255, 0, 255)),
            b: Math.round(clamp(parseFloat(components[3]) * 255, 0, 255)),
          };
        }
        if (components[0] === "srgb-linear") {
          return {
            r: Math.round(clamp(linearToSrgb(parseFloat(components[1])) * 255, 0, 255)),
            g: Math.round(clamp(linearToSrgb(parseFloat(components[2])) * 255, 0, 255)),
            b: Math.round(clamp(linearToSrgb(parseFloat(components[3])) * 255, 0, 255)),
          };
        }
      }
    }
  }

  // Fallback: convert from OKLab → linear sRGB → sRGB → 0–255
  const [lr, lg, lb] = oklabToLinearSrgb(color.L, color.a, color.b);
  return {
    r: Math.round(clamp(linearToSrgb(lr) * 255, 0, 255)),
    g: Math.round(clamp(linearToSrgb(lg) * 255, 0, 255)),
    b: Math.round(clamp(linearToSrgb(lb) * 255, 0, 255)),
  };
}

// Compuphase redmean weighted color distance approximation
// https://www.compuphase.com/cmetric.htm
function colorDistanceRedmean(a: RgbChannels, b: RgbChannels): number {
  const rmean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(((512 + rmean) * dr * dr) / 256 + 4 * dg * dg + ((767 - rmean) * db * db) / 256);
}

function oklabToHex(color: OklabColor): string {
  const [lr, lg, lb] = oklabToLinearSrgb(color.L, color.a, color.b);
  const r = Math.round(clamp(linearToSrgb(lr), 0, 1) * 255);
  const g = Math.round(clamp(linearToSrgb(lg), 0, 1) * 255);
  const b = Math.round(clamp(linearToSrgb(lb), 0, 1) * 255);

  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

  if (color.alpha < 1) {
    const a = Math.round(clamp(color.alpha, 0, 1) * 255);
    return hex + a.toString(16).padStart(2, "0");
  }
  return hex;
}
