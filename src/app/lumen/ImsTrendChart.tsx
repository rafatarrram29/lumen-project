"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colorForFamily } from "@/lib/lumen/familyColors";
import type { ImsSharePoint } from "@/lib/lumen/imsEngine";

const MAX_COMPETITOR_LINES = 3;

// A single-month snapshot (the common case for a PDF table with no
// per-row month column) still renders here — recharts just draws a lone
// dot per line rather than a connected trend, which is the honest picture
// of what the data actually has, not a fabricated line between two points
// that don't exist.
export function ImsTrendChart({ series, ownLabel }: { series: ImsSharePoint[]; ownLabel: string }) {
  const latest = series[series.length - 1];
  const topCompetitorNames = [...latest.competitorShares]
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_COMPETITOR_LINES)
    .map((c) => c.company);

  const data = series.map((pt) => {
    const row: Record<string, number | string | null> = { month: `M${pt.month}`, [ownLabel]: pt.ourShare };
    for (const name of topCompetitorNames) {
      row[name] = pt.competitorShares.find((c) => c.company === name)?.share ?? null;
    }
    return row;
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid stroke="var(--bdr)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--bdr)" }} />
          <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} width={40} unit="%" />
          <Tooltip
            contentStyle={{ background: "var(--surf2)", border: "1px solid var(--bdr)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey={ownLabel}
            stroke="var(--amber)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--amber)" }}
            connectNulls
            isAnimationActive
          />
          {topCompetitorNames.map((name) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colorForFamily(name)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={{ r: 2 }}
              connectNulls
              isAnimationActive
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
