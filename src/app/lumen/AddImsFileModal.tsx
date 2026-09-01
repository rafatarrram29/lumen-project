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
  isTableSelected,
  onToggleTable,
  manualAdded,
  onAddManual,
  onRemoveManual,
}: {
  page: ExtractedPage;
  t: Translations;
  isTableSelected: (tableIndex: number) => boolean;
  onToggleTable: (tableIndex: number) => void;
  manualAdded: boolean;
  onAddManual: (sheet: RawSheet) => void;
  onRemoveManual: () => void;
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
              <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-amber">
                <input
                  type="checkbox"
                  checked={isTableSelected(ti)}
                  onChange={() => onToggleTable(ti)}
                  className="h-3.5 w-3.5 accent-[var(--amber)]"
                />
                {t.ims.pdfUseTable}
              </label>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-muted">
            {page.status === "image" ? t.ims.pdfPageImageWarning : t.ims.pdfPageNoTableWarning}
          </p>
          {manualAdded ? (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-green">{t.ims.pdfManualAdded}</p>
              <button
                type="button"
                onClick={() => {
                  onRemoveManual();
                  setManualOpen(false);
                }}
                className="text-[11px] text-muted hover:text-white"
              >
                {t.ims.pdfRemove}
              </button>
            </div>
          ) : manualOpen ? (
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
                  if (parsed) onAddManual(parsed);
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
  initialDisplayName,
  initialFixedMonth,
  stepLabel,
  similarCount,
  onCancel,
  onBack,
  onConfirm,
}: {
  fileName: string;
  sheet: RawSheet;
  initialDisplayName?: string;
  initialFixedMonth?: string;
  stepLabel?: string;
  // Other not-yet-imported queued tables with this exact same header row —
  // almost always the same underlying report repeated (e.g. one page per
  // product in a deck), so this mapping is very likely right for them too.
  similarCount?: number;
  onCancel: () => void;
  onBack?: () => void;
  onConfirm: (save: ImsFileSave, applyToAllSimilar: boolean) => void;
}) {
  const { t } = useLanguage();

  const guess = useMemo(() => guessImsMapping(sheet.headers), [sheet.headers]);

  const [displayName, setDisplayName] = useState(initialDisplayName ?? fileName.replace(/\.[^./]+$/, ""));
  const [mapping, setMapping] = useState<Record<Exclude<keyof ImsColumnMapping, "fixedMonth" | "fixedProduct">, string | null>>({
    area: guess.area ?? null,
    product: guess.product ?? null,
    marketShare: guess.marketShare ?? null,
    month: guess.month ?? null,
    company: guess.company ?? null,
  });
  // A snapshot file often has no per-row month column at all (a
  // comparison table, a single "as of" export) — this lets the user say
  // "this whole file is month N" once instead, only ever used when no
  // Month column is mapped. A single PDF import batch is almost always
  // all the same reporting period, so each table in the queue starts
  // from whatever month the previous one was confirmed with instead of
  // making the user retype it every time.
  const [fixedMonth, setFixedMonth] = useState<string>(initialFixedMonth ?? "");
  const fixedMonthNumber = fixedMonth.trim() === "" ? null : Number(fixedMonth);
  // Same idea for Product: a competitor-comparison table (rival company
  // names down the rows, for one product the whole page is about) has no
  // per-row product column at all — only ever used when no Product column
  // is mapped. Starts from the table's own label (usually the product/
  // molecule name already) since that's normally exactly right or a short
  // edit away, rather than an empty field the user has to fill from scratch.
  const [fixedProduct, setFixedProduct] = useState<string>(initialDisplayName ?? "");

  const { companyOptions, companyGuess } = useMemo(() => {
    if (!mapping.company) return { companyOptions: [] as string[], companyGuess: null as string | null };
    try {
      const { rows } = applyImsMapping(sheet, {
        area: mapping.area,
        product: mapping.product,
        marketShare: mapping.marketShare ?? sheet.headers[0],
        month: mapping.month,
        fixedMonth: mapping.month ? null : (fixedMonthNumber ?? 1),
        fixedProduct: mapping.product ? null : (fixedProduct.trim() || null),
        company: mapping.company,
      });
      const options = Array.from(new Set(rows.map((r) => r.company).filter((c): c is string => c !== null))).sort();
      return { companyOptions: options, companyGuess: guessOwnCompany(rows) };
    } catch {
      return { companyOptions: [] as string[], companyGuess: null as string | null };
    }
  }, [mapping.company, mapping.area, mapping.product, mapping.marketShare, mapping.month, fixedMonthNumber, fixedProduct, sheet]);

  const [ownCompany, setOwnCompany] = useState<string | null>(null);
  const effectiveOwnCompany = ownCompany ?? companyGuess;

  const fixedMonthInvalid = fixedMonth.trim() !== "" && (fixedMonthNumber === null || Number.isNaN(fixedMonthNumber));
  const complete =
    isValidImsMapping({
      ...mapping,
      fixedMonth: mapping.month ? null : fixedMonthNumber,
      fixedProduct: mapping.product ? null : (fixedProduct.trim() || null),
    }) &&
    !fixedMonthInvalid &&
    displayName.trim().length > 0;

  function handleConfirm(applyToAllSimilar: boolean) {
    if (!complete) return;
    onConfirm(
      {
        displayName: displayName.trim(),
        mapping: {
          area: mapping.area,
          product: mapping.product,
          marketShare: mapping.marketShare!,
          month: mapping.month,
          fixedMonth: mapping.month ? null : fixedMonthNumber,
          fixedProduct: mapping.product ? null : (fixedProduct.trim() || null),
          company: mapping.company,
        },
        ownCompany: mapping.company ? effectiveOwnCompany : null,
        sheet,
      },
      applyToAllSimilar,
    );
  }

  const fieldLabels: Record<Exclude<keyof ImsColumnMapping, "fixedMonth" | "fixedProduct">, string> = {
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
        {stepLabel && <div className="mb-1 text-[11px] font-semibold text-amber">{stepLabel}</div>}
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
            {(["area", "product", "marketShare", "month", "company"] as const).map((key) => (
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
          {!mapping.product && (
            <label className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="w-32 shrink-0">{t.ims.fixedProductLabel}</span>
              <input
                value={fixedProduct}
                onChange={(e) => setFixedProduct(e.target.value)}
                placeholder={t.ims.fixedProductPlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
              />
            </label>
          )}
          {!mapping.product && <p className="text-[11px] text-muted">{t.ims.fixedProductHint}</p>}
          {!mapping.month && (
            <label className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="w-32 shrink-0">{t.ims.fixedMonthLabel}</span>
              <input
                type="number"
                min={1}
                value={fixedMonth}
                onChange={(e) => setFixedMonth(e.target.value)}
                placeholder={t.ims.fixedMonthPlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm text-white outline-none focus:border-amber"
              />
            </label>
          )}
          {!mapping.month && <p className="text-[11px] text-muted">{t.ims.fixedMonthHint}</p>}
          {!(mapping.area || mapping.product || fixedProduct.trim()) && (
            <p className="text-[11px] text-amber">{t.ims.atLeastOneOfAreaProduct}</p>
          )}
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

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
          >
            {t.common.cancel}
          </button>
          {!!similarCount && (
            <button
              type="button"
              onClick={() => handleConfirm(true)}
              disabled={!complete}
              className="rounded-lg border border-amber px-4 py-2 text-sm font-semibold text-amber hover:bg-amber/10 disabled:opacity-50"
            >
              {t.ims.pdfApplyToAllSimilar(similarCount)}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleConfirm(false)}
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

type QueueItem = { id: string; sheet: RawSheet; label: string };

// IMS-only upload entry point. Excel/CSV/ODS files were already read into
// a RawSheet by the caller before this opens (sheet is non-null) and go
// straight to the mapping step below. A PDF (sheet is null) is extracted
// here instead, page by page — see pdfTableExtract.ts for why every page
// is treated independently rather than assuming one layout for the whole
// file. A real deck routinely has several usable tables across its pages
// (product comparisons, monthly trends, per-brand breakdowns), so the user
// checks off any number of them — or "select all" — and each checked table
// is mapped and imported one after another (its own mapping step, since
// different tables rarely share the same columns) rather than forcing a
// full re-upload per table.
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
  onConfirm: (save: ImsFileSave) => void | Promise<void>;
}) {
  const { t } = useLanguage();
  const isPdf = sheet === null;

  const [pdfPages, setPdfPages] = useState<ExtractedPage[] | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(isPdf);

  // Keyed by "<pageNumber>:<tableIndex>" for an extracted table, or
  // "<pageNumber>:manual" for a manually-typed page.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manualSheets, setManualSheets] = useState<Record<string, RawSheet>>({});
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [processed, setProcessed] = useState<Set<number>>(new Set());
  const [lastFixedMonth, setLastFixedMonth] = useState<string>("");

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

  const allTableIds = useMemo(
    () => (pdfPages ?? []).flatMap((p) => (p.status === "ok" ? p.tables.map((_, ti) => `${p.pageNumber}:${ti}`) : [])),
    [pdfPages],
  );
  const allSelected = allTableIds.length > 0 && allTableIds.every((id) => selectedIds.has(id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of allTableIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...allTableIds]);
    });
  }

  function toggleTable(pageNumber: number, tableIndex: number) {
    const id = `${pageNumber}:${tableIndex}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addManual(pageNumber: number, s: RawSheet) {
    const id = `${pageNumber}:manual`;
    setManualSheets((prev) => ({ ...prev, [id]: s }));
    setSelectedIds((prev) => new Set(prev).add(id));
  }

  function removeManual(pageNumber: number) {
    const id = `${pageNumber}:manual`;
    setManualSheets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleContinue() {
    if (!pdfPages) return;
    const items: QueueItem[] = [];
    for (const page of pdfPages) {
      if (page.status === "ok") {
        page.tables.forEach((table, ti) => {
          const id = `${page.pageNumber}:${ti}`;
          if (selectedIds.has(id)) items.push({ id, sheet: tableToRawSheet(table), label: page.title });
        });
      }
      const manualId = `${page.pageNumber}:manual`;
      const manualSheet = manualSheets[manualId];
      if (selectedIds.has(manualId) && manualSheet) items.push({ id: manualId, sheet: manualSheet, label: page.title });
    }
    if (items.length === 0) return;
    setQueue(items);
    setQueueIndex(0);
    setProcessed(new Set());
  }

  function headersEqual(a: string[], b: string[]) {
    return a.length === b.length && a.every((h, i) => h === b[i]);
  }

  // Awaited (not fire-and-forget) so two uploads from the same batch never
  // run concurrently — each one creates its own IMS file server-side, and
  // the shared "uploading" indicator only makes sense one at a time.
  // applyToAllSimilar imports this same mapping into every other queued,
  // not-yet-imported table with an identical header row too (a deck with
  // one page per product, all built from the same template, routinely has
  // several) — sparing a full mapping screen per one of those.
  async function handleQueueConfirm(save: ImsFileSave, applyToAllSimilar: boolean) {
    if (!queue) return;
    if (save.mapping.fixedMonth != null) setLastFixedMonth(String(save.mapping.fixedMonth));

    const currentHeaders = queue[queueIndex].sheet.headers;
    const similarIndices = applyToAllSimilar
      ? queue
          .map((_, i) => i)
          .filter((i) => i !== queueIndex && !processed.has(i) && headersEqual(queue[i].sheet.headers, currentHeaders))
      : [];

    await onConfirm(save);
    for (const i of similarIndices) {
      await onConfirm({ ...save, displayName: queue[i].label, sheet: queue[i].sheet });
    }

    const nowProcessed = new Set(processed);
    nowProcessed.add(queueIndex);
    for (const i of similarIndices) nowProcessed.add(i);
    setProcessed(nowProcessed);

    let next = queueIndex + 1;
    while (next < queue.length && nowProcessed.has(next)) next++;
    if (next < queue.length) {
      setQueueIndex(next);
    } else {
      onCancel();
    }
  }

  if (!isPdf) {
    // Plain spreadsheet upload — a single known sheet, no page-picking or
    // batching needed. Matches the original single-shot timing: fire the
    // import and close right away, success/failure reported afterwards via
    // the shared upload banner.
    return (
      <MappingStep
        fileName={fileName}
        sheet={sheet}
        onCancel={onCancel}
        onConfirm={(save) => {
          onConfirm(save);
          onCancel();
        }}
      />
    );
  }

  if (queue) {
    const current = queue[queueIndex];
    const similarCount = queue.filter(
      (item, i) => i !== queueIndex && !processed.has(i) && headersEqual(item.sheet.headers, current.sheet.headers),
    ).length;
    return (
      <MappingStep
        key={current.id}
        fileName={fileName}
        sheet={current.sheet}
        initialDisplayName={current.label}
        initialFixedMonth={lastFixedMonth}
        stepLabel={queue.length > 1 ? t.ims.pdfMappingStepOf(queueIndex + 1, queue.length) : undefined}
        similarCount={similarCount}
        onCancel={onCancel}
        onBack={queueIndex === 0 ? () => setQueue(null) : undefined}
        onConfirm={handleQueueConfirm}
      />
    );
  }

  const noTablesAtAll = pdfPages !== null && pdfPages.every((p) => p.tables.length === 0);
  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bdr bg-surf p-5">
        <h2 className="mb-3 truncate text-base font-semibold text-white">{t.ims.modalTitle(fileName)}</h2>

        {pdfLoading && <p className="text-sm text-muted">{t.ims.pdfExtracting}</p>}
        {pdfError && <p className="text-sm text-red">{t.ims.pdfExtractFailed(pdfError)}</p>}
        {noTablesAtAll && <p className="mb-3 text-xs text-amber">{t.ims.pdfNoTablesAtAll}</p>}

        {allTableIds.length > 1 && (
          <label className="mb-3 flex w-fit cursor-pointer items-center gap-1.5 text-xs font-semibold text-white">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 accent-[var(--amber)]"
            />
            {t.ims.pdfSelectAll}
          </label>
        )}

        {pdfPages?.map((page) => (
          <PdfPageCard
            key={page.pageNumber}
            page={page}
            t={t}
            isTableSelected={(ti) => selectedIds.has(`${page.pageNumber}:${ti}`)}
            onToggleTable={(ti) => toggleTable(page.pageNumber, ti)}
            manualAdded={selectedIds.has(`${page.pageNumber}:manual`)}
            onAddManual={(s) => addManual(page.pageNumber, s)}
            onRemoveManual={() => removeManual(page.pageNumber)}
          />
        ))}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
          >
            {t.common.cancel}
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent"
            >
              {t.ims.pdfContinueWithSelected(selectedCount)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
