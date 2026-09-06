"use client";

// District manager cards, and the whole team underneath one when opened.
//
// The hierarchy the card expands into is the point of the feature:
//
//     manager -> reps -> the areas each rep covers -> the items sold there
//
// Item charts are fetched when a card is opened rather than shipped with
// the report: they are scoped to this manager's areas, and carrying area x
// item x month for every manager in the main payload is exactly the weight
// the database-side aggregate removed.
//
// Scope narrows as you go down. A manager's block is fixed to their team's
// areas; a rep's areas inside it narrow again to that rep's own. Every
// figure below a card belongs to that card — an item opened under a rep who
// covers three governorates lists those three, not the thirty in the file.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { MonthPoint } from "@/lib/lumen/engine";
import { areasUnderManager, type AreaScope, type OrgManager, type OrgRep } from "@/lib/lumen/orgStructure";
import { ItemTrendChart } from "./ItemTrendChart";
import type { ReactNode } from "react";

type ItemSeries = Record<string, MonthPoint[]>;

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** The full area card, narrowed to some part of the org chart. */
type RenderAreaDetail = (area: string, scope?: AreaScope | null) => ReactNode;

/**
 * Per-item monthly totals for exactly these areas.
 *
 * Fetched rather than derived from the report: the report deliberately
 * stopped carrying area x item x month for the whole dataset, so the only
 * place those numbers exist for an arbitrary slice is the database.
 *
 * `enabled` is what keeps this from turning into a request per rep the
 * moment a manager is opened — a rep's slice is only fetched once one of
 * their areas is actually opened.
 */
function useScopedItems(
  datasetId: string,
  year: number,
  areas: string[],
  fallbackHasQuantity: boolean,
  enabled: boolean,
): { items: ItemSeries | null; hasQuantity: boolean } {
  // Identifies the request, so a slow answer for one slice cannot land in
  // another's card after the user has moved on — the result is only used
  // when its key still matches what is being shown.
  const requestKey = `${datasetId}:${year}:${areas.join("|")}`;
  const [fetched, setFetched] = useState<{ key: string; items: ItemSeries; hasQuantity: boolean } | null>(null);
  const latestRequest = useRef(requestKey);

  useEffect(() => {
    if (!enabled || areas.length === 0) return;
    latestRequest.current = requestKey;
    let alive = true;
    fetch("/api/lumen/org-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, year, areas }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!alive || latestRequest.current !== requestKey) return;
        setFetched({ key: requestKey, items: json.items ?? {}, hasQuantity: Boolean(json.hasQuantity) });
      })
      .catch(() => {
        if (alive && latestRequest.current === requestKey) {
          setFetched({ key: requestKey, items: {}, hasQuantity: fallbackHasQuantity });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled]);

  // A slice with no areas has nothing to fetch, so that answer is derived
  // here rather than written into state by the effect.
  const ready = fetched?.key === requestKey ? fetched : null;
  return {
    items: areas.length === 0 ? {} : (ready?.items ?? null),
    hasQuantity: ready ? ready.hasQuantity : fallbackHasQuantity,
  };
}

export function ManagerCards({
  managers,
  datasetId,
  year,
  hasQuantity,
  renderAreaDetail,
  onAreaOpen,
}: {
  managers: OrgManager[];
  datasetId: string;
  year: number;
  /** From the report — whether the dataset carries real quantities. */
  hasQuantity: boolean;
  /**
   * The full area card, rendered by its one owner (AreaDetail, via
   * LumenClient) and dropped in here.
   *
   * Passed in rather than imported and assembled locally so that the area
   * a manager opens is literally the card the Sales tab shows — same
   * component, same props, same inline editing and rep history — instead
   * of a lighter copy that drifts from it. Returns null for an area the
   * report has no figures for. The scope argument narrows everything
   * inside that card to the rep whose row was tapped.
   */
  renderAreaDetail: RenderAreaDetail;
  /**
   * Called when an area is opened here, so the dashboard can expand that
   * area in its own state. The card reads its expanded/collapsed state
   * from one place; without this it would render collapsed and the
   * drill-down would show a summary row instead of the card.
   */
  onAreaOpen: (area: string) => void;
}) {
  const { t } = useLanguage();
  const [openManager, setOpenManager] = useState<string | null>(null);

  if (managers.length === 0) {
    return (
      <div className="mb-6">
        <div className="mb-2 text-sm font-semibold text-white">{t.org.managersTitle}</div>
        <p className="rounded-2xl border border-bdr px-4 py-3 text-sm text-muted">{t.org.noManagers}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="mb-1 text-sm font-semibold text-white">{t.org.managersTitle}</div>
      <div className="mb-3 text-xs text-muted">{t.org.managersSubtitle}</div>

      <div className="space-y-2">
        {managers.map((manager) => {
          const open = openManager === manager.manager;
          return (
            <div key={manager.manager} className="rounded-2xl border border-bdr bg-surf">
              <button
                type="button"
                data-testid="manager-card"
                onClick={() => setOpenManager(open ? null : manager.manager)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white" dir="auto">
                    {manager.manager}
                  </div>
                  <div className="text-xs text-muted">{t.org.repCount(manager.repCount)}</div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="font-mono text-sm font-semibold text-amber">{formatNumber(manager.totalValue)}</div>
                  <div className="text-[11px] text-muted">{t.org.teamTotal}</div>
                </div>
              </button>

              {open && (
                <div className="border-t border-bdr px-4 py-3">
                  <TeamDetail
                    manager={manager}
                    datasetId={datasetId}
                    year={year}
                    hasQuantity={hasQuantity}
                    renderAreaDetail={renderAreaDetail}
                    onAreaOpen={onAreaOpen}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamDetail({
  manager,
  datasetId,
  year,
  hasQuantity,
  renderAreaDetail,
  onAreaOpen,
}: {
  manager: OrgManager;
  datasetId: string;
  year: number;
  hasQuantity: boolean;
  renderAreaDetail: RenderAreaDetail;
  onAreaOpen: (area: string) => void;
}) {
  const { t } = useLanguage();
  // Which area's full card is open under this manager. One at a time: the
  // card is tall, and two of them open at once buries the team it belongs
  // to. Held here rather than per rep so opening an area under one rep
  // closes whatever was open under another.
  const [openArea, setOpenArea] = useState<string | null>(null);
  const areas = areasUnderManager(manager);
  const { items, hasQuantity: itemsHaveQuantity } = useScopedItems(datasetId, year, areas, hasQuantity, true);
  const unitLabel = itemsHaveQuantity ? t.units.units : t.units.value;

  return (
    <div className="space-y-4">
      {manager.reps.map((rep) => (
        <RepBlock
          key={rep.rep}
          rep={rep}
          datasetId={datasetId}
          year={year}
          hasQuantity={hasQuantity}
          openArea={openArea}
          setOpenArea={setOpenArea}
          renderAreaDetail={renderAreaDetail}
          onAreaOpen={onAreaOpen}
        />
      ))}

      <div>
        <div className="mb-1 text-sm font-semibold text-white">{t.org.itemsUnderManager}</div>
        <div className="mb-2 text-[11px] text-muted">
          {itemsHaveQuantity ? t.units.unitsNote : t.units.valueNote}
        </div>
        {items === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-surf2" />
        ) : Object.keys(items).length === 0 ? (
          <p className="text-xs text-muted">{t.org.noAreasForRep}</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(items)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([item, series]) => (
                <div key={item} data-testid="manager-item-chart">
                  <div className="mb-1 text-[11px] font-semibold text-white" dir="auto">
                    {item} — {unitLabel}
                  </div>
                  <ItemTrendChart
                    label={item}
                    series={series}
                    showUnits={itemsHaveQuantity}
                    unitLabel={unitLabel}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One rep inside a manager's team, and the areas they cover.
 *
 * This exists so the rep's own slice of the data has somewhere to live.
 * Everything opened under this block — the area card, its trend, its item
 * breakdown, the "By area" list inside an item — is scoped to the areas
 * listed right here.
 */
function RepBlock({
  rep,
  datasetId,
  year,
  hasQuantity,
  openArea,
  setOpenArea,
  renderAreaDetail,
  onAreaOpen,
}: {
  rep: OrgRep;
  datasetId: string;
  year: number;
  hasQuantity: boolean;
  openArea: string | null;
  setOpenArea: (area: string | null) => void;
  renderAreaDetail: RenderAreaDetail;
  onAreaOpen: (area: string) => void;
}) {
  const { t } = useLanguage();
  const repAreas = useMemo(() => rep.areas.map((a) => a.area), [rep.areas]);
  const ownsOpenArea = openArea !== null && repAreas.includes(openArea);
  // Only fetched once one of this rep's areas is actually open — a manager
  // with eight reps would otherwise fire eight requests on every expand.
  const { items, hasQuantity: itemsHaveQuantity } = useScopedItems(
    datasetId,
    year,
    repAreas,
    hasQuantity,
    ownsOpenArea,
  );

  // Null until the rep's own numbers are in hand. Rendering the card with a
  // half-built scope would show the whole dataset for a beat and then snap
  // to three areas, which is the bug this fixes, briefly.
  const scope: AreaScope | null =
    items === null
      ? null
      : {
          areas: repAreas,
          itemSeries: items,
          hasQuantity: itemsHaveQuantity,
          label: t.org.repAreasLabel(rep.rep),
          shortLabel: t.org.repAreasShort,
        };

  return (
    <div className="rounded-xl border border-bdr bg-surf2/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-sm font-semibold text-white" dir="auto">
          {rep.rep}
        </div>
        <div className="shrink-0 font-mono text-sm text-amber">{formatNumber(rep.totalValue)}</div>
      </div>

      {rep.areas.length === 0 ? (
        <p className="text-xs text-muted">{t.org.noAreasForRep}</p>
      ) : (
        <div className="space-y-1">
          {rep.areas.map((area) => {
            const areaOpen = openArea === area.area;
            return (
              <div key={area.area}>
                <button
                  type="button"
                  data-testid="manager-area-row"
                  onClick={() => {
                    setOpenArea(areaOpen ? null : area.area);
                    if (!areaOpen) onAreaOpen(area.area);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-start text-xs transition-colors hover:bg-surf2"
                >
                  <div className="min-w-0">
                    <span className={`truncate ${area.currentlyHeld ? "text-white" : "text-muted"}`} dir="auto">
                      {area.area}
                    </span>
                    <span className="ms-2 text-muted">{t.org.coversMonths(area.months.join(", "))}</span>
                    {/* An area handed over mid-year still belongs in the
                        rep's history, but its latest-month figure is
                        somebody else's — say so rather than letting the
                        number look like it counts. */}
                    {!area.currentlyHeld && <span className="ms-2 text-[10px] text-muted">{t.org.pastCoverage}</span>}
                  </div>
                  <div className={`shrink-0 font-mono ${area.currentlyHeld ? "text-muted" : "text-muted/50"}`}>
                    {area.currValue !== null ? formatNumber(area.currValue) : "—"}
                    {area.pctChange !== null && (
                      <span className={area.pctChange < 0 ? " text-red" : " text-green"}>
                        {" "}
                        {area.pctChange > 0 ? "+" : ""}
                        {area.pctChange}%
                      </span>
                    )}
                  </div>
                </button>

                {/* The real thing: the same card the Sales tab renders,
                    with its trend, per-item breakdown, rep history and
                    inline editing — not a summary of it. Scoped to this
                    rep's areas, so nothing inside it reaches past them. */}
                {areaOpen && (
                  <div data-testid="manager-area-detail" className="mt-2">
                    {scope === null ? (
                      <div className="h-24 animate-pulse rounded-lg bg-surf2" />
                    ) : (
                      renderAreaDetail(area.area, scope)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
