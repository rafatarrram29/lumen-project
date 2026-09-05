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

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { MonthPoint } from "@/lib/lumen/engine";
import { areasUnderManager, type OrgManager } from "@/lib/lumen/orgStructure";
import { ItemTrendChart } from "./ItemTrendChart";

type ItemSeries = Record<string, MonthPoint[]>;

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function ManagerCards({
  managers,
  datasetId,
  year,
  hasQuantity,
}: {
  managers: OrgManager[];
  datasetId: string;
  year: number;
  /** From the report — whether the dataset carries real quantities. */
  hasQuantity: boolean;
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
                  <TeamDetail manager={manager} datasetId={datasetId} year={year} hasQuantity={hasQuantity} />
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
}: {
  manager: OrgManager;
  datasetId: string;
  year: number;
  hasQuantity: boolean;
}) {
  const { t } = useLanguage();
  const areas = areasUnderManager(manager);
  // Identifies the request, so a slow answer for one manager cannot land in
  // another manager's card after the user has moved on — the result is only
  // used when its key still matches what is being shown.
  const requestKey = `${datasetId}:${year}:${areas.join("|")}`;
  const [fetched, setFetched] = useState<{ key: string; items: ItemSeries; hasQuantity: boolean } | null>(null);
  const latestRequest = useRef(requestKey);

  useEffect(() => {
    if (areas.length === 0) return;
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
          setFetched({ key: requestKey, items: {}, hasQuantity });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // A manager with no areas has nothing to fetch, so that answer is derived
  // here rather than written into state by the effect.
  const ready = fetched?.key === requestKey ? fetched : null;
  const items: ItemSeries | null = areas.length === 0 ? {} : (ready?.items ?? null);
  const itemsHaveQuantity = ready ? ready.hasQuantity : hasQuantity;
  const unitLabel = itemsHaveQuantity ? t.units.units : t.units.value;

  return (
    <div className="space-y-4">
      {manager.reps.map((rep) => (
        <div key={rep.rep} className="rounded-xl border border-bdr bg-surf2/40 p-3">
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
              {rep.areas.map((area) => (
                <div key={area.area} className="flex items-center justify-between gap-3 text-xs">
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
                </div>
              ))}
            </div>
          )}
        </div>
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
