// OKLab color representation — a perceptually uniform color space where
// equal numeric distances correspond to equal perceived color differences.
// Designed by Björn Ottosson: https://bottosson.github.io/posts/oklab/
export interface OklabColor {
  L: number; // Perceived lightness [0, 1] (0 = black, 1 = white)
  a: number; // Green-red axis ~[-0.4, 0.4] (negative = green, positive = red)
  b: number; // Blue-yellow axis ~[-0.4, 0.4] (negative = blue, positive = yellow)
  alpha: number; // Opacity [0, 1]
}

// --- Matrix & math helpers ---

type ColorTuple = [number, number, number];

function multiplyMatrix(
  matrix: [ColorTuple, ColorTuple, ColorTuple],
  vector: ColorTuple,
): ColorTuple {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

// sRGB gamma transfer: converts a gamma-encoded sRGB value [0, 1] to linear light.
// The piecewise formula is defined in the sRGB specification (IEC 61966-2-1):
// linear = value / 12.92              when value <= 0.04045
// linear = ((value + 0.055) / 1.055)^2.4  otherwise
function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

// --- Conversion matrices ---
// These 3x3 matrices transform between color spaces via matrix multiplication.
// Each maps a [channel1, channel2, channel3] tuple from one space to another.
// Sources: CSS Color Level 4 spec (https://www.w3.org/TR/css-color-4/)
// and OKLab reference (https://bottosson.github.io/posts/oklab/)

// Linear sRGB -> XYZ D65
const SRGB_TO_XYZ: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.4123907992659595, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

// Linear Display-P3 -> XYZ D65
const P3_TO_XYZ: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0.0, 0.04511338185890264, 1.043944368900976],
];

// Bradford chromatic adaptation: XYZ D50 -> XYZ D65
const D50_TO_D65: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580106629, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];

// OKLab M1: XYZ D65 -> LMS (approximate cone response)
const OKLAB_M1: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.8189330101, 0.3618667424, -0.1288597137],
  [0.0329845436, 0.9293118715, 0.0361456387],
  [0.0482003018, 0.2643662691, 0.633851707],
];

// OKLab M2: LMS (cube-root) -> OKLab
const OKLAB_M2: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

// --- Core conversions ---

function linearSrgbToOklab(r: number, g: number, b: number): ColorTuple {
  const xyz = multiplyMatrix(SRGB_TO_XYZ, [r, g, b]);
  return xyzD65ToOklab(xyz);
}

// Converts XYZ D65 to OKLab via the two-step OKLab pipeline:
// 1. XYZ -> LMS (long/medium/short cone response) via M1 matrix
// 2. Cube-root each LMS component (perceptual compression)
// 3. Compressed LMS -> OKLab via M2 matrix
function xyzD65ToOklab(xyz: ColorTuple): ColorTuple {
  const lms = multiplyMatrix(OKLAB_M1, xyz);
  const lmsCubeRoot = [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])] as ColorTuple;
  return multiplyMatrix(OKLAB_M2, lmsCubeRoot);
}

// --- Color space -> OKLab converters ---

function srgbToOklab(r: number, g: number, b: number): ColorTuple {
  return linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
}

function hslToOklab(h: number, s: number, l: number): ColorTuple {
  const [r, g, b] = hslToSrgb(h, s, l);
  return srgbToOklab(r, g, b);
}

// HWB (Hue, Whiteness, Blackness) to OKLab conversion.
// HWB is defined in CSS Color Level 4 §7.2:
// https://www.w3.org/TR/css-color-4/#hwb-to-rgb
// The RGB is derived from the fully saturated hue, then mixed toward
// white and black by the w and bk amounts.
function hwbToOklab(h: number, w: number, bk: number): ColorTuple {
  // If white + black >= 1, result is a grey
  if (w + bk >= 1) {
    const grey = w / (w + bk);
    return srgbToOklab(grey, grey, grey);
  }
  const [r, g, b] = hslToSrgb(h, 1, 0.5);
  const factor = 1 - w - bk;
  return srgbToOklab(r * factor + w, g * factor + w, b * factor + w);
}

// OKLCH to OKLab: polar to rectangular coordinate conversion.
// OKLCH expresses chroma (C) and hue (H) as polar coordinates;
// OKLab uses rectangular a/b axes. Standard conversion:
//   a = C * cos(H),  b = C * sin(H)
function oklchToOklab(L: number, C: number, H: number): ColorTuple {
  const hueRadians = (H * Math.PI) / 180;
  return [L, C * Math.cos(hueRadians), C * Math.sin(hueRadians)];
}

function labToOklab(L: number, a: number, b: number): ColorTuple {
  const xyz50 = labToXyzD50(L, a, b);
  const xyz65 = multiplyMatrix(D50_TO_D65, xyz50);
  return xyzD65ToOklab(xyz65);
}

// CIE LCH to OKLab: polar to rectangular, then Lab -> OKLab.
// Same polar conversion as OKLCH (a = C*cos(H), b = C*sin(H)),
// but the resulting a/b are in CIE Lab space, not OKLab.
function lchToOklab(L: number, C: number, H: number): ColorTuple {
  const hueRadians = (H * Math.PI) / 180;
  return labToOklab(L, C * Math.cos(hueRadians), C * Math.sin(hueRadians));
}

function displayP3ToOklab(r: number, g: number, b: number): ColorTuple {
  // Display-P3 uses the same gamma transfer function as sRGB
  const linearRed = srgbToLinear(r);
  const linearGreen = srgbToLinear(g);
  const linearBlue = srgbToLinear(b);
  const xyz = multiplyMatrix(P3_TO_XYZ, [linearRed, linearGreen, linearBlue]);
  return xyzD65ToOklab(xyz);
}

// --- Helper conversions ---

// HSL to sRGB conversion per CSS Color Level 4 §7.1
// https://www.w3.org/TR/css-color-4/#hsl-to-rgb
function hslToSrgb(h: number, s: number, l: number): ColorTuple {
  h = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondaryChroma = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const lightnessOffset = l - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;
  if (h < 60) {
    red = chroma;
    green = secondaryChroma;
  } else if (h < 120) {
    red = secondaryChroma;
    green = chroma;
  } else if (h < 180) {
    green = chroma;
    blue = secondaryChroma;
  } else if (h < 240) {
    green = secondaryChroma;
    blue = chroma;
  } else if (h < 300) {
    red = secondaryChroma;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondaryChroma;
  }
  return [red + lightnessOffset, green + lightnessOffset, blue + lightnessOffset];
}

// CIE Lab to XYZ (D50 illuminant) conversion.
// Formula from CIE 15:2004 (Colorimetry) and CSS Color Level 4 §10.1.
// https://www.w3.org/TR/css-color-4/#color-conversion-code
//
// The conversion uses intermediate "f" values (nonlinear transfer functions)
// that are inverted back to linear XYZ using a piecewise function with
// kappa/epsilon thresholds defined by the CIE standard.
//
// XYZ is the CIE 1931 color space where X, Y, Z are the three "tristimulus
// values" — amounts of three theoretical primary lights needed to match a
// color. Y corresponds to luminance, while X and Z capture chromaticity.
function labToXyzD50(L: number, a: number, b: number): ColorTuple {
  const kappa = 903.2962962962963; // CIE constant: (29/3)^3
  const epsilon = 0.008856451679035631; // CIE constant: (6/29)^3

  // Intermediate nonlinear transfer values derived from Lab components
  const transferY = (L + 16) / 116;
  const transferX = a / 500 + transferY;
  const transferZ = transferY - b / 200;

  // D50 reference white point (standard illuminant for ICC profiles).
  // These scale the normalized XYZ values to absolute tristimulus values.
  const whiteX = 0.3457 / 0.3585;
  const whiteY = 1.0;
  const whiteZ = (1.0 - 0.3457 - 0.3585) / 0.3585;

  // Invert the nonlinear transfer: piecewise function switches at the
  // epsilon threshold to maintain continuity between linear and cubic regions
  const normalizedX = transferX ** 3 > epsilon ? transferX ** 3 : (116 * transferX - 16) / kappa;
  const normalizedY = L > kappa * epsilon ? transferY ** 3 : L / kappa;
  const normalizedZ = transferZ ** 3 > epsilon ? transferZ ** 3 : (116 * transferZ - 16) / kappa;

  return [normalizedX * whiteX, normalizedY * whiteY, normalizedZ * whiteZ];
}

// --- Parsing ---

function parseComponent(input: string): number {
  input = input.trim();
  if (input === "none") return 0;
  if (input.endsWith("%")) return parseFloat(input) / 100;
  return parseFloat(input);
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
    return inner.split(",").map((part) => part.trim());
  }
  return inner
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
}

function validOklab(color: OklabColor): OklabColor | null {
  return Number.isFinite(color.L) && Number.isFinite(color.a) && Number.isFinite(color.b)
    ? color
    : null;
}

function tupleToOklab(tuple: ColorTuple, alpha: number): OklabColor | null {
  return validOklab({ L: tuple[0], a: tuple[1], b: tuple[2], alpha });
}

function parseHexColor(normalized: string): OklabColor | null {
  const hexMatch = normalized.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (!hexMatch) return null;

  let hex = hexMatch[1];
  if (hex.length <= 4) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return tupleToOklab(srgbToOklab(red, green, blue), alpha);
}

function parseRgb(funcName: string, components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  let red = parseFloat(components[0]);
  let green = parseFloat(components[1]);
  let blue = parseFloat(components[2]);
  if (components[0].includes("%")) red = (red / 100) * 255;
  if (components[1].includes("%")) green = (green / 100) * 255;
  if (components[2].includes("%")) blue = (blue / 100) * 255;
  const alphaValue =
    funcName === "rgba" && components.length >= 4 ? parseComponent(components[3]) : alpha;
  return tupleToOklab(srgbToOklab(red / 255, green / 255, blue / 255), alphaValue);
}

function parseHsl(funcName: string, components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const h = parseFloat(components[0]);
  const saturation = parseFloat(components[1]) / 100;
  const lightness = parseFloat(components[2]) / 100;
  const alphaValue =
    funcName === "hsla" && components.length >= 4 ? parseComponent(components[3]) : alpha;
  return tupleToOklab(hslToOklab(h, saturation, lightness), alphaValue);
}

function parseHwb(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const h = parseFloat(components[0]);
  const w = parseFloat(components[1]) / 100;
  const bk = parseFloat(components[2]) / 100;
  return tupleToOklab(hwbToOklab(h, w, bk), alpha);
}

function parseOklabFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseComponent(components[0]);
  const aChannel = parseFloat(components[1]);
  const bChannel = parseFloat(components[2]);
  return validOklab({ L, a: aChannel, b: bChannel, alpha });
}

function parseOklch(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseComponent(components[0]);
  const C = parseFloat(components[1]);
  const H = parseFloat(components[2]);
  return tupleToOklab(oklchToOklab(L, C, H), alpha);
}

function parseLabFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseFloat(components[0]);
  const aChannel = parseFloat(components[1]);
  const bChannel = parseFloat(components[2]);
  return tupleToOklab(labToOklab(L, aChannel, bChannel), alpha);
}

function parseLch(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseFloat(components[0]);
  const C = parseFloat(components[1]);
  const H = parseFloat(components[2]);
  return tupleToOklab(lchToOklab(L, C, H), alpha);
}

function parseColorFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 4) return null;
  const space = components[0];
  const channel1 = parseFloat(components[1]);
  const channel2 = parseFloat(components[2]);
  const channel3 = parseFloat(components[3]);

  if (space === "srgb") return tupleToOklab(srgbToOklab(channel1, channel2, channel3), alpha);
  if (space === "srgb-linear")
    return tupleToOklab(linearSrgbToOklab(channel1, channel2, channel3), alpha);
  if (space === "display-p3")
    return tupleToOklab(displayP3ToOklab(channel1, channel2, channel3), alpha);
  return null;
}

export function parseColor(css: string): OklabColor | null {
  const normalized = css.trim().toLowerCase();

  const hexResult = parseHexColor(normalized);
  if (hexResult) return hexResult;

  // Functional notation: extract function name and inner content
  const funcMatch = normalized.match(/^([a-z][a-z0-9-]*)\((.+)\)$/);
  if (!funcMatch) return null;

  const funcName = funcMatch[1];
  const args = splitArgs(funcMatch[2]);
  const alpha = parseAlpha(args, 1);
  const slashIdx = args.indexOf("/");
  const components = slashIdx !== -1 ? args.slice(0, slashIdx) : args;

  if (funcName === "rgb" || funcName === "rgba") return parseRgb(funcName, components, alpha);
  if (funcName === "hsl" || funcName === "hsla") return parseHsl(funcName, components, alpha);
  if (funcName === "hwb") return parseHwb(components, alpha);
  if (funcName === "oklab") return parseOklabFunc(components, alpha);
  if (funcName === "oklch") return parseOklch(components, alpha);
  if (funcName === "lab") return parseLabFunc(components, alpha);
  if (funcName === "lch") return parseLch(components, alpha);
  if (funcName === "color") return parseColorFunc(components, alpha);

  return null;
}

export function parseLightDark(css: string): { light: string; dark: string } | null {
  const normalized = css.trim();
  const match = normalized.match(/^light-dark\((.+)\)$/i);
  if (!match) return null;

  // Split on top-level comma (skip commas inside nested parentheses)
  const inner = match[1];
  let depth = 0;
  let splitIdx = -1;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
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

// Euclidean distance in OKLab: sqrt((L1-L2)² + (a1-a2)² + (b1-b2)²).
// Because OKLab is perceptually uniform, raw Euclidean distance directly
// corresponds to perceived color difference (unlike sRGB which needs
// weighted approximations like the "redmean" formula).
// Scaled by 256 so thresholds remain comparable to the old redmean metric.
export function colorDistanceOklab(colorA: OklabColor, colorB: OklabColor): number {
  const deltaLightness = colorA.L - colorB.L;
  const deltaGreenRed = colorA.a - colorB.a;
  const deltaBlueYellow = colorA.b - colorB.b;
  return (
    Math.sqrt(
      deltaLightness * deltaLightness +
        deltaGreenRed * deltaGreenRed +
        deltaBlueYellow * deltaBlueYellow,
    ) * 256
  );
}
