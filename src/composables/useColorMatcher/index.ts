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

    const lightDarkResult = parseLightDark(value);
    if (!lightDarkResult) continue;
    const lightColor = parseColor(lightDarkResult.light);
    const darkColor = parseColor(lightDarkResult.dark);
    if (!lightColor && !darkColor) continue;

    const lightDist = lightColor ? colorDistanceOklab(pickedColor, lightColor) : Infinity;
    const darkDist = darkColor ? colorDistanceOklab(pickedColor, darkColor) : Infinity;

    matches.push({
      name,
      value,
      distance: Math.min(lightDist, darkDist),
      lightDark: { light: lightDarkResult.light, dark: lightDarkResult.dark, lightDist, darkDist },
    });
  }

  matches.sort((matchA, matchB) => matchA.distance - matchB.distance);

  const exact = matches.filter((match) => Math.round(match.distance) <= EXACT_DISTANCE_THRESHOLD);
  const rest = matches.filter((match) => Math.round(match.distance) > EXACT_DISTANCE_THRESHOLD);

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
