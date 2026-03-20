// OKLab color representation — perceptually uniform for distance comparisons
export interface OklabColor {
  L: number; // [0, 1]
  a: number; // ~[-0.4, 0.4]
  b: number; // ~[-0.4, 0.4]
  alpha: number; // [0, 1]
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

// --- sRGB gamma transfer ---

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// --- Conversion matrices ---

// Linear sRGB -> XYZ D65
const SRGB_TO_XYZ: [Vec3, Vec3, Vec3] = [
  [0.4123907992659595, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
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

function validOklab(c: OklabColor): OklabColor | null {
  return Number.isFinite(c.L) && Number.isFinite(c.a) && Number.isFinite(c.b) ? c : null;
}

export function parseColor(css: string): OklabColor | null {
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
    return validOklab({ L, a: oa, b: ob, alpha: a });
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
    return validOklab({ L, a: oa, b: ob, alpha: a });
  }

  if ((fn === "hsl" || fn === "hsla") && components.length >= 3) {
    const h = parseFloat(components[0]);
    const s2 = parseFloat(components[1]) / 100;
    const l = parseFloat(components[2]) / 100;
    const a = fn === "hsla" && components.length >= 4 ? parseComponent(components[3]) : alpha;
    const [L, oa, ob] = hslToOklab(h, s2, l);
    return validOklab({ L, a: oa, b: ob, alpha: a });
  }

  if (fn === "hwb" && components.length >= 3) {
    const h = parseFloat(components[0]);
    const w = parseFloat(components[1]) / 100;
    const bk = parseFloat(components[2]) / 100;
    const [L, oa, ob] = hwbToOklab(h, w, bk);
    return validOklab({ L, a: oa, b: ob, alpha });
  }

  if (fn === "oklab" && components.length >= 3) {
    const L = parseComponent(components[0]);
    const a2 = parseFloat(components[1]);
    const b2 = parseFloat(components[2]);
    return validOklab({ L, a: a2, b: b2, alpha });
  }

  if (fn === "oklch" && components.length >= 3) {
    const L = parseComponent(components[0]);
    const C = parseFloat(components[1]);
    const H = parseFloat(components[2]);
    const [oL, oa, ob] = oklchToOklab(L, C, H);
    return validOklab({ L: oL, a: oa, b: ob, alpha });
  }

  if (fn === "lab" && components.length >= 3) {
    const L = parseFloat(components[0]);
    const a2 = parseFloat(components[1]);
    const b2 = parseFloat(components[2]);
    const [oL, oa, ob] = labToOklab(L, a2, b2);
    return validOklab({ L: oL, a: oa, b: ob, alpha });
  }

  if (fn === "lch" && components.length >= 3) {
    const L = parseFloat(components[0]);
    const C = parseFloat(components[1]);
    const H = parseFloat(components[2]);
    const [oL, oa, ob] = lchToOklab(L, C, H);
    return validOklab({ L: oL, a: oa, b: ob, alpha });
  }

  if (fn === "color" && components.length >= 4) {
    const space = components[0];
    const c1 = parseFloat(components[1]);
    const c2 = parseFloat(components[2]);
    const c3 = parseFloat(components[3]);

    if (space === "srgb") {
      const [L, oa, ob] = srgbToOklab(c1, c2, c3);
      return validOklab({ L, a: oa, b: ob, alpha });
    }
    if (space === "srgb-linear") {
      const [L, oa, ob] = linearSrgbToOklab(c1, c2, c3);
      return validOklab({ L, a: oa, b: ob, alpha });
    }
    if (space === "display-p3") {
      const [L, oa, ob] = displayP3ToOklab(c1, c2, c3);
      return validOklab({ L, a: oa, b: ob, alpha });
    }
  }

  return null;
}

export function parseLightDark(css: string): { light: string; dark: string } | null {
  const s = css.trim();
  const match = s.match(/^light-dark\((.+)\)$/i);
  if (!match) return null;

  // Split on top-level comma (skip commas inside nested parentheses)
  const inner = match[1];
  let depth = 0;
  let splitIdx = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      splitIdx = i;
      break;
    }
  }
  if (splitIdx === -1) return null;

  const light = inner.slice(0, splitIdx).trim();
  const dark = inner.slice(splitIdx + 1).trim();
  if (!light || !dark) return null;

  return { light, dark };
}

// Euclidean distance in OKLab — perceptually uniform, so raw Euclidean
// is appropriate (unlike sRGB which needs weighted approximations).
// Scaled by 256 so thresholds remain comparable to the old redmean metric.
export function colorDistanceOklab(a: OklabColor, b: OklabColor): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db) * 256;
}
