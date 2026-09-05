import PptxGenJS from "pptxgenjs";
import { sanitizeFileName, findingsForArea, findingsForItem, areaRankingForItem, rootCauseText, type SuccessReport } from "./exportItems";
import type { Translations } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";
import type { ImsReport } from "./imsEngine";
import { imsGroupLabel } from "./imsLabels";

const BG = "0B1229";
const SURFACE = "121A38";
const WHITE = "F4F6FB";
const MUTED = "8B93B0";
const AMBER = "F2A93B";
const GREEN = "4ADE80";
const RED = "FB7185";

export type ExportContext = {
  report: SuccessReport;
  t: Translations;
  lang: Lang;
  datasetName: string;
  selectedIds: Set<string>;
  /** Null when Market Insights has no data for this dataset. */
  imsReport?: ImsReport | null;
};

function isSelected(ctx: ExportContext, id: string): boolean {
  return ctx.selectedIds.has(id);
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

export async function exportToPptx(ctx: ExportContext): Promise<void> {
  const { report, t, lang } = ctx;
  const rtl = lang === "ar";
  const align: "left" | "right" = rtl ? "right" : "left";

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LUMEN_16x9", width: 10, height: 5.63 });
  pptx.layout = "LUMEN_16x9";
  pptx.rtlMode = rtl;

  function addBackground(slide: PptxGenJS.Slide) {
    slide.background = { color: BG };
  }

  // --- Title slide ---
  const title = pptx.addSlide();
  addBackground(title);
  title.addText(ctx.datasetName, { x: 0.5, y: 1.7, w: 9, h: 0.9, fontSize: 32, bold: true, color: WHITE, align });
  title.addText(t.dashboard.comparingMonth(report.comparedToMonth, report.latestMonth), {
    x: 0.5,
    y: 2.6,
    w: 9,
    h: 0.5,
    fontSize: 16,
    color: MUTED,
    align,
  });
  title.addText(
    report.isSystemicDrop ? t.dashboard.systemicDetected : t.dashboard.noSystemicPattern,
    { x: 0.5, y: 3.1, w: 9, h: 0.4, fontSize: 14, color: report.isSystemicDrop ? RED : GREEN, align },
  );

  // --- Summary slide ---
  if (isSelected(ctx, "summary")) {
    const areasCount = Object.keys(report.areas).length;
    const inDecline = Object.values(report.areas).filter((d) => d.pctChange !== null && d.pctChange < 0).length;
    const slide = pptx.addSlide();
    addBackground(slide);
    slide.addText(t.export.groupSummary, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: WHITE, align });

    const stats: [string, string][] = [
      [t.dashboard.areasAnalyzed, String(areasCount)],
      [t.dashboard.inDecline, String(inDecline)],
      [
        t.dashboard.pattern,
        report.isSystemicDrop ? t.dashboard.lineWide : Object.keys(report.areas).length > 0 ? t.dashboard.localized : t.dashboard.stable,
      ],
      [t.dashboard.decisionsRaised, String(report.findings.length)],
    ];
    stats.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.5 + col * 4.6;
      const y = 1.2 + row * 1.6;
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 4.2, h: 1.3, fill: { color: SURFACE }, rectRadius: 0.08, line: { color: "2A3559" } });
      slide.addText(label, { x: x + 0.25, y: y + 0.15, w: 3.7, h: 0.4, fontSize: 12, color: MUTED, align });
      slide.addText(value, { x: x + 0.25, y: y + 0.55, w: 3.7, h: 0.6, fontSize: 26, bold: true, color: WHITE, align });
    });
  }

  // --- Decision slides ---
  report.findings.forEach((f, i) => {
    if (!isSelected(ctx, `decision:${i}`)) return;
    const slide = pptx.addSlide();
    addBackground(slide);
    const heading = f.type === "systemic_drop" ? `${t.export.itemSystemic}: ${f.line}` : `${t.export.itemDecision}`;
    slide.addText(heading, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 20, bold: true, color: WHITE, align });
    slide.addText(findingSummary(f, report, t), {
      x: 0.5,
      y: 1.0,
      w: 9,
      h: 1.5,
      fontSize: 16,
      color: WHITE,
      align,
      valign: "top",
    });
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 2.8, w: 9, h: 1.8, fill: { color: SURFACE }, rectRadius: 0.08 });
    slide.addText(t.dashboard.decision, { x: 0.8, y: 3.0, w: 8.4, h: 0.4, fontSize: 13, bold: true, color: AMBER, align });
    slide.addText(findingDecision(f, t), { x: 0.8, y: 3.4, w: 8.4, h: 1.1, fontSize: 15, color: WHITE, align, valign: "top" });
  });

  // --- Area slides ---
  for (const [area, d] of Object.entries(report.areas)) {
    if (!isSelected(ctx, `area:${area}`)) continue;
    const slide = pptx.addSlide();
    addBackground(slide);
    slide.addText(area, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });
    const pctColor = d.pctChange !== null && d.pctChange < 0 ? RED : GREEN;
    slide.addText(d.pctChange !== null ? `${d.pctChange > 0 ? "+" : ""}${d.pctChange}%` : "n/a", {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: pctColor,
      align,
    });

    const rows: [string, string, string][] = [
      [t.export.valueLabel, formatNum(d.prevValue), formatNum(d.currValue)],
      [t.dashboard.quantityLabel.replace(":", ""), formatNum(d.prevQty), formatNum(d.currQty)],
    ];
    const targetProgress = report.areaTargets[area];
    if (targetProgress && targetProgress.pctOfTarget !== null) {
      rows.push([t.export.ofTargetLabel, "", `${targetProgress.pctOfTarget}%`]);
    }

    slide.addTable(
      [
        [
          { text: "", options: { fill: { color: SURFACE } } },
          { text: t.common.month(report.comparedToMonth), options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12 } },
          { text: t.common.month(report.latestMonth), options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12 } },
        ],
        ...rows.map(([label, prev, curr]) => [
          { text: label, options: { color: MUTED, fontSize: 13 } },
          { text: prev, options: { color: WHITE, fontSize: 13 } },
          { text: curr, options: { color: WHITE, fontSize: 13, bold: true } },
        ]),
      ],
      { x: 0.5, y: 1.8, w: 9, colW: [3, 3, 3], border: { color: "2A3559", pt: 0.5 }, align },
    );

    const areaFindings = findingsForArea(report, area);
    if (areaFindings.length > 0) {
      slide.addText(findingSummary(areaFindings[0], report, t), {
        x: 0.5,
        y: 1.8 + (rows.length + 1) * 0.4 + 0.2,
        w: 9,
        h: 0.9,
        fontSize: 12,
        color: MUTED,
        align,
        valign: "top",
      });
    }

    // Full trend, straight from report data — independent of whether this
    // area's card happened to be expanded on screen.
    if (d.monthlySeries.length >= 2) {
      const lineSummary = report.hasLines ? report.lines[d.line] : undefined;
      addTrendSlide(pptx, t.dashboard.trendLastMonths(d.monthlySeries.length), area, d.monthlySeries, lineSummary?.monthlySeries, t, align);
    }

    // Full by-item breakdown for this area — every family, not just the
    // ones the user happened to expand.
    const familyEntries = Object.entries(report.areaFamilyChanges[area] ?? {}).sort((a, b) => b[1].absDrop - a[1].absDrop);
    if (familyEntries.length > 0) {
      addChangeTableSlide(
        pptx,
        `${area} — ${t.dashboard.byItem}`,
        familyEntries.map(([fam, fc]) => [fam, fc.currValue, fc.pctChange] as [string, number, number | null]),
        t,
        align,
      );
    }
  }

  // --- Item slides ---
  for (const family of Object.keys(report.familyChanges)) {
    if (!isSelected(ctx, `item:${family}`)) continue;
    const fc = report.familyChanges[family];
    const slide = pptx.addSlide();
    addBackground(slide);
    slide.addText(family, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });
    const pctColor = fc.pctChange !== null && fc.pctChange < 0 ? RED : GREEN;
    slide.addText(fc.pctChange !== null ? `${fc.pctChange > 0 ? "+" : ""}${fc.pctChange}%` : "n/a", {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 0.6,
      fontSize: 28,
      bold: true,
      color: pctColor,
      align,
    });
    slide.addText(
      `${t.common.month(report.comparedToMonth)}: ${formatNum(fc.prevValue)}  ->  ${t.common.month(report.latestMonth)}: ${formatNum(fc.currValue)}`,
      { x: 0.5, y: 1.6, w: 9, h: 0.4, fontSize: 14, color: WHITE, align },
    );

    const { areas: rootCauseAreas, lines: rootCauseLines } = findingsForItem(report, family);
    const rootCause = rootCauseText(t, rootCauseAreas, rootCauseLines);
    if (rootCause) {
      slide.addText(rootCause, { x: 0.5, y: 2.1, w: 9, h: 0.6, fontSize: 12, color: AMBER, align, valign: "top" });
    }

    const itemSeries = report.itemMonthlySeries[family] ?? [];
    if (itemSeries.length >= 2) {
      addTrendSlide(pptx, `${family} — ${t.dashboard.trendLastMonths(itemSeries.length)}`, family, itemSeries, undefined, t, align);
    }

    const ranking = areaRankingForItem(report, family);
    if (ranking.length > 0) {
      addRankedListSlide(
        pptx,
        `${family} — ${t.dashboard.byAreaMonth(report.latestMonth)}`,
        ranking.map(([area, value]) => [area, formatNum(value)] as [string, string]),
        align,
      );
    }
  }

  // --- Market Insights slides ---
  // One slide per group, carrying the same four figures its dashboard
  // tiles show plus the leading competitor. This section used to be
  // missing from the deck entirely.
  (ctx.imsReport?.areaProducts ?? []).forEach((ap, i) => {
    if (!isSelected(ctx, `ims:${i}`)) return;
    const slide = pptx.addSlide();
    addBackground(slide);
    slide.addText(imsGroupLabel(ap), { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });
    slide.addText(ap.latestShare !== null ? `${ap.latestShare.toFixed(1)}%` : "n/a", {
      x: 0.5, y: 0.9, w: 9, h: 0.6, fontSize: 28, bold: true, color: AMBER, align,
    });
    if (ap.rank !== null) {
      slide.addText(t.ims.rankInCategory(ap.rank, ap.totalInGroup), {
        x: 0.5, y: 1.5, w: 9, h: 0.35, fontSize: 13, color: MUTED, align,
      });
    }

    const signed = (n: number | null) => (n === null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);
    const points = (n: number | null) => (n === null ? "n/a" : `${n > 0 ? "+" : ""}${n.toFixed(1)} pp`);
    const toneOf = (n: number | null) => (n === null ? MUTED : n < 0 ? RED : GREEN);

    const rows: [string, string, string][] = [
      [t.ims.ourGrowth, signed(ap.ourGrowthRate), toneOf(ap.ourGrowthRate)],
      [t.ims.marketGrowthLabel, signed(ap.marketGrowthRate), toneOf(ap.marketGrowthRate)],
      [t.ims.shareGainLossLabel, points(ap.pctPointChange), toneOf(ap.pctPointChange)],
    ];
    if (ap.topCompetitor) {
      rows.push([t.ims.topCompetitor, `${ap.topCompetitor.company} — ${ap.topCompetitor.share.toFixed(1)}%`, MUTED]);
    }
    rows.forEach(([label, value, color], r) => {
      const y = 2.05 + r * 0.55;
      slide.addText(label, { x: 0.5, y, w: 4.5, h: 0.4, fontSize: 14, color: MUTED, align });
      slide.addText(value, { x: 5.0, y, w: 4.5, h: 0.4, fontSize: 14, bold: true, color, align: rtl ? "left" : "right" });
    });
  });

  // --- Chart slides (native pptx charts) ---
  if (isSelected(ctx, "chart:biggest-movers")) {
    addBarChartSlide(
      pptx,
      t.dashboard.biggestMovers,
      Object.entries(report.areas)
        .filter(([, d]) => d.pctChange !== null)
        .map(([area, d]) => [area, d.pctChange as number]),
      align,
    );
  }
  if (isSelected(ctx, "chart:item-comparison")) {
    addBarChartSlide(
      pptx,
      t.dashboard.itemComparison,
      Object.entries(report.familyChanges)
        .filter(([, d]) => d.pctChange !== null)
        .map(([fam, d]) => [fam, d.pctChange as number]),
      align,
    );
  }
  if (isSelected(ctx, "chart:rep-comparison")) {
    addBarChartSlide(
      pptx,
      t.dashboard.repComparison,
      Object.entries(report.repChanges)
        .filter(([, d]) => d.pctChange !== null)
        .map(([rep, d]) => [rep, d.pctChange as number]),
      align,
    );
  }
  if (isSelected(ctx, "section:rep-leaderboard")) {
    const rows = Object.entries(report.repChanges)
      .map(([rep, rc]) => {
        const pct = report.repTargets[rep]?.pctOfTarget ?? null;
        const usesPct = report.hasTargets && pct !== null;
        return { rep, metric: usesPct ? pct! : rc.currValue, label: usesPct ? `${pct}%` : formatNum(rc.currValue) };
      })
      .sort((a, b) => b.metric - a.metric)
      .slice(0, 10);
    addRankedListSlide(
      pptx,
      t.dashboard.repLeaderboard,
      rows.map((r) => [r.rep, r.label] as [string, string]),
      align,
    );
  }

  // --- Targets section ---
  if (isSelected(ctx, "section:targets") && report.hasTargets) {
    const slide = pptx.addSlide();
    addBackground(slide);
    slide.addText(t.export.itemTargets, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });

    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: t.dashboard.allAreas, options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12, bold: true } },
        { text: t.export.ofTargetLabel, options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12, bold: true } },
      ],
      ...Object.entries(report.areaTargets)
        .filter(([, p]) => p.pctOfTarget !== null)
        .map(([area, p]) => [
          { text: area, options: { color: WHITE, fontSize: 13 } },
          { text: `${p.pctOfTarget}%`, options: { color: WHITE, fontSize: 13, bold: true } },
        ]),
    ];
    slide.addTable(tableRows, { x: 0.5, y: 1.1, w: 9, colW: [6, 3], border: { color: "2A3559", pt: 0.5 }, align });
  }

  await pptx.writeFile({ fileName: `${sanitizeFileName(ctx.datasetName)}.pptx` });
}

function addRankedListSlide(pptx: PptxGenJS, title: string, rows: [string, string][], align: "left" | "right") {
  if (rows.length === 0) return;
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });

  const tableRows: PptxGenJS.TableRow[] = rows.map(([label, value], i) => [
    { text: String(i + 1), options: { color: MUTED, fontSize: 12 } },
    { text: label, options: { color: WHITE, fontSize: 13 } },
    { text: value, options: { color: WHITE, fontSize: 13, bold: true } },
  ]);
  slide.addTable(tableRows, { x: 0.5, y: 1.1, w: 9, colW: [0.6, 5.4, 3], border: { color: "2A3559", pt: 0.5 }, align });
}

function addBarChartSlide(
  pptx: PptxGenJS,
  title: string,
  rows: [string, number][],
  align: "left" | "right",
) {
  if (rows.length === 0) return;
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });

  const top = rows.slice(0, 15);
  const data: PptxGenJS.OptsChartData[] = [
    {
      name: title,
      labels: top.map(([label]) => label),
      values: top.map(([, value]) => value),
    },
  ];

  slide.addChart(pptx.ChartType.bar, data, {
    x: 0.5,
    y: 1.0,
    w: 9,
    h: 4.3,
    barDir: "bar",
    chartColors: top.map(([, v]) => (v < 0 ? RED : GREEN)),
    valAxisLabelColor: MUTED,
    catAxisLabelColor: MUTED,
    dataLabelColor: WHITE,
    showValue: true,
    showLegend: false,
    plotArea: { fill: { color: BG } },
    chartArea: { fill: { color: BG } },
  });
}

// A native line-chart slide for a monthly trend — the area (or item) vs.
// its line average, when there is one. Built straight from report
// data, so it's identical whether the matching dashboard card was
// expanded or collapsed when Export was clicked.
function addTrendSlide(
  pptx: PptxGenJS,
  title: string,
  seriesLabel: string,
  series: { month: number; value: number }[],
  lineSeries: { month: number; avgValue: number }[] | undefined,
  t: Translations,
  align: "left" | "right",
) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });

  const labels = series.map((s) => t.common.month(s.month));
  const data: PptxGenJS.OptsChartData[] = [{ name: seriesLabel, labels, values: series.map((s) => s.value) }];
  if (lineSeries) {
    const byMonth = new Map(lineSeries.map((s) => [s.month, s.avgValue]));
    data.push({ name: t.dashboard.lineWord, labels, values: series.map((s) => byMonth.get(s.month) ?? 0) });
  }

  slide.addChart(pptx.ChartType.line, data, {
    x: 0.5,
    y: 1.0,
    w: 9,
    h: 4.3,
    chartColors: [AMBER, MUTED],
    valAxisLabelColor: MUTED,
    catAxisLabelColor: MUTED,
    showLegend: lineSeries !== undefined,
    legendColor: MUTED,
    lineDataSymbol: "circle",
    plotArea: { fill: { color: BG } },
    chartArea: { fill: { color: BG } },
  });
}

// A prev -> curr -> %change table slide — used for an area's full
// by-item breakdown (every family, not just the ones the user happened
// to expand).
function addChangeTableSlide(
  pptx: PptxGenJS,
  title: string,
  rows: [string, number, number | null][],
  t: Translations,
  align: "left" | "right",
) {
  if (rows.length === 0) return;
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addText(title, { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: WHITE, align });

  const tableRows: PptxGenJS.TableRow[] = [
    [
      { text: "", options: { fill: { color: SURFACE } } },
      { text: t.export.valueLabel, options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12 } },
      { text: t.export.changeLabel, options: { fill: { color: SURFACE }, color: MUTED, fontSize: 12 } },
    ],
    ...rows.map(([label, value, pctChange]) => [
      { text: label, options: { color: WHITE, fontSize: 13 } },
      { text: formatNum(value), options: { color: WHITE, fontSize: 13, bold: true } },
      {
        text: pctChange === null ? "n/a" : `${pctChange > 0 ? "+" : ""}${pctChange}%`,
        options: { color: pctChange !== null && pctChange < 0 ? RED : GREEN, fontSize: 13 },
      },
    ]),
  ];
  slide.addTable(tableRows, { x: 0.5, y: 1.1, w: 9, colW: [5, 2, 2], border: { color: "2A3559", pt: 0.5 }, align });
}
