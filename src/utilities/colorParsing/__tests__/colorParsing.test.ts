import { describe, it, expect } from "vitest";
import { parseColor, parseLightDark, colorDistanceOklab } from "../index.ts";
import { expectOklabClose, expectOklabMatch } from "../../../../test/fixtures.ts";

// --- parseColor: hex ---

describe("parseColor — hex", () => {
  it("parses 3-digit hex (white)", () => {
    const c = parseColor("#fff")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(1.0, 2);
    expect(c.a).toBeCloseTo(0, 2);
    expect(c.b).toBeCloseTo(0, 2);
    expect(c.alpha).toBe(1);
  });

  it("parses 3-digit hex (black)", () => {
    const c = parseColor("#000")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0, 2);
  });

  it("parses 6-digit hex (red)", () => {
    const c = parseColor("#ff0000")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeGreaterThan(0.4);
    expect(c.alpha).toBe(1);
  });

  it("parses 8-digit hex with alpha", () => {
    const c = parseColor("#ff000080")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(128 / 255, 2);
  });

  it("parses 4-digit hex with alpha", () => {
    const c = parseColor("#f008")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0x88 / 255, 2);
  });

  it("returns null for invalid hex chars", () => {
    expect(parseColor("#GGG")).toBeNull();
  });

  it("returns null for invalid hex length", () => {
    expect(parseColor("#12345")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseColor("")).toBeNull();
  });

  it("returns null for non-color string", () => {
    expect(parseColor("not-a-color")).toBeNull();
  });

  it("trims whitespace", () => {
    const c = parseColor("  #fff  ");
    expect(c).not.toBeNull();
  });

  it("is case-insensitive", () => {
    const lower = parseColor("#ff0000")!;
    const upper = parseColor("#FF0000")!;
    expectOklabClose(lower, upper);
  });
});

// --- parseColor: rgb/rgba ---

describe("parseColor — rgb/rgba", () => {
  it("parses comma-separated rgb", () => {
    const c = parseColor("rgb(255, 0, 0)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabClose(c, hex);
  });

  it("parses space-separated rgb", () => {
    const c = parseColor("rgb(255 0 0)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabClose(c, hex);
  });

  it("parses percentage rgb", () => {
    const c = parseColor("rgb(100%, 0%, 0%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabClose(c, hex);
  });

  it("parses rgba with alpha", () => {
    const c = parseColor("rgba(255, 0, 0, 0.5)")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0.5, 2);
  });

  it("parses slash-alpha syntax", () => {
    const c = parseColor("rgb(255 0 0 / 0.5)")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0.5, 2);
  });

  it("parses black", () => {
    const c = parseColor("rgb(0, 0, 0)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0, 2);
  });

  it("parses white", () => {
    const c = parseColor("rgb(255, 255, 255)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(1, 2);
  });

  it("returns null for too few args", () => {
    expect(parseColor("rgb(255, 0)")).toBeNull();
  });

  it("is case-insensitive", () => {
    const c = parseColor("RGB(255, 0, 0)");
    expect(c).not.toBeNull();
  });
});

// --- parseColor: hsl/hsla ---

describe("parseColor — hsl/hsla", () => {
  it("parses red (hue 0)", () => {
    const c = parseColor("hsl(0, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabMatch(c, hex);
  });

  it("parses green (hue 120)", () => {
    const c = parseColor("hsl(120, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#00ff00")!;
    expectOklabMatch(c, hex);
  });

  it("parses blue (hue 240)", () => {
    const c = parseColor("hsl(240, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#0000ff")!;
    expectOklabMatch(c, hex);
  });

  it("parses yellow (hue 60)", () => {
    const c = parseColor("hsl(60, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ffff00")!;
    expectOklabMatch(c, hex);
  });

  it("parses cyan (hue 180)", () => {
    const c = parseColor("hsl(180, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#00ffff")!;
    expectOklabMatch(c, hex);
  });

  it("parses magenta (hue 300)", () => {
    const c = parseColor("hsl(300, 100%, 50%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff00ff")!;
    expectOklabMatch(c, hex);
  });

  it("parses grey (zero saturation)", () => {
    const c = parseColor("hsl(0, 0%, 50%)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0, 2);
    expect(c.b).toBeCloseTo(0, 2);
  });

  it("handles hue wraparound at 360", () => {
    const h0 = parseColor("hsl(0, 100%, 50%)")!;
    const h360 = parseColor("hsl(360, 100%, 50%)")!;
    expectOklabClose(h0, h360);
  });

  it("handles negative hue", () => {
    const hNeg = parseColor("hsl(-60, 100%, 50%)")!;
    const h300 = parseColor("hsl(300, 100%, 50%)")!;
    expectOklabClose(hNeg, h300);
  });

  it("parses hsla with alpha", () => {
    const c = parseColor("hsla(0, 100%, 50%, 0.5)")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0.5, 2);
  });
});

// --- parseColor: hwb ---

describe("parseColor — hwb", () => {
  it("parses red (hwb 0 0% 0%)", () => {
    const c = parseColor("hwb(0 0% 0%)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabMatch(c, hex);
  });

  it("parses white (100% whiteness)", () => {
    const c = parseColor("hwb(0 100% 0%)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(1, 2);
  });

  it("parses black (100% blackness)", () => {
    const c = parseColor("hwb(0 0% 100%)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0, 2);
  });

  it("handles grey when w + bk = 1", () => {
    const c = parseColor("hwb(0 50% 50%)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0, 2);
    expect(c.b).toBeCloseTo(0, 2);
  });

  it("handles grey when w + bk > 1 (normalized)", () => {
    const c = parseColor("hwb(0 60% 60%)")!;
    expect(c).not.toBeNull();
    // Should be grey = 60/(60+60) = 0.5
    const grey50 = parseColor("hwb(0 50% 50%)")!;
    expectOklabClose(c, grey50);
  });
});

// --- parseColor: oklab ---

describe("parseColor — oklab", () => {
  it("parses oklab with numeric components", () => {
    const c = parseColor("oklab(0.5 0.1 -0.1)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0.5, 3);
    expect(c.a).toBeCloseTo(0.1, 3);
    expect(c.b).toBeCloseTo(-0.1, 3);
    expect(c.alpha).toBe(1);
  });

  it("parses percentage L component", () => {
    const c = parseColor("oklab(50% 0.1 -0.1)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0.5, 3);
  });

  it("parses slash-alpha", () => {
    const c = parseColor("oklab(0.5 0.1 -0.1 / 0.5)")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0.5, 3);
  });

  it("parses 'none' keyword as 0", () => {
    const c = parseColor("oklab(none 0.1 -0.1)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBe(0);
  });
});

// --- parseColor: oklch ---

describe("parseColor — oklch", () => {
  it("parses oklch hue 0 (positive a, b≈0)", () => {
    const c = parseColor("oklch(0.5 0.2 0)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0.2, 2);
    expect(c.b).toBeCloseTo(0, 2);
  });

  it("parses oklch hue 90 (a≈0, positive b)", () => {
    const c = parseColor("oklch(0.5 0.2 90)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0, 2);
    expect(c.b).toBeCloseTo(0.2, 2);
  });

  it("parses oklch hue 180 (negative a, b≈0)", () => {
    const c = parseColor("oklch(0.5 0.2 180)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(-0.2, 2);
    expect(c.b).toBeCloseTo(0, 2);
  });

  it("parses achromatic oklch (chroma 0)", () => {
    const c = parseColor("oklch(0.5 0 0)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0, 3);
    expect(c.b).toBeCloseTo(0, 3);
  });
});

// --- parseColor: lab/lch ---

describe("parseColor — lab/lch", () => {
  it("parses lab mid-grey", () => {
    const c = parseColor("lab(50 0 0)")!;
    expect(c).not.toBeNull();
    expect(c.a).toBeCloseTo(0, 1);
    expect(c.b).toBeCloseTo(0, 1);
  });

  it("parses lab white", () => {
    const c = parseColor("lab(100 0 0)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(1, 1);
  });

  it("parses lab black", () => {
    const c = parseColor("lab(0 0 0)")!;
    expect(c).not.toBeNull();
    expect(c.L).toBeCloseTo(0, 1);
  });

  it("parses lch achromatic (same as lab achromatic)", () => {
    const lab = parseColor("lab(50 0 0)")!;
    const lch = parseColor("lch(50 0 0)")!;
    expectOklabClose(lab, lch);
  });

  it("parses lch with chroma", () => {
    const c = parseColor("lch(50 50 0)")!;
    expect(c).not.toBeNull();
    // Non-zero chroma at hue 0 should produce positive a
    expect(c.a).not.toBeCloseTo(0, 1);
  });
});

// --- parseColor: color() function ---

describe("parseColor — color()", () => {
  it("parses color(srgb 1 0 0) as red", () => {
    const c = parseColor("color(srgb 1 0 0)")!;
    expect(c).not.toBeNull();
    const hex = parseColor("#ff0000")!;
    expectOklabClose(c, hex);
  });

  it("parses color(srgb-linear 1 0 0)", () => {
    const c = parseColor("color(srgb-linear 1 0 0)")!;
    expect(c).not.toBeNull();
    // linear sRGB red is different from gamma sRGB red in OKLab
    expect(c.L).toBeGreaterThan(0);
  });

  it("parses color(display-p3 1 0 0)", () => {
    const c = parseColor("color(display-p3 1 0 0)")!;
    expect(c).not.toBeNull();
    // P3 red has a wider gamut than sRGB red
    const srgbRed = parseColor("color(srgb 1 0 0)")!;
    // They should differ
    expect(c.L).not.toBeCloseTo(srgbRed.L, 3);
  });

  it("parses color(srgb) with alpha", () => {
    const c = parseColor("color(srgb 0.5 0.5 0.5 / 0.5)")!;
    expect(c).not.toBeNull();
    expect(c.alpha).toBeCloseTo(0.5, 3);
  });

  it("returns null for unknown color space", () => {
    expect(parseColor("color(unknown 1 0 0)")).toBeNull();
  });
});

// --- parseColor: too few components (per-parser null paths) ---

describe("parseColor — insufficient components", () => {
  it("returns null for rgb with too few args", () => {
    expect(parseColor("rgb(255, 0)")).toBeNull();
  });

  it("returns null for hsl with too few args", () => {
    expect(parseColor("hsl(0, 100%)")).toBeNull();
  });

  it("returns null for hwb with too few args", () => {
    expect(parseColor("hwb(0 50%)")).toBeNull();
  });

  it("returns null for oklab with too few args", () => {
    expect(parseColor("oklab(0.5 0.1)")).toBeNull();
  });

  it("returns null for oklch with too few args", () => {
    expect(parseColor("oklch(0.5 0.2)")).toBeNull();
  });

  it("returns null for lab with too few args", () => {
    expect(parseColor("lab(50 0)")).toBeNull();
  });

  it("returns null for lch with too few args", () => {
    expect(parseColor("lch(50 50)")).toBeNull();
  });

  it("returns null for color() with too few args", () => {
    expect(parseColor("color(srgb 1 0)")).toBeNull();
  });
});

// --- parseColor: unrecognised function name ---

describe("parseColor — unrecognised function", () => {
  it("returns null for unknown function name", () => {
    expect(parseColor("xyz(1 2 3)")).toBeNull();
  });

  it("returns null for light-dark() (handled by parseLightDark, not parseColor)", () => {
    expect(parseColor("light-dark(#fff, #000)")).toBeNull();
  });
});

// --- parseColor: NaN/edge cases ---

describe("parseColor — edge cases / validOklab", () => {
  it("returns null for Infinity component", () => {
    expect(parseColor("rgb(Infinity, 0, 0)")).toBeNull();
  });

  it("returns null for NaN component via hsl", () => {
    expect(parseColor("hsl(0, NaN%, 50%)")).toBeNull();
  });

  it("returns null for NaN in oklab", () => {
    expect(parseColor("oklab(NaN 0 0)")).toBeNull();
  });

  it("returns null for NaN in oklch", () => {
    expect(parseColor("oklch(NaN 0 0)")).toBeNull();
  });

  it("returns null for NaN in lab", () => {
    expect(parseColor("lab(NaN 0 0)")).toBeNull();
  });

  it("returns null for NaN in lch", () => {
    expect(parseColor("lch(NaN 0 0)")).toBeNull();
  });

  it("returns null for NaN in hwb", () => {
    expect(parseColor("hwb(NaN 0% 0%)")).toBeNull();
  });

  it("returns null for NaN in color(srgb)", () => {
    expect(parseColor("color(srgb NaN 0 0)")).toBeNull();
  });
});

// --- Cross-format consistency ---

describe("parseColor — cross-format consistency", () => {
  it("red is consistent across hex, rgb, hsl, hwb, color(srgb)", () => {
    const hex = parseColor("#ff0000")!;
    const rgb = parseColor("rgb(255, 0, 0)")!;
    const hsl = parseColor("hsl(0, 100%, 50%)")!;
    const hwb = parseColor("hwb(0 0% 0%)")!;
    const srgb = parseColor("color(srgb 1 0 0)")!;

    expectOklabMatch(hex, rgb);
    expectOklabMatch(hex, hsl);
    expectOklabMatch(hex, hwb);
    expectOklabMatch(hex, srgb);
  });

  it("white is consistent across formats", () => {
    const hex = parseColor("#ffffff")!;
    const rgb = parseColor("rgb(255, 255, 255)")!;
    const hsl = parseColor("hsl(0, 0%, 100%)")!;
    const hwb = parseColor("hwb(0 100% 0%)")!;

    expectOklabMatch(hex, rgb);
    expectOklabMatch(hex, hsl);
    expectOklabMatch(hex, hwb);
  });

  it("black is consistent across formats", () => {
    const hex = parseColor("#000000")!;
    const rgb = parseColor("rgb(0, 0, 0)")!;
    const hsl = parseColor("hsl(0, 0%, 0%)")!;
    const hwb = parseColor("hwb(0 0% 100%)")!;

    expectOklabMatch(hex, rgb);
    expectOklabMatch(hex, hsl);
    expectOklabMatch(hex, hwb);
  });
});

// --- parseLightDark ---

describe("parseLightDark", () => {
  it("parses basic light-dark()", () => {
    const r = parseLightDark("light-dark(#fff, #000)");
    expect(r).toEqual({ light: "#fff", dark: "#000" });
  });

  it("trims whitespace from values", () => {
    const r = parseLightDark("light-dark( #fff , #000 )");
    expect(r).toEqual({ light: "#fff", dark: "#000" });
  });

  it("handles nested commas inside functions", () => {
    const r = parseLightDark("light-dark(rgb(255,0,0), rgb(0,0,255))");
    expect(r).toEqual({ light: "rgb(255,0,0)", dark: "rgb(0,0,255)" });
  });

  it("is case-insensitive", () => {
    const r = parseLightDark("LIGHT-DARK(#fff, #000)");
    expect(r).toEqual({ light: "#fff", dark: "#000" });
  });

  it("returns null for missing comma", () => {
    expect(parseLightDark("light-dark(#fff)")).toBeNull();
  });

  it("returns null for empty light value", () => {
    expect(parseLightDark("light-dark(, #000)")).toBeNull();
  });

  it("returns null for empty dark value", () => {
    expect(parseLightDark("light-dark(#fff, )")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLightDark("")).toBeNull();
  });

  it("returns null for non-light-dark function", () => {
    expect(parseLightDark("rgb(255, 0, 0)")).toBeNull();
  });
});

// --- colorDistanceOklab ---

describe("colorDistanceOklab", () => {
  it("returns 0 for identical colors", () => {
    const c = parseColor("#ff0000")!;
    expect(colorDistanceOklab(c, c)).toBe(0);
  });

  it("returns ~256 for black vs white (L diff ≈ 1.0)", () => {
    const black = parseColor("#000000")!;
    const white = parseColor("#ffffff")!;
    const dist = colorDistanceOklab(black, white);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(300);
  });

  it("is symmetric", () => {
    const a = parseColor("#ff0000")!;
    const b = parseColor("#0000ff")!;
    expect(colorDistanceOklab(a, b)).toBeCloseTo(colorDistanceOklab(b, a), 10);
  });

  it("ignores alpha (colors differing only in alpha have distance 0)", () => {
    const a = parseColor("#ff0000")!;
    const b = { ...a, alpha: 0 };
    expect(colorDistanceOklab(a, b)).toBe(0);
  });

  it("similar colors have small distance", () => {
    const a = parseColor("#ff0000")!;
    const b = parseColor("#fe0101")!;
    expect(colorDistanceOklab(a, b)).toBeLessThan(5);
  });
});
