import { FAMILY_PREFIXES } from "./engine";

// Fixed hue order (validated for the app's dark surface #121a38 — see
// dataviz skill's validate_palette.js). Deliberately excludes red/green,
// which are reserved as the app's decline/growth status colors elsewhere
// on this page.
const CATEGORICAL_HUES = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#9085e9", // violet
];

const FAMILY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  FAMILY_PREFIXES.map((family, i) => [family, CATEGORICAL_HUES[i % CATEGORICAL_HUES.length]]),
);

const OTHER_COLOR = "#8b93b0"; // muted — anything outside the known family list

export function colorForFamily(family: string): string {
  return FAMILY_COLOR_MAP[family] ?? OTHER_COLOR;
}
