// Linked files: optional extra files attached to a dataset alongside its
// primary Sales file (e.g. Achievement, KPIs). Each one gets its own join
// keys (Area/Rep/Cluster/Month) mapped by the user — never fully automatic
// — so its rows can be matched back to the same area/month shown in the
// sales-based dashboard as supplementary context, without changing the
// underlying sales analysis at all.
import type { RawSheet } from "./columnMapping";

export type LinkedFileType = "achievement" | "kpis" | "other";

export type JoinKey = "area" | "rep" | "cluster" | "month";

export type LinkedFileMapping = {
  area: string | null;
  rep: string | null;
  cluster: string | null;
  month: string;
};

export type LinkedFile = {
  id: string;
  fileType: LinkedFileType;
  displayName: string;
  columnMapping: LinkedFileMapping;
  joinKeys: JoinKey[];
  createdAt: string;
};

export type LinkedRecord = {
  id: string;
  fileId: string;
  area: string | null;
  rep: string | null;
  cluster: string | null;
  month: number;
  data: Record<string, unknown>;
  isEdited: boolean;
  editedAt: string | null;
  editedBy: string | null;
};

const TYPE_GUESS_RULES: { type: LinkedFileType; keywords: string[] }[] = [
  { type: "achievement", keywords: ["achievement", "achieved", "attainment"] },
  { type: "kpis", keywords: ["kpi", "coverage", "compliance", "visit frequency"] },
];

// Best-effort suggestion only — always shown to the user for confirmation
// before saving, never applied silently.
export function guessFileType(headers: string[]): LinkedFileType {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const rule of TYPE_GUESS_RULES) {
    if (normalized.some((h) => rule.keywords.some((k) => h.includes(k)))) {
      return rule.type;
    }
  }
  return "other";
}

type JoinGuessRule = { field: keyof LinkedFileMapping; keywords: string[] };

const JOIN_GUESS_RULES: JoinGuessRule[] = [
  { field: "area", keywords: ["area", "region", "territory"] },
  { field: "rep", keywords: ["rep", "representative", "salesperson", "agent"] },
  { field: "cluster", keywords: ["cluster", "group", "district", "zone"] },
  { field: "month", keywords: ["month", "period"] },
];

export function guessLinkedMapping(headers: string[]): Partial<Record<keyof LinkedFileMapping, string>> {
  const guess: Partial<Record<keyof LinkedFileMapping, string>> = {};
  const used = new Set<string>();

  for (const rule of JOIN_GUESS_RULES) {
    let best: string | null = null;
    let bestScore = 0;
    for (const header of headers) {
      if (used.has(header)) continue;
      const normalized = header.trim().toLowerCase();
      for (const keyword of rule.keywords) {
        const score = normalized === keyword ? keyword.length + 1000 : normalized.includes(keyword) ? keyword.length : 0;
        if (score > bestScore) {
          best = header;
          bestScore = score;
        }
      }
    }
    if (best) {
      guess[rule.field] = best;
      used.add(best);
    }
  }

  return guess;
}

// Pre-checks join keys the new file plausibly shares with the dataset's
// existing sales mapping — a starting point the user still confirms or
// edits in the modal, never applied without review.
export function suggestedJoinKeys(
  linkedGuess: Partial<Record<keyof LinkedFileMapping, string>>,
  salesMapping: { rep: string | null; cluster: string | null },
): JoinKey[] {
  const keys: JoinKey[] = [];
  if (linkedGuess.month) keys.push("month");
  if (linkedGuess.area) keys.push("area");
  if (linkedGuess.rep && salesMapping.rep) keys.push("rep");
  if (linkedGuess.cluster && salesMapping.cluster) keys.push("cluster");
  return keys;
}

export type ParsedLinkedRow = {
  area: string | null;
  rep: string | null;
  cluster: string | null;
  month: number;
  data: Record<string, unknown>;
};

export function applyLinkedMapping(sheet: RawSheet, mapping: LinkedFileMapping): ParsedLinkedRow[] {
  const mappedHeaders = new Set(
    [mapping.area, mapping.rep, mapping.cluster, mapping.month].filter((v): v is string => v !== null),
  );
  const rows: ParsedLinkedRow[] = [];

  for (const r of sheet.rows) {
    const monthVal = r[mapping.month];
    if (monthVal == null) continue;
    const month = Math.trunc(Number(monthVal));
    if (Number.isNaN(month)) continue;

    const areaVal = mapping.area ? r[mapping.area] : null;
    const repVal = mapping.rep ? r[mapping.rep] : null;
    const clusterVal = mapping.cluster ? r[mapping.cluster] : null;

    const data: Record<string, unknown> = {};
    for (const header of sheet.headers) {
      if (mappedHeaders.has(header)) continue;
      if (r[header] != null) data[header] = r[header];
    }

    rows.push({
      area: areaVal != null ? String(areaVal) : null,
      rep: repVal != null ? String(repVal) : null,
      cluster: clusterVal != null ? String(clusterVal) : null,
      month,
      data,
    });
  }

  if (rows.length === 0) {
    throw new Error("No usable rows found after applying the column mapping.");
  }

  return rows;
}

// Matches a linked file's records to a given area + month, honoring only
// the join keys that file was actually configured with (a file joined by
// rep alone, say, is skipped here — area-level display only surfaces
// files that join by area).
export function recordsForAreaMonth(
  file: LinkedFile,
  records: LinkedRecord[],
  area: string,
  month: number,
): LinkedRecord[] {
  if (!file.joinKeys.includes("area") || !file.joinKeys.includes("month")) return [];
  return records.filter((r) => r.fileId === file.id && r.area === area && r.month === month);
}
