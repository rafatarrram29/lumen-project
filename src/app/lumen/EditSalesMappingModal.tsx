"use client";

import { useState } from "react";
import type { ColumnMapping } from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

type FieldKey = keyof ColumnMapping;
const REQUIRED_FIELDS: FieldKey[] = ["area", "item", "value", "month"];
const ALL_FIELDS: FieldKey[] = ["area", "item", "value", "qty", "month", "rep", "line"];

function fieldLabel(key: FieldKey, t: Translations): string {
  return {
    area: t.wizard.fieldArea,
    item: t.wizard.fieldItem,
    value: t.wizard.fieldValue,
    qty: t.wizard.fieldQty,
    month: t.wizard.fieldMonth,
    rep: t.wizard.fieldRep,
    line: t.wizard.fieldLine,
  }[key];
}

export function EditSalesMappingModal({
  mapping,
  onCancel,
  onSave,
}: {
  mapping: ColumnMapping;
  onCancel: () => void;
  onSave: (mapping: ColumnMapping) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    area: mapping.area,
    item: mapping.item,
    value: mapping.value,
    qty: mapping.qty ?? "",
    month: mapping.month,
    rep: mapping.rep ?? "",
    line: mapping.line ?? "",
  });
  const [saving, setSaving] = useState(false);

  const complete = REQUIRED_FIELDS.every((k) => values[k].trim() !== "");

  async function handleSave() {
    if (!complete) return;
    setSaving(true);
    await onSave({
      area: values.area.trim(),
      item: values.item.trim(),
      value: values.value.trim(),
      qty: values.qty.trim() || null,
      month: values.month.trim(),
      rep: values.rep.trim() || null,
      line: values.line.trim() || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 text-base font-semibold text-white">{t.editMapping.editSalesTitle}</h2>
        <p className="mb-4 break-words rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
          {t.editMapping.editSalesWarning}
        </p>

        <div className="space-y-2">
          {ALL_FIELDS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="w-24 shrink-0">
                {fieldLabel(key, t)}
                {REQUIRED_FIELDS.includes(key) ? " *" : ""}
              </span>
              <input
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
                dir="auto"
              />
            </label>
          ))}
        </div>

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
            onClick={handleSave}
            disabled={!complete || saving}
            className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {t.editMapping.save}
          </button>
        </div>
      </div>
    </div>
  );
}
