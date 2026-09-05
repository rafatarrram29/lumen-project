"use client";

// "Assign reps to managers" — one district manager, many reps.
//
// A rep reports to exactly one manager, so picking a rep who already has
// one moves them. That is said out loud in the dialog rather than being
// discovered afterwards.

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { managerForRep, type ManagerLink } from "@/lib/lumen/orgStructure";
import { NamePicker, MultiSelectList, ModalShell } from "./OrgControls";

export function AssignManagersModal({
  reps,
  links,
  saving,
  onCancel,
  onSave,
}: {
  reps: string[];
  links: ManagerLink[];
  saving: boolean;
  onCancel: () => void;
  onSave: (manager: string, reps: string[]) => void;
}) {
  const { t } = useLanguage();
  const [manager, setManager] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const existingManagers = [...new Set(links.map((l) => l.manager))].sort((a, b) => a.localeCompare(b));

  // Reps in the selection who would be moved off another manager.
  const moving = [...selected]
    .map((rep) => ({ rep, from: managerForRep(links, rep) }))
    .filter((m): m is { rep: string; from: string } => m.from !== null && m.from !== manager.trim());

  function submit() {
    const name = manager.trim();
    if (!name) return setError(t.org.pickManager);
    if (selected.size === 0) return setError(t.org.pickAtLeastOneRep);
    setError(null);
    onSave(name, [...selected]);
  }

  return (
    <ModalShell
      title={t.org.assignManagersTitle}
      error={error}
      saving={saving}
      onCancel={onCancel}
      onSave={submit}
    >
      <NamePicker
        label={t.org.managerLabel}
        value={manager}
        options={existingManagers}
        onChange={setManager}
        emptyHint={null}
      />

      <MultiSelectList
        label={t.org.repsLabel}
        options={reps}
        selected={selected}
        onChange={setSelected}
        emptyHint={t.org.noReps}
        noteFor={(rep) => {
          const from = managerForRep(links, rep);
          return from && from !== manager.trim() ? from : null;
        }}
      />

      {moving.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-amber">
          {moving.map((m) => (
            <div key={m.rep}>{t.org.reassignWarning(m.rep, m.from)}</div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
