"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { IssueType } from "@/lib/lumen/corrections";

export function FlagIssueModal({
  targetLabel,
  onCancel,
  onSubmit,
}: {
  targetLabel: string;
  onCancel: () => void;
  onSubmit: (issueType: IssueType, comment: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [issueType, setIssueType] = useState<IssueType>("wrong_number");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!comment.trim()) return;
    setSubmitting(true);
    await onSubmit(issueType, comment.trim());
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 text-base font-semibold text-white">{t.corrections.modalTitle}</h2>
        <p className="mb-4 truncate text-xs text-muted" dir="auto" title={targetLabel}>
          {targetLabel}
        </p>

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs text-muted">{t.corrections.issueTypeLabel}</p>
            <div className="flex flex-wrap gap-2">
              {(["wrong_number", "wrong_link", "bad_decision", "other"] as IssueType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIssueType(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    issueType === type ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
                  }`}
                >
                  {
                    {
                      wrong_number: t.corrections.typeWrongNumber,
                      wrong_link: t.corrections.typeWrongLink,
                      bad_decision: t.corrections.typeBadDecision,
                      other: t.corrections.typeOther,
                    }[type]
                  }
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs text-muted">
            {t.corrections.commentLabel}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.corrections.commentPlaceholder}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
            />
          </label>
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
            onClick={handleSubmit}
            disabled={!comment.trim() || submitting}
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {t.corrections.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
