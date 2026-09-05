"use client";

// Type-only — see useRecharts.tsx.
import type { TooltipContentProps } from "recharts";
import { useRecharts, ChartLoading } from "./useRecharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { MonthPoint } from "@/lib/lumen/engine";

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;

  return (
    <div className="rounded-lg border border-bdr bg-surf2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-white">{label}</div>
      <div className="flex items-center gap-1.5 text-amber">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

/**
 * An item's trend, in UNITS where the uploaded file has a quantity column
 * and in money where it doesn't.
 *
 * The two are not interchangeable and a chart that quietly switched between
 * them would be worse than one that only ever showed money — so the unit is
 * named on the chart itself, every time, rather than being left for the
 * reader to infer from the size of the numbers.
 */
export function ItemTrendChart({
  label,
  series,
  showUnits,
  unitLabel,
}: {
  label: string;
  series: MonthPoint[];
  /** True when the dataset has real quantities — see Report.hasQuantity. */
  showUnits?: boolean;
  /** "Units" or "Value", already translated. */
  unitLabel?: string;
}) {
  const R = useRecharts();
  if (series.length < 2) return null;
  if (!R) return <ChartLoading height="h-40" />;
  const { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } = R;

  const data = series.map((pt) => ({ month: `Month ${pt.month}`, value: showUnits ? pt.qty : pt.value }));
  const seriesName = unitLabel ? `${label} (${unitLabel})` : label;

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid stroke="var(--bdr)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "var(--bdr)" }}
            tickFormatter={(v: string) => v.replace("Month ", "M")}
          />
          <YAxis
            stroke="var(--muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={formatCompact}
            label={
              unitLabel
                ? { value: unitLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--muted)" }
                : undefined
            }
          />
          <Tooltip content={CustomTooltip} />
          <Line
            type="monotone"
            dataKey="value"
            name={seriesName}
            stroke="var(--amber)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--amber)" }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
