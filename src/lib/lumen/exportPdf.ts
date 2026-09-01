import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { sanitizeFileName, type SuccessReport } from "./exportItems";
import type { Lang, Translations } from "@/lib/i18n/translations";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";

const COLORS = {
  bg: "#0b1229",
  surface: "#121a38",
  border: "#2a3559",
  white: "#f4f6fb",
  muted: "#8b93b0",
  amber: "#f2a93b",
  green: "#4ade80",
  red: "#fb7185",
};

// A4 portrait at 96dpi, scaled 2x for a crisp capture.
const PAGE_W = 794;
const PAGE_H = 1123;
const PAGE_PAD = 44;
const CONTENT_W = PAGE_W - PAGE_PAD * 2;
const CONTENT_H = PAGE_H - PAGE_PAD * 2;
const CAPTURE_SCALE = 2;

export type ExportContext = {
  report: SuccessReport;
  t: Translations;
  lang: Lang;
  datasetName: string;
  selectedIds: Set<string>;
};

function isSelected(ctx: ExportContext, id: string): boolean {
  return ctx.selectedIds.has(id);
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

function div(style: Partial<CSSStyleDeclaration>, children: (Node | string)[] = []): HTMLDivElement {
  const e = document.createElement("div");
  Object.assign(e.style, style);
  for (const c of children) {
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

// Signed numbers ("-30%") get visually reordered by the bidi algorithm
// when embedded in an RTL flow (the leading sign is a weak/neutral
// character, so it can end up trailing instead of leading). Forcing an
// isolated LTR run keeps them reading correctly regardless of context.
function ltrSpan(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.style.direction = "ltr";
  span.style.unicodeBidi = "isolate";
  span.textContent = text;
  return span;
}

function makeBlock(rtl: boolean): HTMLDivElement {
  return div({
    width: `${CONTENT_W}px`,
    boxSizing: "border-box",
    fontFamily: "Arial, Helvetica, sans-serif",
    direction: rtl ? "rtl" : "ltr",
    textAlign: rtl ? "right" : "left",
    marginBottom: "20px",
  });
}

function buildTitleBlock(ctx: ExportContext, rtl: boolean): HTMLDivElement {
  const b = makeBlock(rtl);
  b.style.marginTop = "160px";
  b.appendChild(div({ fontSize: "34px", fontWeight: "700", color: COLORS.white, marginBottom: "12px" }, [ctx.datasetName]));
  b.appendChild(
    div({ fontSize: "16px", color: COLORS.muted, marginBottom: "8px" }, [
      ctx.t.dashboard.comparingMonth(ctx.report.comparedToMonth, ctx.report.latestMonth),
    ]),
  );
  b.appendChild(
    div(
      { fontSize: "14px", fontWeight: "600", color: ctx.report.isSystemicDrop ? COLORS.red : COLORS.green },
      [ctx.report.isSystemicDrop ? ctx.t.dashboard.systemicDetected : ctx.t.dashboard.noSystemicPattern],
    ),
  );
  b.appendChild(
    div({ fontSize: "11px", color: COLORS.muted, marginTop: "40px" }, [
      ctx.t.export.generatedOn(new Date().toLocaleDateString(rtl ? "ar-EG" : "en-US")),
    ]),
  );
  return b;
}

function statTile(label: string, value: string, color: string): HTMLDivElement {
  return div(
    { flex: "1 1 45%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "14px", boxSizing: "border-box" },
    [
      div({ fontSize: "12px", color: COLORS.muted, marginBottom: "6px" }, [label]),
      div({ fontSize: "22px", fontWeight: "700", color }, [value]),
    ],
  );
}

function buildSummaryBlock(ctx: ExportContext, rtl: boolean): HTMLDivElement {
  const { report, t } = ctx;
  const b = makeBlock(rtl);
  b.appendChild(div({ fontSize: "20px", fontWeight: "700", color: COLORS.white, marginBottom: "14px" }, [t.export.groupSummary]));
  const areasCount = Object.keys(report.areas).length;
  const inDecline = Object.values(report.areas).filter((d) => d.pctChange !== null && d.pctChange < 0).length;
  const pattern = report.isSystemicDrop ? t.dashboard.clusterWide : areasCount > 0 ? t.dashboard.localized : t.dashboard.stable;
  const grid = div({ display: "flex", flexWrap: "wrap", gap: "12px" }, [
    statTile(t.dashboard.areasAnalyzed, String(areasCount), COLORS.white),
    statTile(t.dashboard.inDecline, String(inDecline), COLORS.red),
    statTile(t.dashboard.pattern, pattern, report.isSystemicDrop ? COLORS.red : COLORS.amber),
    statTile(t.dashboard.decisionsRaised, String(report.findings.length), COLORS.amber),
  ]);
  b.appendChild(grid);
  return b;
}

function buildDecisionBlock(finding: SuccessReport["findings"][number], ctx: ExportContext, rtl: boolean): HTMLDivElement {
  const { t, report } = ctx;
  const b = makeBlock(rtl);
  const heading = finding.type === "systemic_drop" ? `${t.export.itemSystemic}: ${finding.cluster}` : t.export.itemDecision;
  b.appendChild(div({ fontSize: "16px", fontWeight: "700", color: COLORS.white, marginBottom: "8px" }, [heading]));
  b.appendChild(div({ fontSize: "13px", color: COLORS.white, marginBottom: "10px", lineHeight: "1.5" }, [findingSummary(finding, report, t)]));
  b.appendChild(
    div({ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "12px" }, [
      div({ fontSize: "12px", fontWeight: "700", color: COLORS.amber, marginBottom: "4px" }, [t.dashboard.decision]),
      div({ fontSize: "13px", color: COLORS.white, lineHeight: "1.5" }, [findingDecision(finding, t)]),
    ]),
  );
  return b;
}

function buildAreaBlock(area: string, ctx: ExportContext, rtl: boolean): HTMLDivElement {
  const { report, t } = ctx;
  const d = report.areas[area];
  const b = makeBlock(rtl);
  const header = div({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" });
  header.appendChild(div({ fontSize: "18px", fontWeight: "700", color: COLORS.white }, [area]));
  const pctColor = d.pctChange !== null && d.pctChange < 0 ? COLORS.red : COLORS.green;
  header.appendChild(
    div({ fontSize: "16px", fontWeight: "700", color: pctColor }, [
      d.pctChange !== null ? ltrSpan(`${d.pctChange > 0 ? "+" : ""}${d.pctChange}%`) : "n/a",
    ]),
  );
  b.appendChild(header);

  const table = div({ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "10px 14px" });
  const rows: [string, string, string][] = [
    [t.export.valueLabel, formatNum(d.prevValue), formatNum(d.currValue)],
    [t.dashboard.quantityLabel.replace(":", ""), formatNum(d.prevQty), formatNum(d.currQty)],
  ];
  const targetProgress = report.areaTargets[area];
  if (targetProgress && targetProgress.pctOfTarget !== null) {
    rows.push([t.export.ofTargetLabel, "", `${targetProgress.pctOfTarget}%`]);
  }
  const headerRow = div({ display: "flex", fontSize: "11px", color: COLORS.muted, padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }, [
    div({ flex: "1" }, [""]),
    div({ flex: "1", textAlign: "center" }, [t.common.month(report.comparedToMonth)]),
    div({ flex: "1", textAlign: "center" }, [t.common.month(report.latestMonth)]),
  ]);
  table.appendChild(headerRow);
  rows.forEach(([label, prev, curr]) => {
    table.appendChild(
      div({ display: "flex", fontSize: "13px", color: COLORS.white, padding: "6px 0" }, [
        div({ flex: "1", color: COLORS.muted }, [label]),
        div({ flex: "1", textAlign: "center", fontFamily: "monospace" }, [prev]),
        div({ flex: "1", textAlign: "center", fontFamily: "monospace", fontWeight: "700" }, [curr]),
      ]),
    );
  });
  b.appendChild(table);
  return b;
}

function buildBarChartBlock(title: string, rows: [string, number][], rtl: boolean): HTMLDivElement | null {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 12);
  const maxAbs = Math.max(...top.map(([, v]) => Math.abs(v)), 1);
  const b = makeBlock(rtl);
  b.appendChild(div({ fontSize: "16px", fontWeight: "700", color: COLORS.white, marginBottom: "12px" }, [title]));
  for (const [label, value] of top) {
    const isDrop = value < 0;
    const widthPct = (Math.abs(value) / maxAbs) * 50;
    const row = div({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", direction: rtl ? "rtl" : "ltr" });
    row.appendChild(div({ width: "140px", flexShrink: "0", fontSize: "11px", color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, [label]));
    const track = div({ position: "relative", flex: "1", height: "10px", background: COLORS.surface, borderRadius: "5px" });
    const bar = div({
      position: "absolute",
      top: "0",
      bottom: "0",
      borderRadius: "5px",
      background: isDrop ? COLORS.red : COLORS.green,
      width: `${widthPct}%`,
      ...(isDrop ? { right: "50%" } : { left: "50%" }),
    });
    track.appendChild(bar);
    row.appendChild(track);
    row.appendChild(
      div({ width: "60px", flexShrink: "0", fontSize: "11px", fontFamily: "monospace", color: isDrop ? COLORS.red : COLORS.green, textAlign: rtl ? "left" : "right" }, [
        ltrSpan(`${value > 0 ? "+" : ""}${value}%`),
      ]),
    );
    b.appendChild(row);
  }
  return b;
}

function buildRankedListBlock(title: string, rows: [string, string][], rtl: boolean): HTMLDivElement | null {
  if (rows.length === 0) return null;
  const b = makeBlock(rtl);
  b.appendChild(div({ fontSize: "16px", fontWeight: "700", color: COLORS.white, marginBottom: "10px" }, [title]));
  const table = div({ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "10px 14px" });
  rows.forEach(([label, value], i) => {
    table.appendChild(
      div({ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: COLORS.white, padding: "6px 0" }, [
        div({ width: "20px", flexShrink: "0", color: COLORS.muted, fontFamily: "monospace" }, [String(i + 1)]),
        div({ flex: "1" }, [label]),
        div({ fontFamily: "monospace", fontWeight: "700" }, [value]),
      ]),
    );
  });
  b.appendChild(table);
  return b;
}

function buildTargetsSectionBlock(ctx: ExportContext, rtl: boolean): HTMLDivElement {
  const { report, t } = ctx;
  const b = makeBlock(rtl);
  b.appendChild(div({ fontSize: "16px", fontWeight: "700", color: COLORS.white, marginBottom: "10px" }, [t.export.itemTargets]));
  const table = div({ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "8px", padding: "10px 14px" });
  Object.entries(report.areaTargets)
    .filter(([, p]) => p.pctOfTarget !== null)
    .forEach(([area, p]) => {
      table.appendChild(
        div({ display: "flex", justifyContent: "space-between", fontSize: "13px", color: COLORS.white, padding: "6px 0" }, [
          div({}, [area]),
          div({ fontFamily: "monospace", fontWeight: "700" }, [`${p.pctOfTarget}%`]),
        ]),
      );
    });
  b.appendChild(table);
  return b;
}

async function paginateAndCapture(blocks: HTMLDivElement[], rtl: boolean): Promise<HTMLCanvasElement[]> {
  const scratch = div({
    position: "fixed",
    top: "0",
    left: rtl ? "auto" : "-10000px",
    right: rtl ? "-10000px" : "auto",
    width: `${PAGE_W}px`,
    background: COLORS.bg,
  });
  document.body.appendChild(scratch);

  // Measure each block's natural height by rendering it standalone first.
  const heights: number[] = [];
  for (const block of blocks) {
    scratch.appendChild(block);
    heights.push(block.getBoundingClientRect().height);
    scratch.removeChild(block);
  }

  const pages: HTMLDivElement[][] = [[]];
  let currentHeight = 0;
  blocks.forEach((block, i) => {
    const h = heights[i];
    if (currentHeight + h > CONTENT_H && pages[pages.length - 1].length > 0) {
      pages.push([]);
      currentHeight = 0;
    }
    pages[pages.length - 1].push(block);
    currentHeight += h;
  });

  const canvases: HTMLCanvasElement[] = [];
  for (const pageBlocks of pages) {
    const page = div({
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      background: COLORS.bg,
      padding: `${PAGE_PAD}px`,
      boxSizing: "border-box",
      overflow: "hidden",
    });
    for (const block of pageBlocks) page.appendChild(block);
    scratch.appendChild(page);
    const canvas = await html2canvas(page, { scale: CAPTURE_SCALE, backgroundColor: COLORS.bg, logging: false });
    canvases.push(canvas);
    scratch.removeChild(page);
  }

  document.body.removeChild(scratch);
  return canvases;
}

export async function exportToPdf(ctx: ExportContext): Promise<void> {
  const { report, t, lang } = ctx;
  const rtl = lang === "ar";
  const blocks: HTMLDivElement[] = [];

  blocks.push(buildTitleBlock(ctx, rtl));

  if (isSelected(ctx, "summary")) blocks.push(buildSummaryBlock(ctx, rtl));

  report.findings.forEach((f, i) => {
    if (isSelected(ctx, `decision:${i}`)) blocks.push(buildDecisionBlock(f, ctx, rtl));
  });

  for (const area of Object.keys(report.areas)) {
    if (isSelected(ctx, `area:${area}`)) blocks.push(buildAreaBlock(area, ctx, rtl));
  }

  if (isSelected(ctx, "chart:biggest-movers")) {
    const rows = Object.entries(report.areas)
      .filter(([, d]) => d.pctChange !== null)
      .map(([area, d]) => [area, d.pctChange as number] as [string, number]);
    const block = buildBarChartBlock(t.dashboard.biggestMovers, rows, rtl);
    if (block) blocks.push(block);
  }
  if (isSelected(ctx, "chart:item-comparison")) {
    const rows = Object.entries(report.familyChanges)
      .filter(([, d]) => d.pctChange !== null)
      .map(([fam, d]) => [fam, d.pctChange as number] as [string, number]);
    const block = buildBarChartBlock(t.dashboard.itemComparison, rows, rtl);
    if (block) blocks.push(block);
  }
  if (isSelected(ctx, "chart:rep-comparison")) {
    const rows = Object.entries(report.repChanges)
      .filter(([, d]) => d.pctChange !== null)
      .map(([rep, d]) => [rep, d.pctChange as number] as [string, number]);
    const block = buildBarChartBlock(t.dashboard.repComparison, rows, rtl);
    if (block) blocks.push(block);
  }
  if (isSelected(ctx, "section:rep-leaderboard")) {
    const rows = Object.entries(report.repChanges)
      .map(([rep, rc]) => {
        const pct = report.repTargets[rep]?.pctOfTarget ?? null;
        const usesPct = report.hasTargets && pct !== null;
        return { rep, metric: usesPct ? pct! : rc.currValue, label: usesPct ? `${pct}%` : formatNum(rc.currValue) };
      })
      .sort((a, b) => b.metric - a.metric)
      .slice(0, 10)
      .map(({ rep, label }) => [rep, label] as [string, string]);
    const block = buildRankedListBlock(t.dashboard.repLeaderboard, rows, rtl);
    if (block) blocks.push(block);
  }

  if (isSelected(ctx, "section:targets") && report.hasTargets) {
    blocks.push(buildTargetsSectionBlock(ctx, rtl));
  }

  const canvases = await paginateAndCapture(blocks, rtl);

  const doc = new jsPDF({ orientation: "portrait", unit: "px", format: [PAGE_W, PAGE_H] });
  canvases.forEach((canvas, i) => {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H]);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    doc.addImage(imgData, "JPEG", 0, 0, PAGE_W, PAGE_H);
  });

  doc.save(`${sanitizeFileName(ctx.datasetName)}.pdf`);
}
