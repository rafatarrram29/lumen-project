"use client";

import { useRef } from "react";
import type { LinkedFile } from "@/lib/lumen/linkedFiles";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

function typeLabel(type: LinkedFile["fileType"], t: Translations): string {
  return { achievement: t.linkedFiles.typeAchievement, kpis: t.linkedFiles.typeKpis, other: t.linkedFiles.typeOther }[type];
}

export function LinkedFilesPanel({
  files,
  disabled,
  onAddFile,
  onReplaceFile,
  onDeleteFile,
}: {
  files: LinkedFile[];
  disabled: boolean;
  onAddFile: (file: File) => void;
  onReplaceFile: (fileId: string, file: File) => void;
  onDeleteFile: (file: LinkedFile) => void;
}) {
  const { t } = useLanguage();
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);

  return (
    <div className="mt-4 border-t border-bdr pt-4">
      <input
        ref={addInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAddFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replaceTargetId.current) onReplaceFile(replaceTargetId.current, file);
          e.target.value = "";
        }}
      />

      <div className="mb-2 text-xs font-semibold text-muted">{t.linkedFiles.panelTitle}</div>

      {files.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 rounded-lg border border-bdr px-2.5 py-1.5 text-xs">
              <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                {typeLabel(f.fileType, t)}
              </span>
              <span className="min-w-0 flex-1 truncate text-white" dir="auto" title={f.displayName}>
                {f.displayName}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  replaceTargetId.current = f.id;
                  replaceInputRef.current?.click();
                }}
                title={t.linkedFiles.replaceButton}
                aria-label={t.linkedFiles.replaceButton}
                className="shrink-0 text-muted hover:text-amber disabled:opacity-50"
              >
                ↻
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDeleteFile(f)}
                title={t.linkedFiles.deleteButton}
                aria-label={t.linkedFiles.deleteButton}
                className="shrink-0 text-muted hover:text-red disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => addInputRef.current?.click()}
        disabled={disabled}
        className="w-full rounded-lg border border-dashed border-bdr px-3 py-2 text-xs text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
      >
        {t.linkedFiles.addButton}
      </button>
    </div>
  );
}
