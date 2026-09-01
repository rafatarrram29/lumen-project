"use client";

import { useMemo, useState } from "react";
import { guessTargetMapping, type Dataset, type RawSheet, type TargetColumnMapping } from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

type FieldKey = keyof TargetColumnMapping;
const OPTIONAL_FIELDS: FieldKey[] = ["area", "rep", "item"];

function fieldLabel(key: FieldKey, t: Translations): string {
  return {
    area: t.wizard.fieldArea,
    rep: t.wizard.fieldRep,
    item: t.wizard.fieldItem,
    month: t.wizard.fieldMonth,
    value: t.targets.fieldTargetValue,
  }[key];
}

export function UploadTargetsModal({
  fileName,
  sheet,
  dataset,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  dataset: Dataset;
  onCancel: () => void;
  onConfirm: (mapping: TargetColumnMapping) => void;
}) {
  const { t } = useLanguage();

  const savedMapping = dataset.targetColumnMapping;
  const savedMappingMatches =
    savedMapping &&
    [savedMapping.area, savedMapping.rep, savedMapping.item, savedMapping.month, savedMapping.value]
      .filter((v): v is string => v !== null)
      .every((v) => sheet.headers.includes(v));

  const guess = useMemo(() => guessTargetMapping(sheet.headers), [sheet.headers]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | null>>(() =>
    savedMappingMatches && savedMapping
      ? savedMapping
      : {
          area: guess.area ?? null,
          rep: guess.rep ?? null,
          item: guess.item ?? null,
          month: guess.month ?? null,
          value: guess.value ?? null,
        },
  );

  const hasDimension = Boolean(mapping.area || mapping.rep || mapping.item);
  const complete = Boolean(mapping.month && mapping.value && hasDimension);

  function handleConfirm() {
    if (!complete) return;
    onConfirm({
      area: mapping.area,
      rep: mapping.rep,
      item: mapping.item,
      month: mapping.month!,
      value: mapping.value!,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 truncate text-base font-semibold text-white">{t.targets.modalTitle(fileName)}</h2>
        <p className="mb-3 text-xs text-muted">{t.targets.subtitle}</p>
        <p className="mb-4 break-words rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
          {t.targets.replaceWarning}
        </p>

        <div className="space-y-2">
          {(["area", "rep", "item", "month", "value"] as FieldKey[]).map((key) => (
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
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {t.common.continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
