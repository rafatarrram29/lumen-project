import type { Finding, Report } from "./engine";
import type { ImsReport } from "./imsEngine";
import { imsGroupLabel } from "./imsLabels";
import type { Translations } from "@/lib/i18n/translations";

export type SuccessReport = Extract<Report, { findings: Finding[] }>;

export type ExportItemGroup = "summary" | "areas" | "items" | "market" | "decisions" | "charts" | "sections";

export type ExportItem = {
  id: string;
  group: ExportItemGroup;
  label: string;
};

export type ExportItemGroups = {
  group: ExportItemGroup;
  title: string;
  items: ExportItem[];
}[];

// Every checklist entry mirrors something actually rendered on the
// dashboard for this report — nothing here can be selected that wouldn't
// otherwise exist, so an export can never show something the user never
// saw on screen.
export function buildExportItems(
  report: SuccessReport,
  t: Translations,
  imsReport?: ImsReport | null,
): ExportItemGroups {
  const areaItems: ExportItem[] = Object.keys(report.areas).map((area) => ({
    id: `area:${area}`,
    group: "areas",
    label: area,
  }));

  const itemItems: ExportItem[] = Object.keys(report.familyChanges).map((family) => ({
    id: `item:${family}`,
    group: "items",
    label: family,
  }));

  const decisionItems: ExportItem[] = report.findings.map((f, i) => {
    let label: string;
    if (f.type === "systemic_drop") label = `${t.export.itemSystemic}: ${f.line}`;
    else if (f.type === "local_drop") label = `${t.export.itemDecision}: ${f.area}`;
    else label = `${t.export.itemDecision}: ${f.family} → ${f.area}`;
    return { id: `decision:${i}`, group: "decisions", label };
  });

  const chartItems: ExportItem[] = [
    { id: "chart:biggest-movers", group: "charts", label: t.dashboard.biggestMovers },
    { id: "chart:item-comparison", group: "charts", label: t.dashboard.itemComparison },
  ];
  if (report.hasReps) {
    chartItems.push({ id: "chart:rep-comparison", group: "charts", label: t.dashboard.repComparison });
  }

  // Rep leaderboard is a ranked list, not a diverging change chart like the
  // items above — grouped with the other non-chart sections instead.
  const sectionItems: ExportItem[] = [];
  if (report.hasReps) {
    sectionItems.push({ id: "section:rep-leaderboard", group: "sections", label: t.dashboard.repLeaderboard });
  }
  if (report.hasTargets) {
    sectionItems.push({ id: "section:targets", group: "sections", label: t.export.itemTargets });
  }

  // Market Insights was missing from the export entirely — the one section
  // of the dashboard a reader of the PDF could not get. Indexed rather than
  // named because a group's identity is an (area, product) pair, either
  // half of which can be blank.
  const marketItems: ExportItem[] = (imsReport?.areaProducts ?? []).map((ap, i) => ({
    id: `ims:${i}`,
    group: "market",
    label: imsGroupLabel(ap),
  }));

  const groups: ExportItemGroups = [
    { group: "summary", title: t.export.groupSummary, items: [{ id: "summary", group: "summary", label: t.export.itemSummary }] },
    { group: "areas", title: t.export.groupAreas, items: areaItems },
    { group: "items", title: t.export.groupItems, items: itemItems },
    { group: "market", title: t.export.groupMarket, items: marketItems },
    { group: "decisions", title: t.export.groupDecisions, items: decisionItems },
    { group: "charts", title: t.export.groupCharts, items: chartItems },
  ];
  if (sectionItems.length > 0) {
    groups.push({ group: "sections", title: t.export.groupSections, items: sectionItems });
  }

  return groups.filter((g) => g.items.length > 0);
}

export function allItemIds(groups: ExportItemGroups): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.id));
}

// Every non-systemic finding tied to a given area — same grouping the
// dashboard itself uses to show an area's root cause/decision line, so an
// exported area block never leaves this out just because it wasn't
// expanded on screen when Export was clicked.
export function findingsForArea(report: SuccessReport, area: string): Finding[] {
  return report.findings.filter((f) => f.type !== "systemic_drop" && f.area === area);
}

// Which areas/lines a given item (family) is the flagged root cause
// for — mirrors the dashboard's per-item drill-down.
export function findingsForItem(report: SuccessReport, item: string): { areas: string[]; lines: string[] } {
  const areas: string[] = [];
  const lines: string[] = [];
  for (const f of report.findings) {
    if (f.type === "local_drop" && f.rootCauseFamily === item) areas.push(f.area);
    if (f.type === "systemic_drop" && f.rootCauseFamily === item) lines.push(f.line);
  }
  return { areas, lines };
}

// The same "root cause for ..." phrasing the dashboard's item drill-down
// uses, built from a findingsForItem() result.
export function rootCauseText(t: Translations, areas: string[], lines: string[]): string | null {
  if (areas.length === 0 && lines.length === 0) return null;
  const parts = [
    ...areas,
    ...lines.map((c) => (c === "All areas" ? t.dashboard.theLineWideDrop : t.dashboard.theLineWideDropIn(c))),
  ];
  return `${t.dashboard.rootCauseFor} ${parts.join(", ")}`;
}

// Every area's latest-month value for a given item, ranked highest first —
// the same ranking the dashboard shows under an expanded item row.
export function areaRankingForItem(report: SuccessReport, item: string): [string, number][] {
  return Object.entries(report.areaFamilyChanges)
    .map(([area, changes]) => [area, changes[item]] as const)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined)
    .sort((a, b) => b[1].currValue - a[1].currValue)
    .map(([area, changes]) => [area, changes.currValue]);
}

// Strips only characters that are actually invalid in a filename —
// preserves non-Latin scripts (Arabic dataset names included) instead of
// stripping everything \w doesn't match down to an empty string.
export function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return cleaned || "lumen-report";
}
