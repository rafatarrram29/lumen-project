"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

type AreaPoint = { month: number; value: number };
type ClusterPoint = { month: number; avgValue: number };

type ChartRow = {
  month: string;
  areaIndex: number | null;
  areaValue: number | null;
  clusterIndex: number | null;
  clusterValue: number | null;
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
      {row?.clusterValue !== null && row?.clusterValue !== undefined && (
        <div className="mt-1 flex items-center gap-1.5 text-cyan">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
          {compareLabel} {row.clusterIndex}
          {` ${t.chart.idx} · `}
          {row.clusterValue.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  areaLabel,
  areaSeries,
  clusterSeries,
  compareShortLabel,
  compareLabel,
}: {
  areaLabel: string;
  areaSeries: AreaPoint[];
  clusterSeries: ClusterPoint[];
  compareShortLabel?: string;
  compareLabel?: string;
}) {
  const { t } = useLanguage();
  if (areaSeries.length < 2) return null;

  const thisShortLabel = t.chart.thisArea;
  const resolvedCompareShort = compareShortLabel ?? t.chart.clusterAvg;
  const resolvedCompareLabel = compareLabel ?? t.chart.clusterAverage;

  const baseArea = areaSeries[0].value || 1;
  const baseCluster = clusterSeries[0]?.avgValue || 1;

  const data: ChartRow[] = areaSeries.map((pt, i) => {
    const clusterPt = clusterSeries[i];
    return {
      month: `Month ${pt.month}`,
      areaIndex: Math.round((pt.value / baseArea) * 100),
      areaValue: pt.value,
      clusterIndex: clusterPt ? Math.round((clusterPt.avgValue / baseCluster) * 100) : null,
      clusterValue: clusterPt ? clusterPt.avgValue : null,
    };
  });

  return (
    <div>
      <div className="mb-1 text-xs text-muted">{t.chart.indexedCaption(areaLabel, resolvedCompareLabel)}</div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="#2a3559" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#8b93b0"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#2a3559" }}
              tickFormatter={(v: string) => v.replace("Month ", "M")}
            />
            <YAxis stroke="#8b93b0" fontSize={11} tickLine={false} axisLine={false} width={40} />
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
              stroke="#f2a93b"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f2a93b" }}
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="clusterIndex"
              name={resolvedCompareLabel}
              stroke="#5eead4"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, fill: "#5eead4" }}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
