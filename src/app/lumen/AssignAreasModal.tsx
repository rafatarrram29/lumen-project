"use client";

// "Assign areas to reps" — one rep, many areas, in one go.
//
// The per-area card has always had a "+ Add period" control that does this
// one area at a time. That is fine when correcting a single handover and
// miserable when setting up a territory: a rep holding eight governorates
// meant eight trips through the same dialog. This writes exactly the same
// lumen_rep_assignments rows, from one screen.

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { NamePicker, MultiSelectList, ModalShell } from "./OrgControls";

export function AssignAreasModal({
  areas,
  existingReps,
  saving,
  onCancel,
  onSave,
}: {
  areas: string[];
  existingReps: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: (rep: string, areas: string[], startMonth: number, endMonth: number) => void;
}) {
  const { t } = useLanguage();
  const [rep, setRep] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(12);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const name = rep.trim();
    if (!name) return setError(t.org.pickRep);
    if (selected.size === 0) return setError(t.org.pickAtLeastOneArea);
    setError(null);
    onSave(name, [...selected], startMonth, endMonth);
  }

  return (
    <ModalShell
      title={t.org.assignAreasTitle}
      error={error}
      saving={saving}
      onCancel={onCancel}
      onSave={submit}
    >
      <NamePicker
        label={t.org.repLabel}
        value={rep}
        options={existingReps}
        onChange={setRep}
        emptyHint={null}
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted">{t.org.monthsLabel}</label>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelect value={startMonth} onChange={(m) => { setStartMonth(m); if (m > endMonth) setEndMonth(m); }} />
          <span className="text-muted">–</span>
          <MonthSelect value={endMonth} onChange={(m) => { setEndMonth(m); if (m < startMonth) setStartMonth(m); }} />
        </div>
      </div>

      <MultiSelectList
        label={t.org.areasLabel}
        options={areas}
        selected={selected}
        onChange={setSelected}
        emptyHint={t.org.noAreas}
      />
    </ModalShell>
  );
}

function MonthSelect({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const { t } = useLanguage();
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <option key={m} value={m}>
          {t.common.month(m)}
        </option>
      ))}
    </select>
  );
}
