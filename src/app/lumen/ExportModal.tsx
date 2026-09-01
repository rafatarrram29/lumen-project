"use client";

import { useState } from "react";
import type { ExportItemGroups } from "@/lib/lumen/exportItems";
import { allItemIds } from "@/lib/lumen/exportItems";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export type ExportFormat = "pdf" | "pptx";

export function ExportModal({
  groups,
  exporting,
  onCancel,
  onExport,
}: {
  groups: ExportItemGroups;
  exporting: boolean;
  onCancel: () => void;
  onExport: (format: ExportFormat, selectedIds: Set<string>) => void;
}) {
  const { t } = useLanguage();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allItemIds(groups)));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allItemIds(groups)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-4 text-base font-semibold text-white">{t.export.modalTitle}</h2>

        <div className="mb-4">
          <p className="mb-2 text-xs text-muted">{t.export.formatLabel}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                format === "pdf" ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
              }`}
            >
              {t.export.formatPdf}
            </button>
            <button
              type="button"
              onClick={() => setFormat("pptx")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                format === "pptx" ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
              }`}
            >
              {t.export.formatPptx}
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-end gap-2">
          <button type="button" onClick={selectAll} className="text-xs font-medium text-amber">
            {t.export.selectAll}
          </button>
          <span className="text-xs text-muted">/</span>
          <button type="button" onClick={deselectAll} className="text-xs font-medium text-amber">
            {t.export.deselectAll}
          </button>
        </div>

        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-xs font-semibold text-white">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4 shrink-0 accent-amber"
                    />
                    <span className="min-w-0 truncate" dir="auto">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected.size === 0 && (
          <p className="mt-4 break-words rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
            {t.export.noItemsSelected}
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
            onClick={() => onExport(format, selected)}
            disabled={selected.size === 0 || exporting}
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {exporting ? t.export.exporting : t.export.exportButton}
          </button>
        </div>
      </div>
    </div>
  );
}
