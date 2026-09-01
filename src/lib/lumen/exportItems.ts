import type { Finding, Report } from "./engine";
import type { Translations } from "@/lib/i18n/translations";

export type SuccessReport = Extract<Report, { findings: Finding[] }>;

export type ExportItemGroup = "summary" | "areas" | "decisions" | "charts" | "sections";

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
export function buildExportItems(report: SuccessReport, t: Translations): ExportItemGroups {
  const areaItems: ExportItem[] = Object.keys(report.areas).map((area) => ({
    id: `area:${area}`,
    group: "areas",
    label: area,
  }));

  const decisionItems: ExportItem[] = report.findings.map((f, i) => {
    let label: string;
    if (f.type === "systemic_drop") label = `${t.export.itemSystemic}: ${f.cluster}`;
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

  const groups: ExportItemGroups = [
    { group: "summary", title: t.export.groupSummary, items: [{ id: "summary", group: "summary", label: t.export.itemSummary }] },
    { group: "areas", title: t.export.groupAreas, items: areaItems },
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

// Strips only characters that are actually invalid in a filename —
// preserves non-Latin scripts (Arabic dataset names included) instead of
// stripping everything \w doesn't match down to an empty string.
export function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return cleaned || "lumen-report";
}
