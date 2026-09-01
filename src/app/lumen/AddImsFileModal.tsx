"use client";

import { useMemo, useState } from "react";
import { guessImsMapping, guessOwnCompany, applyImsMapping, type ImsColumnMapping } from "@/lib/lumen/imsMapping";
import type { RawSheet } from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export type ImsFileSave = {
  displayName: string;
  mapping: ImsColumnMapping;
  ownCompany: string | null;
};

export function AddImsFileModal({
  fileName,
  sheet,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  onCancel: () => void;
  onConfirm: (save: ImsFileSave) => void;
}) {
  const { t } = useLanguage();

  const guess = useMemo(() => guessImsMapping(sheet.headers), [sheet.headers]);

  const [displayName, setDisplayName] = useState(fileName.replace(/\.[^./]+$/, ""));
  const [mapping, setMapping] = useState<Record<keyof ImsColumnMapping, string | null>>({
    area: guess.area ?? null,
    product: guess.product ?? null,
    marketShare: guess.marketShare ?? null,
    month: guess.month ?? null,
    company: guess.company ?? null,
  });

  // Every distinct company value found once the company column is picked,
  // plus a best-effort guess at which one is "us" — recomputed live as the
  // user changes which column that is, always shown for explicit
  // confirmation rather than applied silently.
  const { companyOptions, companyGuess } = useMemo(() => {
    if (!mapping.company) return { companyOptions: [] as string[], companyGuess: null as string | null };
    try {
      const { rows } = applyImsMapping(sheet, {
        area: mapping.area ?? sheet.headers[0],
        product: mapping.product ?? sheet.headers[0],
        marketShare: mapping.marketShare ?? sheet.headers[0],
        month: mapping.month ?? sheet.headers[0],
        company: mapping.company,
      });
      const options = Array.from(new Set(rows.map((r) => r.company).filter((c): c is string => c !== null))).sort();
      return { companyOptions: options, companyGuess: guessOwnCompany(rows) };
    } catch {
      return { companyOptions: [] as string[], companyGuess: null as string | null };
    }
  }, [mapping.company, mapping.area, mapping.product, mapping.marketShare, mapping.month, sheet]);

  const [ownCompany, setOwnCompany] = useState<string | null>(null);
  const effectiveOwnCompany = ownCompany ?? companyGuess;

  const complete = Boolean(mapping.area && mapping.product && mapping.marketShare && mapping.month && displayName.trim());

  function handleConfirm() {
    if (!complete) return;
    onConfirm({
      displayName: displayName.trim(),
      mapping: {
        area: mapping.area!,
        product: mapping.product!,
        marketShare: mapping.marketShare!,
        month: mapping.month!,
        company: mapping.company,
      },
      ownCompany: mapping.company ? effectiveOwnCompany : null,
    });
  }

  const fieldLabels: Record<keyof ImsColumnMapping, string> = {
    area: t.ims.fieldArea,
    product: t.ims.fieldProduct,
    marketShare: t.ims.fieldMarketShare,
    month: t.ims.fieldMonth,
    company: t.ims.fieldCompany,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-1 truncate text-base font-semibold text-white">{t.ims.modalTitle(fileName)}</h2>

        <div className="space-y-3">
          <label className="block text-xs text-muted">
            {t.linkedFiles.displayNameLabel}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
            />
          </label>

          <div className="space-y-2">
            {(["area", "product", "marketShare", "month", "company"] as (keyof ImsColumnMapping)[]).map((key) => (
              <label key={key} className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="w-32 shrink-0">
                  {fieldLabels[key]}
                  {key !== "company" ? " *" : ""}
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
          {mapping.company && <p className="text-xs text-muted">{t.ims.fieldCompanyHint}</p>}

          {mapping.company && (
            <label className="block text-xs text-muted">
              {t.ims.ownCompanyLabel}
              <select
                value={effectiveOwnCompany ?? ""}
                onChange={(e) => setOwnCompany(e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm text-white outline-none focus:border-amber"
              >
                <option value="">{t.wizard.selectColumn}</option>
                {companyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted">{t.ims.ownCompanyHint}</span>
            </label>
          )}
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
            className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {t.common.continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
