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

// --- Transfer functions ---
// Each color space defines a transfer function (gamma curve) mapping
// gamma-encoded values [0, 1] to linear light values [0, 1].

// Adobe RGB (1998) gamma: simple power curve with exponent 563/256 ≈ 2.1992.
// Source: Adobe RGB (1998) Color Image Encoding, Section 4.3.5.2
function a98RgbToLinear(channel: number): number {
  return Math.pow(Math.abs(channel), 563 / 256) * Math.sign(channel);
}

// ProPhoto RGB transfer: piecewise function with gamma 1.8.
// Source: Kodak ProPhoto RGB specification / ROMM RGB (ISO 22028-2)
// linear = value / 16             when value < 16 * (1/512)
// linear = value^1.8              otherwise
function proPhotoToLinear(channel: number): number {
  const absolute = Math.abs(channel);
  if (absolute < 16 / 512) return channel / 16;
  return Math.pow(absolute, 1.8) * Math.sign(channel);
}

// ITU-R BT.2020 transfer: piecewise function similar to BT.709.
// Source: Recommendation ITU-R BT.2020-2, Table 4
// The constants alpha and beta provide continuity at the transition.
// linear = value / 4.5                           when value < beta
// linear = ((value + (alpha - 1)) / alpha)^(1/0.45)  otherwise
function rec2020ToLinear(channel: number): number {
  // Named per the BT.2020 spec — not related to color alpha/opacity
  const bt2020Alpha = 1.09929682680944;
  const bt2020Beta = 0.018053968510807;
  const absolute = Math.abs(channel);
  if (absolute < bt2020Beta * 4.5) return channel / 4.5;
  return Math.pow((absolute + bt2020Alpha - 1) / bt2020Alpha, 1 / 0.45) * Math.sign(channel);
}

// --- Conversion matrices ---
// These 3x3 matrices transform between color spaces via matrix multiplication.
// Each maps a [channel1, channel2, channel3] tuple from one space to another.
// Sources: CSS Color Level 4 spec (https://www.w3.org/TR/css-color-4/#color-to-absolute-color)
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

// Linear Adobe RGB (1998) -> XYZ D65
// Source: CSS Color Level 4 §10.4
const A98_TO_XYZ: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.5766690429101305, 0.1855582379065463, 0.1882286462349947],
  [0.29734497525053605, 0.6273635662554661, 0.07529145849399788],
  [0.02703136138641234, 0.07068885253582723, 0.9913375368376388],
];

// Linear ProPhoto RGB -> XYZ D50 (note: D50, not D65)
// Source: CSS Color Level 4 §10.5
const PROPHOTO_TO_XYZ_D50: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.7977604896723027, 0.13518583717574031, 0.0313493495815248],
  [0.2880711282292934, 0.7118432178101014, 0.00008565396060525902],
  [0.0, 0.0, 0.8251046025104602],
];

// Linear Rec. 2020 -> XYZ D65
// Source: CSS Color Level 4 §10.6
const REC2020_TO_XYZ: [ColorTuple, ColorTuple, ColorTuple] = [
  [0.6369580483012914, 0.14461690358620832, 0.1688809751641721],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0.0, 0.028072693049087428, 1.0609850577107909],
];

// Bradford chromatic adaptation: XYZ D50 -> XYZ D65
// Used for ProPhoto RGB and CIE Lab which use D50 illuminant.
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

function linearDisplayP3ToOklab(r: number, g: number, b: number): ColorTuple {
  const xyz = multiplyMatrix(P3_TO_XYZ, [r, g, b]);
  return xyzD65ToOklab(xyz);
}

function a98RgbToOklab(r: number, g: number, b: number): ColorTuple {
  const xyz = multiplyMatrix(A98_TO_XYZ, [a98RgbToLinear(r), a98RgbToLinear(g), a98RgbToLinear(b)]);
  return xyzD65ToOklab(xyz);
}

function proPhotoToOklab(r: number, g: number, b: number): ColorTuple {
  // ProPhoto uses D50 illuminant — convert to D65 before OKLab pipeline
  const xyzD50 = multiplyMatrix(PROPHOTO_TO_XYZ_D50, [
    proPhotoToLinear(r),
    proPhotoToLinear(g),
    proPhotoToLinear(b),
  ]);
  const xyzD65 = multiplyMatrix(D50_TO_D65, xyzD50);
  return xyzD65ToOklab(xyzD65);
}

function rec2020ToOklab(r: number, g: number, b: number): ColorTuple {
  const xyz = multiplyMatrix(REC2020_TO_XYZ, [
    rec2020ToLinear(r),
    rec2020ToLinear(g),
    rec2020ToLinear(b),
  ]);
  return xyzD65ToOklab(xyz);
}

function xyzD50ToOklab(xyz: ColorTuple): ColorTuple {
  const xyzD65 = multiplyMatrix(D50_TO_D65, xyz);
  return xyzD65ToOklab(xyzD65);
}

function xyzD65ChannelsToOklab(x: number, y: number, z: number): ColorTuple {
  return xyzD65ToOklab([x, y, z]);
}

function xyzD50ChannelsToOklab(x: number, y: number, z: number): ColorTuple {
  return xyzD50ToOklab([x, y, z]);
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

// --- CSS named colors ---
// All 148 CSS named colors (147 keywords + transparent) from CSS Color Level 4 §6.1.
// https://www.w3.org/TR/css-color-4/#named-colors
// Each value is the 6-digit hex equivalent (without #).
const NAMED_COLORS: Record<string, string> = {
  aliceblue: "f0f8ff",
  antiquewhite: "faebd7",
  aqua: "00ffff",
  aquamarine: "7fffd4",
  azure: "f0ffff",
  beige: "f5f5dc",
  bisque: "ffe4c4",
  black: "000000",
  blanchedalmond: "ffebcd",
  blue: "0000ff",
  blueviolet: "8a2be2",
  brown: "a52a2a",
  burlywood: "deb887",
  cadetblue: "5f9ea0",
  chartreuse: "7fff00",
  chocolate: "d2691e",
  coral: "ff7f50",
  cornflowerblue: "6495ed",
  cornsilk: "fff8dc",
  crimson: "dc143c",
  cyan: "00ffff",
  darkblue: "00008b",
  darkcyan: "008b8b",
  darkgoldenrod: "b8860b",
  darkgray: "a9a9a9",
  darkgreen: "006400",
  darkgrey: "a9a9a9",
  darkkhaki: "bdb76b",
  darkmagenta: "8b008b",
  darkolivegreen: "556b2f",
  darkorange: "ff8c00",
  darkorchid: "9932cc",
  darkred: "8b0000",
  darksalmon: "e9967a",
  darkseagreen: "8fbc8f",
  darkslateblue: "483d8b",
  darkslategray: "2f4f4f",
  darkslategrey: "2f4f4f",
  darkturquoise: "00ced1",
  darkviolet: "9400d3",
  deeppink: "ff1493",
  deepskyblue: "00bfff",
  dimgray: "696969",
  dimgrey: "696969",
  dodgerblue: "1e90ff",
  firebrick: "b22222",
  floralwhite: "fffaf0",
  forestgreen: "228b22",
  fuchsia: "ff00ff",
  gainsboro: "dcdcdc",
  ghostwhite: "f8f8ff",
  gold: "ffd700",
  goldenrod: "daa520",
  gray: "808080",
  green: "008000",
  greenyellow: "adff2f",
  grey: "808080",
  honeydew: "f0fff0",
  hotpink: "ff69b4",
  indianred: "cd5c5c",
  indigo: "4b0082",
  ivory: "fffff0",
  khaki: "f0e68c",
  lavender: "e6e6fa",
  lavenderblush: "fff0f5",
  lawngreen: "7cfc00",
  lemonchiffon: "fffacd",
  lightblue: "add8e6",
  lightcoral: "f08080",
  lightcyan: "e0ffff",
  lightgoldenrodyellow: "fafad2",
  lightgray: "d3d3d3",
  lightgreen: "90ee90",
  lightgrey: "d3d3d3",
  lightpink: "ffb6c1",
  lightsalmon: "ffa07a",
  lightseagreen: "20b2aa",
  lightskyblue: "87cefa",
  lightslategray: "778899",
  lightslategrey: "778899",
  lightsteelblue: "b0c4de",
  lightyellow: "ffffe0",
  lime: "00ff00",
  limegreen: "32cd32",
  linen: "faf0e6",
  magenta: "ff00ff",
  maroon: "800000",
  mediumaquamarine: "66cdaa",
  mediumblue: "0000cd",
  mediumorchid: "ba55d3",
  mediumpurple: "9370db",
  mediumseagreen: "3cb371",
  mediumslateblue: "7b68ee",
  mediumspringgreen: "00fa9a",
  mediumturquoise: "48d1cc",
  mediumvioletred: "c71585",
  midnightblue: "191970",
  mintcream: "f5fffa",
  mistyrose: "ffe4e1",
  moccasin: "ffe4b5",
  navajowhite: "ffdead",
  navy: "000080",
  oldlace: "fdf5e6",
  olive: "808000",
  olivedrab: "6b8e23",
  orange: "ffa500",
  orangered: "ff4500",
  orchid: "da70d6",
  palegoldenrod: "eee8aa",
  palegreen: "98fb98",
  paleturquoise: "afeeee",
  palevioletred: "db7093",
  papayawhip: "ffefd5",
  peachpuff: "ffdab9",
  peru: "cd853f",
  pink: "ffc0cb",
  plum: "dda0dd",
  powderblue: "b0e0e6",
  purple: "800080",
  rebeccapurple: "663399",
  red: "ff0000",
  rosybrown: "bc8f8f",
  royalblue: "4169e1",
  saddlebrown: "8b4513",
  salmon: "fa8072",
  sandybrown: "f4a460",
  seagreen: "2e8b57",
  seashell: "fff5ee",
  sienna: "a0522d",
  silver: "c0c0c0",
  skyblue: "87ceeb",
  slateblue: "6a5acd",
  slategray: "708090",
  slategrey: "708090",
  snow: "fffafa",
  springgreen: "00ff7f",
  steelblue: "4682b4",
  tan: "d2b48c",
  teal: "008080",
  thistle: "d8bfd8",
  tomato: "ff6347",
  turquoise: "40e0d0",
  violet: "ee82ee",
  wheat: "f5deb3",
  white: "ffffff",
  whitesmoke: "f5f5f5",
  yellow: "ffff00",
  yellowgreen: "9acd32",
};

// --- Parsing ---

// Parse a CSS color component value. Handles the `none` keyword (= 0, per
// CSS Color 4 §4.4) and percentage values (mapped to 0-1 range).
// Used for channels where % maps linearly to [0, 1]: oklab L, color() channels, alpha.
function parseComponent(input: string): number {
  input = input.trim();
  if (input === "none") return 0;
  if (input.endsWith("%")) return parseFloat(input) / 100;
  return parseFloat(input);
}

// Parse a component where `none` = 0 but percentage handling is done by the caller.
// Used for rgb, hsl, hwb, lab, lch, oklch channels where % has non-standard scaling.
function parseNumberOrNone(input: string): number {
  input = input.trim();
  if (input === "none") return 0;
  return parseFloat(input);
}

// Parse CIE Lab/LCH lightness: numeric 0-100 or percentage where 100% = 100.
function parseLabLightness(input: string): number {
  input = input.trim();
  if (input === "none") return 0;
  if (input.endsWith("%")) return parseFloat(input);
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
  let red = parseNumberOrNone(components[0]);
  let green = parseNumberOrNone(components[1]);
  let blue = parseNumberOrNone(components[2]);
  if (components[0].includes("%")) red = (red / 100) * 255;
  if (components[1].includes("%")) green = (green / 100) * 255;
  if (components[2].includes("%")) blue = (blue / 100) * 255;
  const alphaValue =
    funcName === "rgba" && components.length >= 4 ? parseComponent(components[3]) : alpha;
  return tupleToOklab(srgbToOklab(red / 255, green / 255, blue / 255), alphaValue);
}

function parseHsl(funcName: string, components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const h = parseNumberOrNone(components[0]);
  const saturation = parseNumberOrNone(components[1]) / 100;
  const lightness = parseNumberOrNone(components[2]) / 100;
  const alphaValue =
    funcName === "hsla" && components.length >= 4 ? parseComponent(components[3]) : alpha;
  return tupleToOklab(hslToOklab(h, saturation, lightness), alphaValue);
}

function parseHwb(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const h = parseNumberOrNone(components[0]);
  const w = parseNumberOrNone(components[1]) / 100;
  const bk = parseNumberOrNone(components[2]) / 100;
  return tupleToOklab(hwbToOklab(h, w, bk), alpha);
}

function parseOklabFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseComponent(components[0]);
  const aChannel = parseNumberOrNone(components[1]);
  const bChannel = parseNumberOrNone(components[2]);
  return validOklab({ L, a: aChannel, b: bChannel, alpha });
}

function parseOklch(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseComponent(components[0]);
  const C = parseNumberOrNone(components[1]);
  const H = parseNumberOrNone(components[2]);
  return tupleToOklab(oklchToOklab(L, C, H), alpha);
}

function parseLabFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseLabLightness(components[0]);
  const aChannel = parseNumberOrNone(components[1]);
  const bChannel = parseNumberOrNone(components[2]);
  return tupleToOklab(labToOklab(L, aChannel, bChannel), alpha);
}

function parseLch(components: string[], alpha: number): OklabColor | null {
  if (components.length < 3) return null;
  const L = parseLabLightness(components[0]);
  const C = parseNumberOrNone(components[1]);
  const H = parseNumberOrNone(components[2]);
  return tupleToOklab(lchToOklab(L, C, H), alpha);
}

// Maps CSS color() space identifiers to their conversion functions.
// Covers all predefined RGB and XYZ spaces from CSS Color Level 4 §10.
// https://www.w3.org/TR/css-color-4/#predefined
const colorSpaceConverters: Record<string, (r: number, g: number, b: number) => ColorTuple> = {
  srgb: srgbToOklab,
  "srgb-linear": linearSrgbToOklab,
  "display-p3": displayP3ToOklab,
  "display-p3-linear": linearDisplayP3ToOklab,
  "a98-rgb": a98RgbToOklab,
  "prophoto-rgb": proPhotoToOklab,
  rec2020: rec2020ToOklab,
  xyz: xyzD65ChannelsToOklab,
  "xyz-d65": xyzD65ChannelsToOklab,
  "xyz-d50": xyzD50ChannelsToOklab,
};

function parseColorFunc(components: string[], alpha: number): OklabColor | null {
  if (components.length < 4) return null;
  const space = components[0];
  const converter = colorSpaceConverters[space];
  if (!converter) return null;
  const channel1 = parseComponent(components[1]);
  const channel2 = parseComponent(components[2]);
  const channel3 = parseComponent(components[3]);
  return tupleToOklab(converter(channel1, channel2, channel3), alpha);
}

function parseNamedColor(normalized: string): OklabColor | null {
  if (normalized === "transparent") return { L: 0, a: 0, b: 0, alpha: 0 };
  const hex = NAMED_COLORS[normalized];
  if (!hex) return null;
  return parseHexColor("#" + hex);
}

export function parseColor(css: string): OklabColor | null {
  const normalized = css.trim().toLowerCase();

  const hexResult = parseHexColor(normalized);
  if (hexResult) return hexResult;

  const namedResult = parseNamedColor(normalized);
  if (namedResult) return namedResult;

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
