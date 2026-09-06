"use client";

// Fetches Target vs Achievement for one card's scope.
//
// Lazy, like the manager card's item charts: the comparison needs month x
// item detail for the scope, and shipping that for every rep in the report
// payload is the weight the database-side aggregate was added to remove. A
// card is opened deliberately, so its plan is fetched then.

import { useEffect, useRef, useState } from "react";
import type { Progress, TeamProgress } from "@/lib/lumen/targetProgress";

export type ProgressScopeRequest = { rep?: string | null; areas?: string[] };

export type TargetProgressResult = {
  members: { rep: string; progress: Progress }[];
  team: TeamProgress | null;
  hasAnyTarget: boolean;
};

export function useTargetProgress({
  datasetId,
  year,
  scopes,
  threshold,
  enabled,
  version,
}: {
  datasetId: string | null;
  year: number;
  scopes: ProgressScopeRequest[];
  threshold: number;
  enabled: boolean;
  /** Bumped after an upload or a manual edit, to refetch. */
  version: number;
}): { data: TargetProgressResult | null; loading: boolean } {
  // Identifies the request, so a slow answer for one card cannot land in
  // another's after the user has moved on.
  const key = `${datasetId}:${year}:${threshold}:${version}:${JSON.stringify(scopes)}`;
  const [fetched, setFetched] = useState<{ key: string; data: TargetProgressResult } | null>(null);
  const latest = useRef(key);

  useEffect(() => {
    if (!enabled || !datasetId || scopes.length === 0) return;
    latest.current = key;
    let alive = true;
    fetch("/api/lumen/target-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, year, threshold, scopes }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!alive || latest.current !== key) return;
        setFetched({
          key,
          data: { members: json.members ?? [], team: json.team ?? null, hasAnyTarget: Boolean(json.hasAnyTarget) },
        });
      })
      .catch(() => {
        if (alive && latest.current === key) {
          setFetched({ key, data: { members: [], team: null, hasAnyTarget: false } });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const ready = fetched?.key === key ? fetched.data : null;
  return { data: ready, loading: enabled && ready === null };
}
