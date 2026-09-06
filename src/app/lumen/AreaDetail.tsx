"use client";

// One area, in full: the same card the Sales tab has always shown.
//
// It used to be written inline inside LumenClient's areas.map, which was
// fine while the Sales tab was the only place an area appeared. A district
// manager's card now opens the same area, and the requirement was
// explicitly that it be the SAME thing — not a lighter second version that
// drifts away from this one a release at a time. So the card moved here
// and both places render it.
//
// Everything it needs is a prop. That list is long because an area card
// genuinely does a lot — inline editing, rep history, linked files, the
// trend against its line, per-item drill-down — and passing it explicitly
// is what makes it possible to drop the same card somewhere else and get
// identical behaviour.

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Finding, Report } from "@/lib/lumen/engine";
import { colorForFamily } from "@/lib/lumen/familyColors";
import { findingSummary, findingDecision } from "@/lib/i18n/findingText";
import { repResponsibleInMonth, type RepAssignment } from "@/lib/lumen/repAssignments";
import { managerForRep, averageSeriesForAreas, type AreaScope, type ManagerLink } from "@/lib/lumen/orgStructure";
import { recordsForAreaMonth, type LinkedFile, type LinkedRecord } from "@/lib/lumen/linkedFiles";
import { EditableValue, EditableFieldValue } from "./EditableValue";
import { TargetProgressPanel, type TargetEdit } from "./TargetProgressPanel";
import { useTargetProgress } from "./useTargetProgress";
import { RepHistoryPanel } from "./RepHistoryPanel";
import { TrendChart } from "./TrendChart";
import { areaCardId, formatNumber, Badge, PctDelta, TargetChip } from "./dashboardBits";

type SuccessReport = Extract<Report, { findings: Finding[] }>;
type AreaChange = SuccessReport["areas"][string];

export function AreaDetail({
  area,
  d,
  report,
  areaFindings,
  isOpen,
  toggle,
  expandedItems,
  toggleItem,
  renderItemDetail,
  assignments,
  managerLinks,
  linkedFiles,
  linkedRecords,
  editedCells,
  targetThreshold,
  selectedDatasetId,
  year,
  onAssignmentsChanged,
  handleRenameSalesField,
  handleEditSalesCell,
  handleEditLinkedField,
  anchored = false,
  scope = null,
  targetsVersion = 0,
  onAddTarget,
  onEditTarget,
}: {
  area: string;
  d: AreaChange;
  report: SuccessReport;
  areaFindings: Finding[];
  isOpen: boolean;
  toggle: (area: string) => void;
  expandedItems: Set<string>;
  toggleItem: (item: string) => void;
  /** The per-item drill-down, rendered by its one owner and passed in. */
  renderItemDetail: (item: string, scope?: AreaScope | null) => ReactNode;
  assignments: RepAssignment[];
  managerLinks: ManagerLink[];
  linkedFiles: LinkedFile[];
  linkedRecords: LinkedRecord[];
  editedCells: Map<string, { editedBy: string | null; editedAt: string }>;
  targetThreshold: number;
  selectedDatasetId: string | null;
  year: number;
  onAssignmentsChanged: () => void;
  handleRenameSalesField: (field: "area" | "item", oldValue: string, newValue: string) => Promise<void>;
  handleEditSalesCell: (area: string, family: string, month: number, newValue: number) => Promise<void>;
  handleEditLinkedField: (recordId: string, key: string, newValue: string) => Promise<void>;
  /**
   * Whether this is the canonical card for the area — the one in the Sales
   * list. Only that one carries the DOM id global search scrolls to: the
   * same card also renders inside a district manager's drill-down, and two
   * elements sharing an id is invalid HTML that would send "jump to Kafr El
   * Sheikh 1" to whichever copy happened to come first.
   */
  anchored?: boolean;
  /**
   * Narrows every figure in this card to one part of the org chart. Null on
   * the Sales tab, where the whole dataset is the right frame; set inside a
   * manager's or a rep's block, where it is not.
   */
  scope?: AreaScope | null;
  /** Bumped after a target upload or edit, so the panel refetches. */
  targetsVersion?: number;
  /** Opens the targets upload with this area already filled in. */
  onAddTarget?: (area: string) => void;
  /** Corrects one target figure for this area. */
  onEditTarget?: (area: string, edit: TargetEdit) => Promise<void>;
}) {
  const { t } = useLanguage();
  // Only fetched once the card is open — a collapsed card asks for
  // nothing, which is what keeps a thirty-area dashboard to one request.
  const areaProgress = useTargetProgress({
    datasetId: selectedDatasetId,
    year,
    scopes: [{ areas: [area] }],
    threshold: targetThreshold,
    enabled: isOpen && Boolean(selectedDatasetId),
    version: targetsVersion,
  });
              const lineSummary = report.lines[d.line];
              const areaLineSystemic = lineSummary?.isSystemicDrop ?? false;
              const causeLine =
                areaFindings.length > 0
                  ? findingSummary(areaFindings[0], report, t)
                  : areaLineSystemic && d.pctChange !== null && d.pctChange <= -15
                    ? t.dashboard.partOfLineDrop
                    : t.dashboard.noChangeThisMonth;

              // What this area is measured against. On the Sales tab that is
              // its whole line, which is the right frame there. Inside a
              // rep's or a manager's block it is not: "vs the line" quietly
              // drags in 30 areas the viewer is not looking at, so the
              // comparison becomes the average of the areas in scope.
              const lineSeries =
                scope && scope.areas.length > 0
                  ? averageSeriesForAreas(report.areas, scope.areas)
                  : (lineSummary?.monthlySeries ?? []);
              // TrendChart names these after where they appear, not their
              // length: compareLabel is the legend entry, compareShortLabel
              // the tooltip row — which carries its own colon the way
              // t.chart.lineAvg does.
              const compareLabel = scope ? scope.label : undefined;
              const compareShortLabel = scope ? `${scope.label}:` : undefined;
              const compareWord = scope ? scope.shortLabel : report.hasLines ? d.line : t.dashboard.lineWord;
              const lineLast = lineSeries[lineSeries.length - 1];
              const linePrev = lineSeries[lineSeries.length - 2];
              const linePct =
                lineLast && linePrev && linePrev.avgValue !== 0
                  ? Math.round(((lineLast.avgValue - linePrev.avgValue) / linePrev.avgValue) * 1000) / 10
                  : null;

              const areaAssignments = assignments.filter((a) => a.area === area);
              const responsibleInLatest = repResponsibleInMonth(areaAssignments, area, report.latestMonth);

              const linkedContext = linkedFiles
                .map((f) => ({ file: f, records: recordsForAreaMonth(f, linkedRecords, area, report.latestMonth) }))
                .filter((entry) => entry.records.length > 0);

              return (
                <div
                  id={anchored ? areaCardId(area) : undefined}
                  className="scroll-mt-4 rounded-2xl border border-bdr bg-surf p-5 transition-colors"
                >
                  <div
                    onClick={() => toggle(area)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggle(area)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 text-start"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EditableFieldValue
                          value={area}
                          className="truncate font-medium"
                          title={t.inlineEdit.renameHint}
                          onSave={(v) => handleRenameSalesField("area", area, v.trim())}
                        />
                        {report.hasLines && (
                          <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted" dir="auto">
                            {d.line}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">{causeLine}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TargetChip progress={report.areaTargets[area]} threshold={targetThreshold} t={t} />
                      <Badge pctChange={d.pctChange} />
                      <span className="text-xs text-muted">{isOpen ? t.common.hide : t.common.details}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 space-y-5 border-t border-bdr pt-4 text-sm">
                      <div>
                        <p className="mb-2">
                          {t.dashboard.valueLabel} {t.common.month(report.comparedToMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevValue)}</span> →{" "}
                          {t.common.month(report.latestMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.currValue)}</span>.{" "}
                          {t.dashboard.quantityLabel} {t.common.month(report.comparedToMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.prevQty)}</span> →{" "}
                          {t.common.month(report.latestMonth)}:{" "}
                          <span className="font-mono text-white">{formatNumber(d.currQty)}</span>.
                        </p>
                        {report.areaTargets[area] &&
                          report.areaTargets[area].pctOfTarget !== null &&
                          report.areaTargets[area].pctOfTarget! < targetThreshold && (
                            <p className="mb-2 rounded-lg bg-red/10 px-3 py-2 text-xs font-semibold text-red">
                              {t.targets.underTargetBy(Math.round((100 - report.areaTargets[area].pctOfTarget!) * 10) / 10)}
                            </p>
                          )}
                        {linePct !== null && (
                          <p className="mb-2 text-xs text-muted">
                            {t.dashboard.areaMovedVs(d.pctChange ?? 0, compareWord, linePct)}
                          </p>
                        )}
                        {responsibleInLatest && (
                          <p className="mb-2 text-xs text-muted" dir="auto">
                            {t.repHistory.responsibleInMonth(
                              t.common.month(report.latestMonth),
                              responsibleInLatest.rep ?? t.repHistory.vacant,
                            )}
                            {/* The manager above them, but only when an org
                                structure has actually been defined — with
                                none, this line reads exactly as before. */}
                            {managerForRep(managerLinks, responsibleInLatest.rep) && (
                              <span className="ms-2 text-amber">
                                {t.org.managerOf(managerForRep(managerLinks, responsibleInLatest.rep)!)}
                              </span>
                            )}
                          </p>
                        )}
                        <table className="w-full text-start">
                          <tbody>
                            <tr className="text-muted">
                              <td className="py-1 pe-4">{t.dashboard.decliningStreak}</td>
                              <td className="py-1 text-white">{d.decliningStreak ? t.dashboard.yes : t.dashboard.no}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {d.monthlySeries.length >= 2 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">
                            {t.dashboard.trendLastMonths(d.monthlySeries.length)}
                          </div>
                          <TrendChart
                            areaLabel={area}
                            areaSeries={d.monthlySeries}
                            lineSeries={lineSeries}
                            compareShortLabel={compareShortLabel}
                            compareLabel={compareLabel}
                          />
                        </div>
                      )}

                      <TargetProgressPanel
                        progress={areaProgress.data?.members[0]?.progress ?? null}
                        threshold={targetThreshold}
                        editMonth={report.latestMonth}
                        loading={areaProgress.loading}
                        compact
                        onAddTarget={onAddTarget ? () => onAddTarget(area) : undefined}
                        onEditTarget={onEditTarget ? (edit) => onEditTarget(area, edit) : undefined}
                      />

                      {(() => {
                        const familyEntries = Object.entries(report.areaFamilyChanges[area] ?? {}).sort(
                          (a, b) => b[1].absDrop - a[1].absDrop,
                        );
                        if (familyEntries.length === 0) return null;
                        return (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">{t.dashboard.byItem}</div>
                          <div className="space-y-2">
                            {familyEntries.map(([fam, fc]) => {
                              const itemOpen = expandedItems.has(fam);

                              return (
                              <div key={fam} className="text-xs">
                                <div
                                  onClick={() => toggleItem(fam)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => e.key === "Enter" && toggleItem(fam)}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-start transition-colors hover:bg-surf2/60"
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: colorForFamily(fam) }}
                                  />
                                  <EditableFieldValue
                                    value={fam}
                                    className="min-w-0 flex-1 truncate text-muted"
                                    title={t.inlineEdit.renameHint}
                                    onSave={(v) => handleRenameSalesField("item", fam, v.trim())}
                                  />
                                  <PctDelta pctChange={fc.pctChange} />
                                  <span className="shrink-0 text-[10px] text-muted">{itemOpen ? t.common.hide : t.common.details}</span>
                                </div>
                                <div className="ps-4 font-mono text-[11px] break-words text-muted">
                                  {t.common.month(report.comparedToMonth)}:{" "}
                                  <EditableValue
                                    value={fc.prevValue}
                                    formatted={formatNumber(fc.prevValue)}
                                    edited={editedCells.get(JSON.stringify([area, fam, report.comparedToMonth]))}
                                    onSave={(v) => handleEditSalesCell(area, fam, report.comparedToMonth, v)}
                                  />{" "}
                                  →{" "}
                                  {t.common.month(report.latestMonth)}:{" "}
                                  <EditableValue
                                    value={fc.currValue}
                                    formatted={formatNumber(fc.currValue)}
                                    edited={editedCells.get(JSON.stringify([area, fam, report.latestMonth]))}
                                    onSave={(v) => handleEditSalesCell(area, fam, report.latestMonth, v)}
                                  />
                                </div>

                                {/* Scope travels down with it: an item opened
                                    under a rep lists that rep's areas, not
                                    every area in the dataset. */}
                                {itemOpen && renderItemDetail(fam, scope)}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })()}

                      <RepHistoryPanel
                        area={area}
                        datasetId={selectedDatasetId!}
                        year={year}
                        assignments={areaAssignments}
                        onChanged={onAssignmentsChanged}
                      />

                      {linkedContext.length > 0 && (
                        <div>
                          <div className="mb-2 text-xs font-semibold text-white">{t.linkedFiles.linkedContextTitle}</div>
                          <div className="space-y-2">
                            {linkedContext.map(({ file, records }) => (
                              <div key={file.id} className="rounded-lg bg-surf2/60 p-3 text-xs">
                                <div className="mb-1 flex items-center gap-1.5">
                                  <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                                    {{ achievement: t.linkedFiles.typeAchievement, kpis: t.linkedFiles.typeKpis, other: t.linkedFiles.typeOther }[file.fileType]}
                                  </span>
                                  <span className="font-semibold text-white" dir="auto">{file.displayName}</span>
                                </div>
                                {records.map((r) => (
                                  <div key={r.id} className="ps-1 text-muted">
                                    {Object.entries(r.data).map(([k, v]) => (
                                      <div key={k} dir="auto">
                                        <span className="text-white">{k}:</span>{" "}
                                        <EditableFieldValue
                                          value={v}
                                          edited={r.isEdited && r.editedAt ? { editedBy: r.editedBy, editedAt: r.editedAt } : undefined}
                                          onSave={(newValue) => handleEditLinkedField(r.id, k, newValue)}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {areaFindings.map((f, i) => (
                        <div key={i} className="break-words rounded-lg bg-surf2 px-3 py-2.5">
                          <p className="mb-1.5">{findingSummary(f, report, t)}</p>
                          {"rootCauseFamily" in f && (
                            <p className="mb-1.5 text-xs text-muted">
                              {t.dashboard.rootCauseItem}{" "}
                              <span className="font-semibold" style={{ color: colorForFamily(f.rootCauseFamily) }}>
                                {f.rootCauseFamily}
                              </span>
                              {" · "}
                              {f.rootCauseDetail.pctChange}% ({t.dashboard.valueDrop(formatNumber(f.rootCauseDetail.absDrop))})
                            </p>
                          )}
                          <p className="text-xs">
                            <span className="font-semibold text-amber">{t.dashboard.decision} </span>
                            {findingDecision(f, t)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
}
