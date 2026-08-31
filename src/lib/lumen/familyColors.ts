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

// Item/family names are arbitrary per dataset (no fixed known list), so
// colors are assigned deterministically by hashing the name instead of a
// static lookup table — the same name always gets the same color within a
// session, without needing to know every possible name up front.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorForFamily(family: string): string {
  return CATEGORICAL_HUES[hashString(family) % CATEGORICAL_HUES.length];
}
