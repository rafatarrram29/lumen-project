"use client";

// Sales beside target, month by month, with achievement as a line across
// the top.
//
// Bars for the two amounts and a line for the percentage, rather than
// three bars: sales and target are the same kind of quantity and belong on
// one axis where their heights can be compared directly, while a
// percentage is a different kind of number entirely and gets its own.
// Three bars would invite reading 95% as smaller than 100,000.

import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useRecharts, ChartLoading } from "./useRecharts";
import type { MonthProgress } from "@/lib/lumen/targetProgress";
import type { Translations } from "@/lib/i18n/translations";

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

type Row = { month: string; sales: number; target: number; ach: number | null };

function CustomTooltip({
  active,
  payload,
  label,
  t,
  threshold,
}: TooltipContentProps<ValueType, NameType> & { t: Translations; threshold: number }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as Row | undefined;
  if (!row) return null;
  const under = row.ach !== null && row.ach < threshold;

  return (
    <div className="rounded-lg border border-bdr bg-surf2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-white">{label}</div>
      <div className="flex items-center gap-1.5 text-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        {t.targets.salesLabel} {row.sales.toLocaleString()}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-cyan">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
        {t.targets.targetLabel} {row.target.toLocaleString()}
      </div>
      <div className={`mt-1 font-semibold ${row.ach === null ? "text-muted" : under ? "text-red" : "text-green"}`}>
        {t.targets.achLabel} {row.ach === null ? "—" : `${row.ach}%`}
      </div>
    </div>
  );
}

export function TargetComparisonChart({
  months,
  threshold,
  t,
  height = "h-52",
}: {
  months: MonthProgress[];
  /** The achievement below which a month reads as a miss. */
  threshold: number;
  t: Translations;
  height?: string;
}) {
  const R = useRecharts();
  if (months.length === 0) return null;
  if (!R) return <ChartLoading height={height} />;
  const { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;

  const data: Row[] = months.map((m) => ({
    month: `M${m.month}`,
    sales: m.sales,
    target: m.target,
    ach: m.achPct,
  }));

  return (
    <div className={`${height} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }}>
          <CartesianGrid stroke="var(--bdr)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--bdr)" }} />
          <YAxis
            yAxisId="amount"
            stroke="var(--muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={formatCompact}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            stroke="var(--muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={(props) => <CustomTooltip {...props} t={t} threshold={threshold} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="amount" dataKey="sales" name={t.targets.salesLabel} fill="var(--amber)" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="amount" dataKey="target" name={t.targets.targetLabel} fill="var(--cyan)" fillOpacity={0.45} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="ach"
            name={t.targets.achLabel}
            stroke="var(--green)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--green)" }}
            connectNulls={false}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
