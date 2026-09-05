"use client";

// The pieces both assignment dialogs are built from.
//
// Written once because the two dialogs are the same shape — pick a name
// (existing or new), then tick a list — and two hand-written copies of a
// multi-select is how they end up behaving differently for no reason.

import type { ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ModalShell({
  title,
  error,
  saving,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-bdr bg-surf p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
        <div className="space-y-4">{children}</div>
        {error && <p className="mt-3 text-sm text-red">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted transition-colors hover:text-white disabled:opacity-50"
          >
            {t.org.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {saving ? t.org.saving : t.org.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Pick an existing name or type a new one.
 *
 * Both at once rather than a mode switch: adding the second rep to a team
 * is the same action as adding the first, and making the user first declare
 * which kind of action it is only slows that down.
 */
export function NamePicker({
  label,
  value,
  options,
  onChange,
  emptyHint,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyHint: string | null;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.org.newNamePlaceholder}
        className="w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
        dir="auto"
      />
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                value === name ? "border-amber bg-amber/10 text-amber" : "border-bdr text-muted hover:text-white"
              }`}
              dir="auto"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {options.length === 0 && emptyHint && <p className="mt-2 text-xs text-muted">{emptyHint}</p>}
    </div>
  );
}

/** Tick as many as you like, with select-all/clear for a long list. */
export function MultiSelectList({
  label,
  options,
  selected,
  onChange,
  emptyHint,
  noteFor,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  emptyHint: string;
  /** Optional note beside an option — used to show a rep's current manager. */
  noteFor?: (option: string) => string | null;
}) {
  const { t } = useLanguage();

  function toggle(option: string) {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(next);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted">{label}</label>
        {options.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">{t.org.selectedCount(selected.size)}</span>
            <button type="button" onClick={() => onChange(new Set(options))} className="text-amber">
              {t.org.selectAll}
            </button>
            <button type="button" onClick={() => onChange(new Set())} className="text-muted hover:text-white">
              {t.org.clearAll}
            </button>
          </div>
        )}
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg border border-bdr px-3 py-2 text-xs text-muted">{emptyHint}</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-bdr">
          {options.map((option) => {
            const note = noteFor?.(option) ?? null;
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 border-b border-bdr px-3 py-2 text-sm last:border-b-0 hover:bg-surf2/60"
              >
                <input
                  type="checkbox"
                  checked={selected.has(option)}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 shrink-0 accent-[var(--amber)]"
                />
                <span className="min-w-0 flex-1 truncate text-white" dir="auto">
                  {option}
                </span>
                {note && <span className="shrink-0 text-[11px] text-muted">{note}</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
