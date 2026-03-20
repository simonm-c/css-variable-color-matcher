import { expect } from "vitest";
import type { OklabColor } from "../src/utilities/colorParsing/index.ts";

export function expectOklabClose(actual: OklabColor, expected: OklabColor, decimals = 3) {
  expect(actual.L).toBeCloseTo(expected.L, decimals);
  expect(actual.a).toBeCloseTo(expected.a, decimals);
  expect(actual.b).toBeCloseTo(expected.b, decimals);
  expect(actual.alpha).toBeCloseTo(expected.alpha, decimals);
}

export function expectOklabMatch(a: OklabColor, b: OklabColor, decimals = 2) {
  expect(a.L).toBeCloseTo(b.L, decimals);
  expect(a.a).toBeCloseTo(b.a, decimals);
  expect(a.b).toBeCloseTo(b.b, decimals);
}
