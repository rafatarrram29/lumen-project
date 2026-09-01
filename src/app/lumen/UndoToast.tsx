"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Appears right after any inline edit (sales cell or linked-file field) and
// auto-dismisses itself a few seconds later (see UNDO_WINDOW_MS in
// LumenClient) or as soon as the user switches dataset/year/re-analyzes.
// Ctrl+Z / Cmd+Z on desktop triggers the same onUndo while this is showing.
export function UndoToast({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-bdr bg-surf px-4 py-2.5 shadow-lg">
        <span className="text-xs text-white">{t.inlineEdit.undoToastMessage}</span>
        <button
          type="button"
          onClick={onUndo}
          className="text-xs font-semibold text-amber hover:underline"
        >
          {t.inlineEdit.undoButton}
        </button>
        <button type="button" onClick={onDismiss} className="text-muted hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}
