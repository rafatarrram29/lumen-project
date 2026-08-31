"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
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

export function ItemTrendChart({ label, series }: { label: string; series: MonthPoint[] }) {
  if (series.length < 2) return null;

  const data = series.map((pt) => ({ month: `Month ${pt.month}`, value: pt.value }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid stroke="#2a3559" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#8b93b0"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#2a3559" }}
            tickFormatter={(v: string) => v.replace("Month ", "M")}
          />
          <YAxis
            stroke="#8b93b0"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={formatCompact}
          />
          <Tooltip content={CustomTooltip} />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#f2a93b"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f2a93b" }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
