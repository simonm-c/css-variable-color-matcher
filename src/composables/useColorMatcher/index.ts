import {
  parseColor,
  parseLightDark,
  colorDistanceOklab,
} from "../../utilities/colorParsing/index.js";
import type { ColorVariable } from "../../utilities/cssParser/index.js";

export const EXACT_DISTANCE_THRESHOLD = 2;
export const CLOSE_MATCHES_COUNT = 5;

export interface ColorMatch {
  name: string;
  value: string;
  distance: number;
  lightDark?: { light: string; dark: string; lightDist: number; darkDist: number };
}

export interface TieredMatches {
  exact: ColorMatch[];
  close: ColorMatch[];
  far: ColorMatch[];
}

function isColorValue(value: string): boolean {
  return parseColor(value) !== null || parseLightDark(value) !== null;
}

function findMatches(pickedHex: string, vars: ColorVariable[]): TieredMatches {
  const pickedColor = parseColor(pickedHex);
  if (!pickedColor) return { exact: [], close: [], far: [] };

  const matches: ColorMatch[] = [];

  for (const { name, value } of vars) {
    const varColor = parseColor(value);
    if (varColor) {
      const distance = colorDistanceOklab(pickedColor, varColor);
      matches.push({ name, value, distance });
      continue;
    }

    const ld = parseLightDark(value);
    if (!ld) continue;
    const lightColor = parseColor(ld.light);
    const darkColor = parseColor(ld.dark);
    if (!lightColor && !darkColor) continue;

    const lightDist = lightColor ? colorDistanceOklab(pickedColor, lightColor) : Infinity;
    const darkDist = darkColor ? colorDistanceOklab(pickedColor, darkColor) : Infinity;

    matches.push({
      name,
      value,
      distance: Math.min(lightDist, darkDist),
      lightDark: { light: ld.light, dark: ld.dark, lightDist, darkDist },
    });
  }

  matches.sort((a, b) => a.distance - b.distance);

  const exact = matches.filter((m) => Math.round(m.distance) <= EXACT_DISTANCE_THRESHOLD);
  const rest = matches.filter((m) => Math.round(m.distance) > EXACT_DISTANCE_THRESHOLD);

  const closeCount = exact.length > CLOSE_MATCHES_COUNT ? 0 : CLOSE_MATCHES_COUNT;
  const close = rest.slice(0, closeCount);
  const far = rest.slice(closeCount, closeCount + CLOSE_MATCHES_COUNT);

  return { exact, close, far };
}

export function useColorMatcher() {
  return {
    findMatches,
    isColorValue,
  };
}
