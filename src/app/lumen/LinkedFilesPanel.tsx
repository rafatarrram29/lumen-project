"use client";

import { useRef, useState } from "react";
import type { JoinKey, LinkedFile } from "@/lib/lumen/linkedFiles";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

const ALL_JOIN_KEYS: JoinKey[] = ["area", "rep", "line", "month"];

function typeLabel(type: LinkedFile["fileType"], t: Translations): string {
  return { achievement: t.linkedFiles.typeAchievement, kpis: t.linkedFiles.typeKpis, other: t.linkedFiles.typeOther }[type];
}

function joinKeyLabel(key: JoinKey, t: Translations): string {
  return {
    area: t.linkedFiles.joinKeyArea,
    rep: t.linkedFiles.joinKeyRep,
    line: t.linkedFiles.joinKeyLine,
    month: t.linkedFiles.joinKeyMonth,
  }[key];
}

function JoinKeysEditor({
  file,
  onSave,
  onCancel,
  t,
}: {
  file: LinkedFile;
  onSave: (keys: JoinKey[]) => void;
  onCancel: () => void;
  t: Translations;
}) {
  const [keys, setKeys] = useState<Set<JoinKey>>(new Set(file.joinKeys));

  function mappingHasKey(key: JoinKey) {
    return key === "month" ? Boolean(file.columnMapping.month) : Boolean(file.columnMapping[key]);
  }

  function toggle(key: JoinKey) {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const active = ALL_JOIN_KEYS.filter((k) => keys.has(k) && mappingHasKey(k));
  const valid = active.includes("month") && active.length > 0;

  return (
    <div className="mt-1.5 rounded-lg bg-surf2/60 p-2.5">
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {ALL_JOIN_KEYS.map((key) => {
          const available = mappingHasKey(key);
          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              onClick={() => toggle(key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-30 ${
                keys.has(key) && available ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
              }`}
            >
              {joinKeyLabel(key, t)}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-[11px] text-muted hover:text-white">
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(active)}
          className="text-[11px] font-semibold text-amber disabled:opacity-40"
        >
          {t.editMapping.save}
        </button>
      </div>
    </div>
  );
}

export function LinkedFilesPanel({
  files,
  disabled,
  onAddFile,
  onReplaceFile,
  onDeleteFile,
  onEditJoinKeys,
}: {
  files: LinkedFile[];
  disabled: boolean;
  onAddFile: (file: File) => void;
  onReplaceFile: (fileId: string, file: File) => void;
  onDeleteFile: (file: LinkedFile) => void;
  onEditJoinKeys: (fileId: string, joinKeys: JoinKey[]) => void;
}) {
  const { t } = useLanguage();
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);

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
            <div key={f.id}>
              <div className="flex items-center gap-1.5 rounded-lg border border-bdr px-2.5 py-1.5 text-xs">
                <span className="shrink-0 rounded-full border border-bdr px-1.5 py-0.5 text-[10px] text-muted">
                  {typeLabel(f.fileType, t)}
                </span>
                <span className="min-w-0 flex-1 truncate text-white" dir="auto" title={f.displayName}>
                  {f.displayName}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setEditingFileId((id) => (id === f.id ? null : f.id))}
                  title={t.editMapping.editLinkButton}
                  aria-label={t.editMapping.editLinkButton}
                  className="shrink-0 text-muted hover:text-amber disabled:opacity-50"
                >
                  ⚙
                </button>
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
              {editingFileId === f.id && (
                <JoinKeysEditor
                  file={f}
                  t={t}
                  onCancel={() => setEditingFileId(null)}
                  onSave={(keys) => {
                    onEditJoinKeys(f.id, keys);
                    setEditingFileId(null);
                  }}
                />
              )}
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
