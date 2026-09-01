"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { RepAssignment } from "@/lib/lumen/repAssignments";

export function RepHistoryPanel({
  area,
  datasetId,
  year,
  assignments,
  onChanged,
}: {
  area: string;
  datasetId: string;
  year: number;
  assignments: RepAssignment[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(1);
  const [repName, setRepName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = [...assignments].sort((a, b) => a.startMonth - b.startMonth);

  async function handleSave() {
    setError(null);
    if (endMonth < startMonth) {
      setError(t.repHistory.invalidRange);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/lumen/rep-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          year,
          area,
          rep: repName.trim() || null,
          startMonth,
          endMonth,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save period");
      setAdding(false);
      setRepName("");
      setStartMonth(1);
      setEndMonth(1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save period");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/lumen/rep-assignments/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      onChanged();
    } catch {
      // best-effort; the row simply stays if this fails
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-white">{t.repHistory.title}</div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[11px] font-medium text-amber"
        >
          {t.repHistory.addPeriod}
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {sorted.map((a, i) => (
            <span key={a.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted">→</span>}
              <span className="flex items-center gap-1 rounded-full border border-bdr bg-surf2 px-2 py-1">
                <span dir="auto" className={a.rep ? "text-white" : "text-muted"}>
                  {a.rep ?? t.repHistory.vacant}
                </span>
                <span className="text-muted">
                  M{a.startMonth}–M{a.endMonth}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  title={t.repHistory.deletePeriod}
                  aria-label={t.repHistory.deletePeriod}
                  className="text-muted hover:text-red"
                >
                  ×
                </button>
              </span>
            </span>
          ))}
        </div>
      )}

      {adding && (
        <div className="space-y-2 rounded-lg bg-surf2/60 p-3 text-[11px]">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-muted">
              {t.repHistory.startMonth}
              <input
                type="number"
                min={1}
                max={12}
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="w-14 rounded-lg border border-bdr bg-surf px-2 py-1 font-mono text-white outline-none focus:border-amber"
              />
            </label>
            <label className="flex items-center gap-1.5 text-muted">
              {t.repHistory.endMonth}
              <input
                type="number"
                min={1}
                max={12}
                value={endMonth}
                onChange={(e) => setEndMonth(Number(e.target.value))}
                className="w-14 rounded-lg border border-bdr bg-surf px-2 py-1 font-mono text-white outline-none focus:border-amber"
              />
            </label>
          </div>
          <label className="flex items-center gap-1.5 text-muted">
            {t.repHistory.repNameLabel}
            <input
              type="text"
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              placeholder={t.repHistory.vacantPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf px-2 py-1 text-white outline-none focus:border-amber"
            />
          </label>
          {error && <p className="text-red">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-3 py-1.5 font-semibold text-on-accent disabled:opacity-50"
          >
            {t.repHistory.save}
          </button>
        </div>
      )}
    </div>
  );
}
