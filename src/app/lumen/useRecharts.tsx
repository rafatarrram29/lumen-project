"use client";

// recharts is ~409 KB on the wire — measured, minified, by loading the
// dashboard with an empty database and diffing the JS the browser fetched
// with and without it. It is needed only once a chart is actually on
// screen: an expanded area or rep row, an item's trend, or the Market
// Insights tab. Most visits open none of those.
//
// Getting it out of the first paint took three attempts, so the mechanism
// is worth writing down:
//
//   1. next/dynamic() on the chart components — no effect. Under Turbopack
//      the recharts chunk still came through as a <script> tag in the
//      page's own server-rendered HTML.
//   2. React.lazy + Suspense — worse (1080 KB vs 861 KB): it pulled other
//      modules back into the initial graph without moving recharts at all.
//   3. This: no module in the page's static import graph mentions recharts
//      at all. The only reference is a runtime import() inside a hook, so
//      the bundler has nothing to hoist into the page, and the browser
//      fetches it the first time a chart mounts.
//
// Type-only imports elsewhere are fine — they are erased before the
// bundler ever sees them.

import { useEffect, useState } from "react";

export type Recharts = typeof import("recharts");

// Module-level so a second chart on the same page reuses the first one's
// download instead of starting its own, and so a chart that has already
// been opened once renders immediately on the next open.
let loaded: Recharts | null = null;
let loading: Promise<Recharts> | null = null;

/** Returns recharts once it has arrived, or null while it is in flight. */
export function useRecharts(): Recharts | null {
  const [mod, setMod] = useState<Recharts | null>(loaded);

  useEffect(() => {
    if (loaded) return;
    let alive = true;
    loading ??= import("recharts");
    loading.then((m) => {
      loaded = m;
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  return mod;
}

/** Holds a chart's height while its code is in flight, so nothing jumps. */
export function ChartLoading({ height }: { height: string }) {
  return <div className={`${height} w-full animate-pulse rounded-lg bg-surf2`} />;
}
