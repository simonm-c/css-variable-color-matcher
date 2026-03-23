import { describe, it, expect } from "vitest";
import { parseCssCustomProperties, deduplicateVariables } from "../index.ts";

describe("parseCssCustomProperties", () => {
  it("parses simple :root block", () => {
    const result = parseCssCustomProperties(
      `:root { --color-red: #ff0000; --color-blue: #0000ff; }`,
    );
    expect(result).toEqual([
      { name: "--color-red", value: "#ff0000" },
      { name: "--color-blue", value: "#0000ff" },
    ]);
  });

  it("handles nested @layer blocks", () => {
    const css = `@layer theme { :root { --color-brand: blue; } }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--color-brand", value: "blue" }]);
  });

  it("handles nested @media blocks", () => {
    const css = `@media (prefers-color-scheme: dark) { :root { --bg: #000; } }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--bg", value: "#000" }]);
  });

  it("handles nested @supports blocks", () => {
    const css = `@supports (color: oklch(0 0 0)) { :root { --accent: oklch(0.6 0.2 25); } }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--accent", value: "oklch(0.6 0.2 25)" }]);
  });

  it("strips CSS comments", () => {
    const css = `:root { /* primary color */ --color-primary: #1a73e8; /* end */ }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--color-primary", value: "#1a73e8" }]);
  });

  it("ignores non-custom properties", () => {
    const css = `:root { color: red; --custom: blue; font-size: 16px; }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--custom", value: "blue" }]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCssCustomProperties("")).toEqual([]);
  });

  it("returns empty array for CSS with no custom properties", () => {
    expect(parseCssCustomProperties("body { color: red; }")).toEqual([]);
  });

  it("handles values with var() references", () => {
    const css = `:root { --color-brand: var(--color-blue-600); }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--color-brand", value: "var(--color-blue-600)" }]);
  });

  it("handles values with url()", () => {
    const css = `:root { --bg-image: url("data:image/svg+xml;base64,abc"); }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--bg-image", value: 'url("data:image/svg+xml;base64,abc")' }]);
  });

  it("handles light-dark() values", () => {
    const css = `:root { --text: light-dark(#000, #fff); }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--text", value: "light-dark(#000, #fff)" }]);
  });

  it("handles multiple selectors with same variable", () => {
    const css = `
      :root { --color: red; }
      .dark { --color: blue; }
    `;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([
      { name: "--color", value: "red" },
      { name: "--color", value: "blue" },
    ]);
  });

  it("handles deeply nested @-rules", () => {
    const css = `@layer theme { @supports (color: red) { @media screen { :root { --deep: green; } } } }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--deep", value: "green" }]);
  });

  it("handles @import (skips without crashing)", () => {
    const css = `@import url("other.css"); :root { --foo: bar; }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--foo", value: "bar" }]);
  });

  it("handles value terminated by closing brace", () => {
    const css = `:root { --no-semicolon: red }`;
    const result = parseCssCustomProperties(css);
    expect(result).toEqual([{ name: "--no-semicolon", value: "red" }]);
  });
});

describe("deduplicateVariables", () => {
  it("removes exact duplicates (same name + same value)", () => {
    const result = deduplicateVariables([
      { name: "--a", value: "red" },
      { name: "--a", value: "red" },
      { name: "--b", value: "blue" },
    ]);
    expect(result).toEqual([
      { name: "--a", value: "red" },
      { name: "--b", value: "blue" },
    ]);
  });

  it("keeps entries with same name but different values", () => {
    const result = deduplicateVariables([
      { name: "--a", value: "red" },
      { name: "--a", value: "blue" },
    ]);
    expect(result).toEqual([
      { name: "--a", value: "red" },
      { name: "--a", value: "blue" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateVariables([])).toEqual([]);
  });

  it("preserves insertion order", () => {
    const result = deduplicateVariables([
      { name: "--c", value: "3" },
      { name: "--a", value: "1" },
      { name: "--b", value: "2" },
      { name: "--a", value: "1" },
    ]);
    expect(result).toEqual([
      { name: "--c", value: "3" },
      { name: "--a", value: "1" },
      { name: "--b", value: "2" },
    ]);
  });
});
