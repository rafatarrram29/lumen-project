"use client";

import type { DataEdit } from "@/lib/lumen/corrections";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function CorrectionLogModal({
  dataEdits,
  onClose,
}: {
  dataEdits: DataEdit[];
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">{t.corrections.logTitle}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-white">
            ×
          </button>
        </div>

        {dataEdits.length === 0 ? (
          <p className="text-sm text-muted">{t.inlineEdit.logEmpty}</p>
        ) : (
          <div className="space-y-2">
            {dataEdits.map((e) => (
              <div key={e.id} className="rounded-lg border border-bdr bg-surf2/60 p-3 text-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-white" dir="auto" title={e.targetLabel}>
                    {e.targetLabel}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {new Date(e.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-muted">
                  {t.inlineEdit.changedFrom(e.oldValue, e.newValue)}
                </div>
                {e.editedBy && <div className="mt-1 text-[11px] text-muted" dir="auto">{e.editedBy}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
