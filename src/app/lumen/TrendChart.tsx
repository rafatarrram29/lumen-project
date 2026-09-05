"use client";

// Type-only: erased before bundling, so this does not pull recharts into
// the page's import graph. The components themselves arrive at runtime —
// see useRecharts.tsx.
import type { TooltipContentProps } from "recharts";
import { useRecharts, ChartLoading } from "./useRecharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

type AreaPoint = { month: number; value: number };
type LinePoint = { month: number; avgValue: number };

type ChartRow = {
  month: string;
  areaIndex: number | null;
  areaValue: number | null;
  lineIndex: number | null;
  lineValue: number | null;
};

function CustomTooltip({
  active,
  payload,
  label,
  t,
  thisLabel,
  compareLabel,
}: TooltipContentProps<ValueType, NameType> & {
  t: Translations;
  thisLabel: string;
  compareLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartRow | undefined;

  return (
    <div className="rounded-lg border border-bdr bg-surf2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-white">{label}</div>
      {row?.areaValue !== null && row?.areaValue !== undefined && (
        <div className="flex items-center gap-1.5 text-amber">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          {thisLabel} {row.areaIndex}
          {` ${t.chart.idx} · `}
          {row.areaValue.toLocaleString()}
        </div>
      )}
      {row?.lineValue !== null && row?.lineValue !== undefined && (
        <div className="mt-1 flex items-center gap-1.5 text-cyan">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
          {compareLabel} {row.lineIndex}
          {` ${t.chart.idx} · `}
          {row.lineValue.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  areaLabel,
  areaSeries,
  lineSeries,
  compareShortLabel,
  compareLabel,
}: {
  areaLabel: string;
  areaSeries: AreaPoint[];
  lineSeries: LinePoint[];
  compareShortLabel?: string;
  compareLabel?: string;
}) {
  const { t } = useLanguage();
  const R = useRecharts();
  if (areaSeries.length < 2) return null;
  if (!R) return <ChartLoading height="h-56" />;
  const { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;

  const thisShortLabel = t.chart.thisArea;
  const resolvedCompareShort = compareShortLabel ?? t.chart.lineAvg;
  const resolvedCompareLabel = compareLabel ?? t.chart.lineAverage;

  const baseArea = areaSeries[0].value || 1;
  const baseLine = lineSeries[0]?.avgValue || 1;

  const data: ChartRow[] = areaSeries.map((pt, i) => {
    const linePt = lineSeries[i];
    return {
      month: `Month ${pt.month}`,
      areaIndex: Math.round((pt.value / baseArea) * 100),
      areaValue: pt.value,
      lineIndex: linePt ? Math.round((linePt.avgValue / baseLine) * 100) : null,
      lineValue: linePt ? linePt.avgValue : null,
    };
  });

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="var(--bdr)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--muted)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "var(--bdr)" }}
              tickFormatter={(v: string) => v.replace("Month ", "M")}
            />
            <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              content={(props) => (
                <CustomTooltip {...props} t={t} thisLabel={thisShortLabel} compareLabel={resolvedCompareShort} />
              )}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="areaIndex"
              name={areaLabel}
              stroke="var(--amber)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--amber)" }}
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="lineIndex"
              name={resolvedCompareLabel}
              stroke="var(--cyan)"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: "var(--cyan)" }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
