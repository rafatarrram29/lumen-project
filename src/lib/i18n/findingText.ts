import { DEFAULT_LINE, type Finding, type Report } from "@/lib/lumen/engine";
import type { Translations } from "./translations";

type SuccessReport = Extract<Report, { findings: Finding[] }>;

// Findings carry pre-built English sentences from engine.ts for non-UI
// consumers (logs, tests), but the app renders localized text built from
// the same underlying structured fields via these helpers instead.
export function findingSummary(f: Finding, report: SuccessReport, t: Translations): string {
  if (f.type === "systemic_drop") {
    const linePhrase = f.line === DEFAULT_LINE ? "" : t.findings.inLine(f.line);
    return t.findings.systemicSummary(f.droppingCount, f.totalAreas, linePhrase, report.comparedToMonth, report.latestMonth);
  }
  if (f.type === "local_drop") {
    return t.findings.localSummary(f.area, f.pctChange ?? 0);
  }
  return t.findings.transferSummary(f.family, f.pctChange, f.area);
}

export function findingDecision(f: Finding, t: Translations): string {
  if (f.type === "systemic_drop") return t.findings.systemicDecision(f.rootCauseFamily);
  if (f.type === "local_drop") return t.findings.localDecision(f.rootCauseFamily, f.area);
  return t.findings.transferDecision(f.family, f.area);
}
