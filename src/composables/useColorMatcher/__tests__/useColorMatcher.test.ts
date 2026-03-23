import { describe, it, expect } from "vitest";
import { useColorMatcher, EXACT_DISTANCE_THRESHOLD, CLOSE_MATCHES_COUNT } from "../index.ts";
import type { ColorVariable } from "../../../utilities/cssParser/index.ts";

const { findMatches, isColorValue } = useColorMatcher();

describe("isColorValue", () => {
  it("returns true for hex colors", () => {
    expect(isColorValue("#ff0000")).toBe(true);
  });

  it("returns true for rgb colors", () => {
    expect(isColorValue("rgb(255, 0, 0)")).toBe(true);
  });

  it("returns true for light-dark() values", () => {
    expect(isColorValue("light-dark(#fff, #000)")).toBe(true);
  });

  it("returns false for non-color values", () => {
    expect(isColorValue("16px")).toBe(false);
    expect(isColorValue("1rem")).toBe(false);
    expect(isColorValue("normal")).toBe(false);
  });
});

describe("findMatches", () => {
  it("returns empty tiers for invalid picked color", () => {
    const result = findMatches("not-a-color", [{ name: "--a", value: "#ff0000" }]);
    expect(result.exact).toHaveLength(0);
    expect(result.close).toHaveLength(0);
    expect(result.far).toHaveLength(0);
  });

  it("returns empty tiers for empty vars", () => {
    const result = findMatches("#ff0000", []);
    expect(result.exact).toHaveLength(0);
    expect(result.close).toHaveLength(0);
    expect(result.far).toHaveLength(0);
  });

  it("finds exact match for identical color", () => {
    const result = findMatches("#ff0000", [{ name: "--color-red", value: "#ff0000" }]);
    expect(result.exact).toHaveLength(1);
    expect(result.exact[0].name).toBe("--color-red");
    expect(Math.round(result.exact[0].distance)).toBeLessThanOrEqual(EXACT_DISTANCE_THRESHOLD);
  });

  it("sorts matches by distance (closest first)", () => {
    const result = findMatches("#ff0000", [
      { name: "--far", value: "#0000ff" },
      { name: "--close", value: "#fe0101" },
      { name: "--exact", value: "#ff0000" },
    ]);
    const allMatches = [...result.exact, ...result.close, ...result.far];
    expect(allMatches[0].name).toBe("--exact");
  });

  it("handles light-dark() variables", () => {
    const result = findMatches("#ff0000", [
      { name: "--ld", value: "light-dark(#ff0000, #0000ff)" },
    ]);
    const allMatches = [...result.exact, ...result.close, ...result.far];
    expect(allMatches).toHaveLength(1);
    expect(allMatches[0].lightDark).toBeDefined();
    expect(allMatches[0].lightDark!.light).toBe("#ff0000");
    expect(allMatches[0].lightDark!.dark).toBe("#0000ff");
  });

  it("skips non-color variables", () => {
    const result = findMatches("#ff0000", [
      { name: "--spacing", value: "16px" },
      { name: "--color-red", value: "#ff0000" },
    ]);
    const allMatches = [...result.exact, ...result.close, ...result.far];
    expect(allMatches).toHaveLength(1);
    expect(allMatches[0].name).toBe("--color-red");
  });

  it("limits close and far tiers", () => {
    const vars: ColorVariable[] = [];
    for (let i = 0; i < 20; i++) {
      const hex = (i * 10).toString(16).padStart(2, "0");
      vars.push({ name: `--c${i}`, value: `#${hex}${hex}${hex}` });
    }
    const result = findMatches("#000000", vars);
    expect(result.close.length).toBeLessThanOrEqual(CLOSE_MATCHES_COUNT);
    expect(result.far.length).toBeLessThanOrEqual(CLOSE_MATCHES_COUNT);
  });

  it("handles duplicate variable names with different values", () => {
    const result = findMatches("#ff0000", [
      { name: "--color", value: "#ff0000" },
      { name: "--color", value: "#0000ff" },
    ]);
    const allMatches = [...result.exact, ...result.close, ...result.far];
    expect(allMatches).toHaveLength(2);
  });
});
