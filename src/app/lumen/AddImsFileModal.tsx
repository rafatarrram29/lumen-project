"use client";

import { useEffect, useMemo, useState } from "react";
import {
  guessImsMapping,
  guessOwnCompany,
  applyImsMapping,
  isValidImsMapping,
  tableToRawSheet,
  type ImsColumnMapping,
} from "@/lib/lumen/imsMapping";
import type { RawSheet } from "@/lib/lumen/columnMapping";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Translations } from "@/lib/i18n/translations";

export type ImsFileSave = {
  displayName: string;
  mapping: ImsColumnMapping;
  ownCompany: string | null;
  // The exact sheet this mapping was built against — for a PDF upload the
  // caller never got to read a sheet itself (the modal extracted or
  // manually-entered one internally), so it has to come back here instead
  // of being re-derived from the original File.
  sheet: RawSheet;
};

type ExtractedTable = { headers: string[]; rows: string[][] };
type ExtractedPage = {
  pageNumber: number;
  title: string;
  status: "ok" | "no_table" | "image";
  tables: ExtractedTable[];
};

function parseManualEntry(text: string): RawSheet | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim() || "Column");
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const record: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (i < cells.length) record[h] = cells[i].trim();
    });
    return record;
  });
  return { headers, rows };
}

function TablePreview({ table }: { table: ExtractedTable }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-bdr">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-bdr text-muted">
            {table.headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2 py-1 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 5).map((row, ri) => (
            <tr key={ri} className="border-b border-bdr/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="whitespace-nowrap px-2 py-1 text-white">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 5 && (
        <div className="px-2 py-1 text-[10px] text-muted">+{table.rows.length - 5} more</div>
      )}
    </div>
  );
}

function PdfPageCard({
  page,
  t,
  onUseTable,
  onUseManual,
}: {
  page: ExtractedPage;
  t: Translations;
  onUseTable: (table: ExtractedTable) => void;
  onUseManual: (sheet: RawSheet) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  return (
    <div className="mb-3 rounded-lg border border-bdr p-3">
      <div className="mb-2 truncate text-xs font-semibold text-white" dir="auto" title={page.title}>
        {t.ims.pdfPageLabel(page.pageNumber)} — {page.title}
      </div>

      {page.status === "ok" ? (
        <>
          <div className="mb-2 text-[11px] text-muted">{t.ims.pdfTablesFound(page.tables.length)}</div>
          {page.tables.map((table, ti) => (
            <div key={ti} className="mb-2">
              <TablePreview table={table} />
              <button
                type="button"
                onClick={() => onUseTable(table)}
                className="mt-1.5 rounded-lg border border-amber px-3 py-1 text-[11px] font-semibold text-amber hover:bg-amber/10"
              >
                {t.ims.pdfUseTable}
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-muted">
            {page.status === "image" ? t.ims.pdfPageImageWarning : t.ims.pdfPageNoTableWarning}
          </p>
          {manualOpen ? (
            <div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={t.ims.pdfManualPlaceholder}
                rows={4}
                className="w-full rounded-lg border border-bdr bg-surf2 px-2 py-1.5 font-mono text-[11px] text-white outline-none focus:border-amber"
                dir="auto"
              />
              <p className="mt-1 text-[10px] text-muted">{t.ims.pdfManualHint}</p>
              <button
                type="button"
                onClick={() => {
                  const parsed = parseManualEntry(manualText);
                  if (parsed) onUseManual(parsed);
                }}
                disabled={!manualText.trim()}
                className="mt-1.5 rounded-lg border border-amber px-3 py-1 text-[11px] font-semibold text-amber hover:bg-amber/10 disabled:opacity-40"
              >
                {t.ims.pdfUseManual}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSkipped(true)}
                className="rounded-lg border border-bdr px-3 py-1 text-[11px] text-muted hover:text-white"
              >
                {t.ims.pdfSkip}
              </button>
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="rounded-lg border border-bdr px-3 py-1 text-[11px] text-muted hover:text-white"
              >
                {t.ims.pdfEnterManually}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MappingStep({
  fileName,
  sheet,
  onCancel,
  onBack,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  onCancel: () => void;
  onBack?: () => void;
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

  const { companyOptions, companyGuess } = useMemo(() => {
    if (!mapping.company) return { companyOptions: [] as string[], companyGuess: null as string | null };
    try {
      const { rows } = applyImsMapping(sheet, {
        area: mapping.area,
        product: mapping.product,
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

  const complete = isValidImsMapping(mapping) && displayName.trim().length > 0;

  function handleConfirm() {
    if (!complete) return;
    onConfirm({
      displayName: displayName.trim(),
      mapping: {
        area: mapping.area,
        product: mapping.product,
        marketShare: mapping.marketShare!,
        month: mapping.month!,
        company: mapping.company,
      },
      ownCompany: mapping.company ? effectiveOwnCompany : null,
      sheet,
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
        {onBack && (
          <button type="button" onClick={onBack} className="mb-2 text-[11px] text-muted hover:text-white">
            {t.ims.pdfBackToPages}
          </button>
        )}
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
                  {key === "marketShare" || key === "month" ? " *" : ""}
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
          {!(mapping.area || mapping.product) && <p className="text-[11px] text-amber">{t.ims.atLeastOneOfAreaProduct}</p>}
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

// IMS-only upload entry point. Excel/CSV/ODS files were already read into
// a RawSheet by the caller before this opens (sheet is non-null) and go
// straight to the mapping step below. A PDF (sheet is null) is extracted
// here instead, page by page — see pdfTableExtract.ts for why every page
// is treated independently rather than assuming one layout for the whole
// file — and the user picks which single extracted table (or manually
// entered page) to import; that choice then flows into the exact same
// mapping step a spreadsheet uses.
export function AddImsFileModal({
  fileName,
  file,
  sheet,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  file: File;
  sheet: RawSheet | null;
  onCancel: () => void;
  onConfirm: (save: ImsFileSave) => void;
}) {
  const { t } = useLanguage();
  const isPdf = sheet === null;

  const [pdfPages, setPdfPages] = useState<ExtractedPage[] | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(isPdf);
  const [selectedSheet, setSelectedSheet] = useState<RawSheet | null>(sheet);

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/lumen/ims-pdf-extract", { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Extraction failed");
        if (!cancelled) setPdfPages(json.pages);
      } catch (err) {
        if (!cancelled) setPdfError(err instanceof Error ? err.message : "Extraction failed");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPdf]);

  if (selectedSheet) {
    return (
      <MappingStep
        fileName={fileName}
        sheet={selectedSheet}
        onCancel={onCancel}
        onBack={isPdf ? () => setSelectedSheet(null) : undefined}
        onConfirm={onConfirm}
      />
    );
  }

  const noTablesAtAll = pdfPages !== null && pdfPages.every((p) => p.tables.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-3 truncate text-base font-semibold text-white">{t.ims.modalTitle(fileName)}</h2>

        {pdfLoading && <p className="text-sm text-muted">{t.ims.pdfExtracting}</p>}
        {pdfError && <p className="text-sm text-red">{t.ims.pdfExtractFailed(pdfError)}</p>}
        {noTablesAtAll && <p className="mb-3 text-xs text-amber">{t.ims.pdfNoTablesAtAll}</p>}

        {pdfPages?.map((page) => (
          <PdfPageCard
            key={page.pageNumber}
            page={page}
            t={t}
            onUseTable={(table) => setSelectedSheet(tableToRawSheet(table))}
            onUseManual={(s) => setSelectedSheet(s)}
          />
        ))}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
          >
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
