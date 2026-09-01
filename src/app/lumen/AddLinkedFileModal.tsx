"use client";

import { useMemo, useState } from "react";
import {
  guessFileType,
  guessLinkedMapping,
  suggestedJoinKeys,
  type JoinKey,
  type LinkedFile,
  type LinkedFileMapping,
  type LinkedFileType,
} from "@/lib/lumen/linkedFiles";
import type { RawSheet, ColumnMapping } from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

const ALL_JOIN_KEYS: JoinKey[] = ["area", "rep", "cluster", "month"];

function typeLabel(type: LinkedFileType, t: Translations): string {
  return { achievement: t.linkedFiles.typeAchievement, kpis: t.linkedFiles.typeKpis, other: t.linkedFiles.typeOther }[type];
}

function joinKeyLabel(key: JoinKey, t: Translations): string {
  return {
    area: t.linkedFiles.joinKeyArea,
    rep: t.linkedFiles.joinKeyRep,
    cluster: t.linkedFiles.joinKeyCluster,
    month: t.linkedFiles.joinKeyMonth,
  }[key];
}

export type LinkedFileSave = {
  fileType: LinkedFileType;
  displayName: string;
  mapping: LinkedFileMapping;
  joinKeys: JoinKey[];
};

export function AddLinkedFileModal({
  fileName,
  sheet,
  salesMapping,
  existingFile,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  salesMapping: ColumnMapping;
  existingFile?: LinkedFile;
  onCancel: () => void;
  onConfirm: (save: LinkedFileSave) => void;
}) {
  const { t } = useLanguage();

  const guess = useMemo(() => guessLinkedMapping(sheet.headers), [sheet.headers]);
  const headersMatchExisting =
    existingFile &&
    [existingFile.columnMapping.area, existingFile.columnMapping.rep, existingFile.columnMapping.cluster, existingFile.columnMapping.month]
      .filter((v): v is string => v !== null)
      .every((v) => sheet.headers.includes(v));

  const [fileType, setFileType] = useState<LinkedFileType>(existingFile?.fileType ?? guessFileType(sheet.headers));
  const [displayName, setDisplayName] = useState(
    existingFile?.displayName ?? fileName.replace(/\.[^./]+$/, ""),
  );
  const [mapping, setMapping] = useState<Record<keyof LinkedFileMapping, string | null>>(() =>
    headersMatchExisting && existingFile
      ? existingFile.columnMapping
      : {
          area: guess.area ?? null,
          rep: guess.rep ?? null,
          cluster: guess.cluster ?? null,
          month: guess.month ?? null,
        },
  );
  const [joinKeys, setJoinKeys] = useState<Set<JoinKey>>(
    () => new Set(existingFile?.joinKeys ?? suggestedJoinKeys(guess, { rep: salesMapping.rep, cluster: salesMapping.cluster })),
  );

  function toggleJoinKey(key: JoinKey) {
    setJoinKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const mappingHasKey = (key: JoinKey) => (key === "month" ? Boolean(mapping.month) : Boolean(mapping[key]));
  const activeJoinKeys = ALL_JOIN_KEYS.filter((k) => joinKeys.has(k) && mappingHasKey(k));
  const complete = Boolean(mapping.month && displayName.trim() && activeJoinKeys.length > 0 && activeJoinKeys.includes("month"));

  function handleConfirm() {
    if (!complete || !mapping.month) return;
    onConfirm({
      fileType,
      displayName: displayName.trim(),
      mapping: { area: mapping.area, rep: mapping.rep, cluster: mapping.cluster, month: mapping.month },
      joinKeys: activeJoinKeys,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 truncate text-base font-semibold text-white">
          {existingFile ? t.linkedFiles.replaceModalTitle(fileName) : t.linkedFiles.modalTitle(fileName)}
        </h2>
        <p className="mb-4 text-xs text-muted">{t.linkedFiles.joinKeysHint}</p>

        <div className="space-y-3">
          <label className="block text-xs text-muted">
            {t.linkedFiles.fileTypeLabel}
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as LinkedFileType)}
              className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
            >
              <option value="achievement">{typeLabel("achievement", t)}</option>
              <option value="kpis">{typeLabel("kpis", t)}</option>
              <option value="other">{typeLabel("other", t)}</option>
            </select>
          </label>

          <label className="block text-xs text-muted">
            {t.linkedFiles.displayNameLabel}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
            />
          </label>

          <div>
            <p className="mb-2 text-xs text-muted">{t.linkedFiles.mappingHelp}</p>
            <div className="space-y-2">
              {(["area", "rep", "cluster", "month"] as (keyof LinkedFileMapping)[]).map((key) => (
                <label key={key} className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="w-24 shrink-0">
                    {joinKeyLabel(key as JoinKey, t)}
                    {key === "month" ? " *" : ""}
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
          </div>

          <div>
            <p className="mb-2 text-xs text-muted">{t.linkedFiles.joinKeysLabel}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_JOIN_KEYS.map((key) => {
                const available = mappingHasKey(key);
                const checked = joinKeys.has(key) && available;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!available}
                    onClick={() => toggleJoinKey(key)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-30 ${
                      checked ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted"
                    }`}
                  >
                    {joinKeyLabel(key, t)}
                  </button>
                );
              })}
            </div>
            {!activeJoinKeys.includes("month") && (
              <p className="mt-2 break-words rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
                {t.linkedFiles.atLeastOneJoinKey}
              </p>
            )}
          </div>
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
