"use client";

import { useMemo, useState } from "react";
import {
  applyTargetMapping,
  guessTargetMapping,
  type Dataset,
  type RawSheet,
  type TargetColumnMapping,
} from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

type FieldKey = keyof TargetColumnMapping;
const FIELD_ORDER: FieldKey[] = ["area", "rep", "item", "month", "value", "achPct"];
const OPTIONAL_FIELDS: FieldKey[] = ["area", "rep", "item", "achPct"];

/**
 * Where the upload was started from. Set when the dialog is opened inside
 * a rep's or an area's card: the file then does not need a Rep or Area
 * column at all, because the card already says whose plan this is.
 */
export type TargetScope = { rep?: string | null; area?: string | null };

export function scopeLabel(scope: TargetScope): string {
  return [scope.rep, scope.area].filter(Boolean).join(" · ");
}

function fieldLabel(key: FieldKey, t: Translations): string {
  return {
    area: t.wizard.fieldArea,
    rep: t.wizard.fieldRep,
    item: t.wizard.fieldItem,
    month: t.wizard.fieldMonth,
    value: t.targets.fieldTargetValue,
    achPct: t.targets.fieldAchPct,
  }[key];
}

export function UploadTargetsModal({
  fileName,
  sheet,
  dataset,
  scope,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  dataset: Dataset;
  /** Null for the sidebar upload, which covers the whole dataset. */
  scope?: TargetScope | null;
  onCancel: () => void;
  onConfirm: (mapping: TargetColumnMapping) => void;
}) {
  const { t } = useLanguage();

  // The mapping this dataset's last targets upload was confirmed with. It
  // is reused only when every column it names is actually in this file —
  // otherwise it describes a different file's shape and would map the
  // wrong columns silently.
  const savedMapping = dataset.targetColumnMapping;
  const savedMappingMatches = Boolean(
    savedMapping &&
      [savedMapping.area, savedMapping.rep, savedMapping.item, savedMapping.month, savedMapping.value, savedMapping.achPct]
        .filter((v): v is string => typeof v === "string" && v !== "")
        .every((v) => sheet.headers.includes(v)),
  );

  const guess = useMemo(() => guessTargetMapping(sheet.headers), [sheet.headers]);

  // Remembered first, guessed for anything it does not cover. A mapping
  // saved before the Ach% column existed leaves that field null; falling
  // back to the guess fills it in rather than making the user find it
  // again, and the same holds for any field added later.
  const initial: Record<FieldKey, string | null> = FIELD_ORDER.reduce(
    (acc, key) => {
      const remembered = savedMappingMatches ? (savedMapping?.[key] ?? null) : null;
      acc[key] = remembered ?? guess[key] ?? null;
      return acc;
    },
    {} as Record<FieldKey, string | null>,
  );
  const [mapping, setMapping] = useState<Record<FieldKey, string | null>>(initial);

  // How the fields on screen got their values, so the dialog can say so
  // rather than leaving the user to wonder whether it read the file.
  const filledCount = FIELD_ORDER.filter((k) => initial[k]).length;
  // Names in the file that disagree with the card the upload was started
  // from. Filled in on Continue, and shown as a confirmation rather than
  // an error: the file may well be right and the card the wrong place to
  // have started from.
  const [conflict, setConflict] = useState<{ rep: string[]; area: string[] } | null>(null);

  // Started from a card, the scope supplies the dimension the file would
  // otherwise have to carry.
  const hasDimension = Boolean(mapping.area || mapping.rep || mapping.item) || Boolean(scope);
  const complete = Boolean(mapping.month && mapping.value && hasDimension);

  function resolved(): TargetColumnMapping {
    return {
      area: mapping.area,
      rep: mapping.rep,
      item: mapping.item,
      month: mapping.month!,
      value: mapping.value!,
      achPct: mapping.achPct ?? null,
    };
  }

  /**
   * Names the file gives that the card does not. Only what the file
   * actually mapped is checked — a file with no Rep column cannot
   * disagree about the rep.
   */
  function findConflict(m: TargetColumnMapping): { rep: string[]; area: string[] } | null {
    if (!scope) return null;
    let rows;
    try {
      ({ rows } = applyTargetMapping(sheet, m));
    } catch {
      return null; // an unreadable file is the upload's problem, not this check's
    }
    const other = (values: (string | null)[], expected: string | null | undefined) =>
      expected
        ? [...new Set(values.filter((v): v is string => Boolean(v) && v !== expected))].slice(0, 5)
        : [];
    const rep = m.rep ? other(rows.map((r) => r.rep), scope.rep) : [];
    const area = m.area ? other(rows.map((r) => r.area), scope.area) : [];
    return rep.length > 0 || area.length > 0 ? { rep, area } : null;
  }

  function handleConfirm() {
    if (!complete) return;
    const m = resolved();
    const found = findConflict(m);
    if (found && !conflict) {
      setConflict(found);
      return;
    }
    onConfirm(m);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 truncate text-base font-semibold text-white">{t.targets.modalTitle(fileName)}</h2>
        <p className="mb-3 text-xs text-muted">{t.targets.subtitle}</p>
        <p className="mb-4 break-words rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
          {scope ? t.targets.scopedReplaceWarning(scopeLabel(scope)) : t.targets.replaceWarning}
        </p>

        {scope && (
          <p className="mb-4 break-words rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan">
            {t.targets.scopeNote(scopeLabel(scope))}
          </p>
        )}

        {filledCount > 0 && (
          <p className="mb-4 break-words rounded-lg bg-green/10 px-3 py-2 text-xs text-green">
            {savedMappingMatches ? t.targets.mappingRemembered : t.targets.mappingGuessed(filledCount)}
          </p>
        )}

        <div className="space-y-2">
          {FIELD_ORDER.map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="w-28 shrink-0">
                {fieldLabel(key, t)}
                {!OPTIONAL_FIELDS.includes(key) ? " *" : ""}
              </span>
              <select
                value={mapping[key] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}
                className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
              >
                <option value="">{t.wizard.selectColumn}</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {!hasDimension && (
          <p className="mt-3 break-words rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
            {t.targets.atLeastOneRequired}
          </p>
        )}

        {conflict && (
          <p className="mt-3 break-words rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
            {t.targets.scopeConflict(
              scopeLabel(scope ?? {}),
              [...conflict.rep, ...conflict.area].join(", "),
            )}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!complete}
            className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {conflict ? t.targets.scopeConflictConfirm : t.common.continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
