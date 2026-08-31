"use client";

import { useMemo, useState } from "react";
import { guessMapping, type ColumnMapping, type Dataset, type RawSheet } from "@/lib/lumen/columnMapping";

type MappingField = { key: keyof ColumnMapping; label: string; required: boolean };

const MAPPING_FIELDS: MappingField[] = [
  { key: "area", label: "Area / Region", required: true },
  { key: "item", label: "Item / Product", required: true },
  { key: "value", label: "Value", required: true },
  { key: "qty", label: "Quantity", required: false },
  { key: "month", label: "Month", required: true },
  { key: "rep", label: "Rep", required: false },
  { key: "cluster", label: "Cluster", required: false },
];

export function missingMappingColumns(mapping: ColumnMapping, headers: string[]): string[] {
  const headerSet = new Set(headers);
  const missing: string[] = [];
  for (const field of MAPPING_FIELDS) {
    const value = mapping[field.key];
    if (value && !headerSet.has(value)) missing.push(field.label);
  }
  return missing;
}

export type WizardChoice =
  | { mode: "new"; name: string; mapping: ColumnMapping }
  | { mode: "existing"; datasetId: string };

export function UploadWizardModal({
  fileName,
  sheet,
  datasets,
  defaultDatasetId,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  datasets: Dataset[];
  defaultDatasetId: string | null;
  onCancel: () => void;
  onConfirm: (choice: WizardChoice) => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">(defaultDatasetId ? "existing" : "new");
  const [name, setName] = useState(() => fileName.replace(/\.[^./]+$/, ""));
  const [existingDatasetId, setExistingDatasetId] = useState<string | null>(
    defaultDatasetId ?? datasets[0]?.id ?? null,
  );

  const guess = useMemo(() => guessMapping(sheet.headers), [sheet.headers]);
  const [mapping, setMapping] = useState<Record<keyof ColumnMapping, string | null>>({
    area: guess.area ?? null,
    item: guess.item ?? null,
    value: guess.value ?? null,
    qty: guess.qty ?? null,
    month: guess.month ?? null,
    rep: guess.rep ?? null,
    cluster: guess.cluster ?? null,
  });

  const existingDataset = datasets.find((d) => d.id === existingDatasetId) ?? null;
  const existingMissing = existingDataset
    ? missingMappingColumns(existingDataset.columnMapping, sheet.headers)
    : [];

  const newMappingComplete = Boolean(mapping.area && mapping.item && mapping.value && mapping.month);

  function handleConfirm() {
    if (mode === "new") {
      if (!name.trim() || !newMappingComplete) return;
      onConfirm({
        mode: "new",
        name: name.trim(),
        mapping: {
          area: mapping.area!,
          item: mapping.item!,
          value: mapping.value!,
          qty: mapping.qty,
          month: mapping.month!,
          rep: mapping.rep,
          cluster: mapping.cluster,
        },
      });
    } else {
      if (!existingDatasetId || existingMissing.length > 0) return;
      onConfirm({ mode: "existing", datasetId: existingDatasetId });
    }
  }

  const confirmDisabled =
    mode === "new" ? !name.trim() || !newMappingComplete : !existingDatasetId || existingMissing.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 truncate text-base font-semibold text-white">Upload {fileName}</h2>
        <p className="mb-4 text-xs text-muted">Choose where this file&apos;s data goes.</p>

        {datasets.length > 0 && (
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                mode === "existing" ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
              }`}
            >
              Add to existing dataset
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                mode === "new" ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
              }`}
            >
              Create new dataset
            </button>
          </div>
        )}

        {mode === "existing" ? (
          <div className="space-y-3">
            <label className="block text-xs text-muted">
              Dataset
              <select
                value={existingDatasetId ?? ""}
                onChange={(e) => setExistingDatasetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {existingMissing.length > 0 && (
              <p className="break-words rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
                This file doesn&apos;t match &quot;{existingDataset?.name}&quot;&apos;s saved column
                mapping — missing: {existingMissing.join(", ")}. Pick a different dataset, or create a
                new one instead.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-muted">
              Dataset name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
              />
            </label>

            <div>
              <p className="mb-2 text-xs text-muted">
                Match each column from your file to what it means. Required fields are marked *.
              </p>
              <div className="space-y-2">
                {MAPPING_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center justify-between gap-2 text-xs text-muted"
                  >
                    <span className="w-28 shrink-0">
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [field.key]: e.target.value || null }))
                      }
                      className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
                    >
                      <option value="">{field.required ? "Select a column…" : "(none)"}</option>
                      {sheet.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
