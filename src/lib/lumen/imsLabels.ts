// How a Market Insights group is named, everywhere.
//
// A group's identity is an (area, product) pair and either half can be
// absent, so it needs a rule rather than a field. The rule lived inside
// ImsPanel; the export needs the same one, and two copies would drift —
// a group would then be called one thing on screen and another in the PDF
// a reader is holding next to it.

import type { ImsAreaProduct } from "./imsEngine";

export function imsGroupLabel(ap: ImsAreaProduct): string {
  return ap.product ?? ap.area ?? "—";
}
