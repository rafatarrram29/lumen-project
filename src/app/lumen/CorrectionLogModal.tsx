"use client";

import type { Correction, IssueType } from "@/lib/lumen/corrections";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

function issueTypeLabel(type: IssueType, t: Translations): string {
  return {
    wrong_number: t.corrections.typeWrongNumber,
    wrong_link: t.corrections.typeWrongLink,
    bad_decision: t.corrections.typeBadDecision,
    other: t.corrections.typeOther,
  }[type];
}

export function CorrectionLogModal({
  corrections,
  onToggleStatus,
  onClose,
}: {
  corrections: Correction[];
  onToggleStatus: (correction: Correction) => void;
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

        {corrections.length === 0 ? (
          <p className="text-sm text-muted">{t.corrections.logEmpty}</p>
        ) : (
          <div className="space-y-3">
            {corrections.map((c) => (
              <div key={c.id} className="rounded-lg border border-bdr bg-surf2/60 p-3 text-xs">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                      {issueTypeLabel(c.issueType, t)}
                    </span>
                    <span className="text-[11px] text-muted">
                      {new Date(c.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      c.status === "open" ? "border-amber/40 bg-amber/20 text-amber" : "border-green/40 bg-green/20 text-green"
                    }`}
                  >
                    {c.status === "open" ? t.corrections.statusOpen : t.corrections.statusResolved}
                  </span>
                </div>
                {c.targetLabel && (
                  <div className="mb-1 truncate text-[11px] text-muted" dir="auto" title={c.targetLabel}>
                    {c.targetLabel}
                  </div>
                )}
                <p className="mb-2 break-words text-white" dir="auto">
                  {c.comment}
                </p>
                <button
                  type="button"
                  onClick={() => onToggleStatus(c)}
                  className="text-[11px] font-semibold text-amber"
                >
                  {c.status === "open" ? t.corrections.markResolved : t.corrections.markOpen}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
