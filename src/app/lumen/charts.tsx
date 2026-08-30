import { colorForFamily } from "@/lib/lumen/familyColors";

export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "amber" | "green";
}) {
  const toneClass = {
    default: "text-white",
    red: "text-red",
    amber: "text-amber",
    green: "text-green",
  }[tone];

  return (
    <div className="rounded-xl border border-bdr bg-surf p-3.5">
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className={`truncate font-mono text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

const MAX_BAR_ROWS = 12;

export function AreaChangeBars({
  areas,
}: {
  areas: [string, { pctChange: number | null }][];
}) {
  const plotted = areas
    .filter(([, d]) => d.pctChange !== null)
    .sort((a, b) => Math.abs(b[1].pctChange!) - Math.abs(a[1].pctChange!))
    .slice(0, MAX_BAR_ROWS);

  if (plotted.length === 0) return null;

  const maxAbs = Math.max(...plotted.map(([, d]) => Math.abs(d.pctChange!)), 1);
  const remaining = areas.length - plotted.length;

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Biggest movers</h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red" /> Decline
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green" /> Growth
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {plotted.map(([area, d]) => {
          const pct = d.pctChange!;
          const isDrop = pct < 0;
          const widthPct = (Math.abs(pct) / maxAbs) * 50;

          return (
            <div key={area} className="flex items-center gap-2 text-xs">
              <div className="w-24 shrink-0 truncate text-muted sm:w-36" title={area}>
                {area}
              </div>
              <div className="relative h-2 min-w-0 flex-1 rounded-full bg-surf2">
                <div className="absolute inset-y-0 left-1/2 w-px bg-bdr" />
                <div
                  className={`absolute inset-y-0 rounded-full ${isDrop ? "bg-red" : "bg-green"}`}
                  style={
                    isDrop
                      ? { right: "50%", width: `${widthPct}%` }
                      : { left: "50%", width: `${widthPct}%` }
                  }
                />
              </div>
              <div
                className={`w-14 shrink-0 text-right font-mono ${isDrop ? "text-red" : "text-green"}`}
              >
                {isDrop ? "" : "+"}
                {pct}%
              </div>
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <p className="mt-3 text-xs text-muted">
          +{remaining} more area{remaining === 1 ? "" : "s"} in the list below.
        </p>
      )}
    </div>
  );
}

export function FamilyDonut({
  families,
}: {
  families: Record<string, { absDrop: number }>;
}) {
  const segments = Object.entries(families)
    .filter(([, v]) => v.absDrop > 0)
    .sort((a, b) => b[1].absDrop - a[1].absDrop);

  const total = segments.reduce((sum, [, v]) => sum + v.absDrop, 0);
  if (total <= 0) return null;

  const r = 40;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * r;

  const arcs = segments.reduce<{ family: string; dash: number; gap: number; offset: number }[]>(
    (acc, [family, v]) => {
      const pct = (v.absDrop / total) * 100;
      const runningPct = acc.reduce((sum, a) => sum + (a.dash / circumference) * 100, 0);
      return [
        ...acc,
        {
          family,
          dash: (pct / 100) * circumference,
          gap: circumference - (pct / 100) * circumference,
          offset: (runningPct / 100) * circumference,
        },
      ];
    },
    [],
  );

  return (
    <div className="rounded-2xl border border-bdr bg-surf p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Decline by product family</h2>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0 -rotate-90">
          {arcs.map(({ family, dash, gap, offset }) => (
            <circle
              key={family}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={colorForFamily(family)}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
            />
          ))}
        </svg>

        <div className="w-full min-w-0 space-y-1.5">
          {segments.map(([family, v]) => (
            <div key={family} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorForFamily(family) }}
              />
              <span className="min-w-0 flex-1 truncate">{family}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {((v.absDrop / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
