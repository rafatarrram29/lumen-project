"use client";

// Uploading a sales file, and uploading a targets file.
//
// The last part of LumenClient's upload work to move out — linked files and
// IMS files already have theirs (useLinkedFileUploads, useImsFileUploads),
// and this is the same shape: its own pending-file state, its own
// endpoints, and a status bar it drives through the shared UploadStatus.
//
// It is the longest of the three because a sales upload is the one that can
// destroy data. Replacing a month deletes every area's rows for it, so the
// flow asks twice before doing that, rolls back a batch run that fails
// partway, and re-counts the rows afterwards to check that what is in the
// dataset is what was just inserted. Those guards are the reason this file
// exists rather than being folded into a generic uploader.

import { useState } from "react";
import {
  applyColumnMapping,
  applyTargetMapping,
  type ColumnMapping,
  type Dataset,
  type RawSheet,
  type TargetColumnMapping,
} from "@/lib/lumen/columnMapping";
import { dedupeExactDuplicates } from "@/lib/lumen/duplicateCheck";
import type { Translations } from "@/lib/i18n/translations";
import type { WizardChoice } from "./UploadWizardModal";
import type { TargetScope } from "./UploadTargetsModal";
import { formatNumber } from "./dashboardBits";
import { errorText, intoBatches, issueLine, type UploadStatus } from "./uploadShared";

type PendingFile = { file: File; sheet: RawSheet };
/** A pending targets file, plus the card the upload was started from. */
type PendingTargets = PendingFile & { scope: TargetScope | null };

export function useSalesUploads({
  datasetId,
  year,
  datasets,
  setDatasets,
  t,
  status,
  fetchReport,
  onDatasetSwitched,
  onTargetsChanged,
}: {
  datasetId: string | null;
  year: number;
  datasets: Dataset[];
  setDatasets: (update: (prev: Dataset[]) => Dataset[]) => void;
  t: Translations;
  status: UploadStatus;
  fetchReport: (datasetId: string, year: number) => Promise<unknown>;
  /** Called when an upload lands in a dataset other than the one on screen. */
  onDatasetSwitched: (datasetId: string) => void;
  /** Called once targets have changed, so the per-card panels refetch. */
  onTargetsChanged: () => void;
}) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingTargets, setPendingTargets] = useState<PendingTargets | null>(null);

  /** Read the workbooks the user picked; anything unreadable is named. */
  async function handleFilesSelected(files: File[]) {
    status.setError(null);
    status.setMessage(null);
    const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
    const read: PendingFile[] = [];
    const failed: string[] = [];
    for (const file of files) {
      try {
        read.push({ file, sheet: await readWorkbookSheet(file) });
      } catch (err) {
        failed.push(`${file.name}: ${errorText(err, "Could not read that file.")}`);
      }
    }
    if (read.length > 0) setPendingFiles(read);
    status.setError(issueLine(failed));
  }

  /**
   * `scope` is set when the upload was started from inside a rep's or an
   * area's card. It travels with the file all the way to the insert, so a
   * plan with no Rep column still lands on the right rep — and so the
   * replace that precedes it clears only that rep's rows.
   */
  async function handleTargetsFileSelected(file: File, scope: TargetScope | null = null) {
    status.setError(null);
    status.setMessage(null);
    try {
      const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
      setPendingTargets({ file, sheet: await readWorkbookSheet(file), scope });
    } catch (err) {
      status.setError(errorText(err, "Could not read that file."));
    }
  }

  async function handleTargetsConfirm(mapping: TargetColumnMapping) {
    const pending = pendingTargets;
    setPendingTargets(null);
    if (!pending || !datasetId) return;

    status.setUploading(true);
    status.setError(null);
    status.setMessage(null);

    try {
      const { rows, skipped } = applyTargetMapping(pending.sheet, mapping);
      const scope = pending.scope;

      const current = datasets.find((d) => d.id === datasetId)?.targetColumnMapping;
      const mappingUnchanged =
        current !== null &&
        current !== undefined &&
        (["area", "rep", "item", "month", "value", "achPct"] as const).every(
          (k) => (current[k] ?? null) === (mapping[k] ?? null),
        );

      if (!mappingUnchanged) {
        const patchRes = await fetch(`/api/lumen/datasets/${datasetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetColumnMapping: mapping }),
        });
        if (patchRes.ok) {
          setDatasets((prev) => prev.map((d) => (d.id === datasetId ? { ...d, targetColumnMapping: mapping } : d)));
        }
      }

      // Targets are replaced rather than merged: a second upload is a
      // correction of the first, not an addition to it. Scoped, it clears
      // only the rep or area whose card this came from — the rest of the
      // district's plan is somebody else's and stays put.
      const replaceRes = await fetch("/api/lumen/targets/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId, scopeRep: scope?.rep ?? null, scopeArea: scope?.area ?? null }),
      });
      const replaceJson = await replaceRes.json();
      if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not clear existing targets");

      const batches = intoBatches(rows);
      let inserted = 0;
      for (let i = 0; i < batches.length; i++) {
        status.setProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
        const res = await fetch("/api/lumen/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            datasetId,
            rows: batches[i],
            scopeRep: scope?.rep ?? null,
            scopeArea: scope?.area ?? null,
            sourceFile: pending.file.name,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Targets upload failed");
        inserted += json.inserted;
      }

      status.setMessage(t.targets.uploadSuccess(inserted));
      status.setError(
        issueLine(
          skipped.count > 0
            ? `Skipped ${skipped.count} row(s) that couldn't be read (${skipped.examples.join("; ") || "missing month/value"}) — check the source file for those rows.`
            : null,
        ),
      );
      await fetchReport(datasetId, year);
      onTargetsChanged();
    } catch (err) {
      status.setError(errorText(err, "Targets upload failed"));
    } finally {
      status.setUploading(false);
      status.setProgress(null);
    }
  }

  /**
   * One sales file into one dataset.
   *
   * Returns false when the user backed out of a destructive replace, so
   * the caller can tell "declined" apart from "uploaded".
   */
  async function uploadRowsToDataset(
    targetDatasetId: string,
    mapping: ColumnMapping,
    sheet: RawSheet,
    fileName: string,
    fileLabel: string,
  ): Promise<{ inserted: number; warning?: string } | false> {
    const { rows: parsedRows, skipped } = applyColumnMapping(sheet, mapping);
    // An exact repeat of a row within this same file (every TRACKED column
    // identical, including the value) can only be safely auto-removed when
    // the mapping includes a real per-row identifier (Customer ID, invoice
    // number, ...): without one, two DIFFERENT customers who happen to
    // order the same quantity at the same price look byte-identical to
    // everything this app tracks, and are NOT duplicates — auto-deleting
    // on that weaker key was measured to silently remove 68-75% of two
    // real multi-customer sales files' rows. With a uniqueId mapped, the
    // key can tell the two cases apart and it's safe to drop and continue;
    // without one, this falls back to the original behavior further down
    // (the server rejects the batch and asks the uploader to look at it).
    // Either way this is scoped to THIS one file/upload attempt only — a
    // new upload colliding with rows already committed from an earlier
    // upload is a different case, still handled by the overlap/replace
    // prompt below and the database's own uniqueness constraint.
    const { kept: rows, removed: duplicatesRemoved } = mapping.uniqueId
      ? dedupeExactDuplicates(
          parsedRows,
          (r) => `${r.month}|${r.area}|${r.item}|${r.rep ?? ""}|${r.salesValue}|${r.salesQty ?? ""}|${r.uniqueId ?? ""}`,
          (r) => `${r.area} / ${r.item} / month ${r.month}`,
        )
      : { kept: parsedRows, removed: { count: 0, examples: [] as string[] } };
    const monthsInFile = [...new Set(rows.map((r) => r.month))].sort((a, b) => a - b);
    const areasInFile = [...new Set(rows.map((r) => r.area))];

    const overlapRes = await fetch("/api/lumen/check-overlap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, datasetId: targetDatasetId, months: monthsInFile, areas: areasInFile }),
    });
    const overlapJson = await overlapRes.json();
    if (!overlapRes.ok) throw new Error(overlapJson.error || "Could not check for existing months");

    const overlappingMonths: number[] = overlapJson.overlappingMonths ?? [];
    if (overlappingMonths.length > 0) {
      const existingSourceFiles: string[] = overlapJson.existingSourceFiles ?? [];
      const existingFilesNote =
        existingSourceFiles.length > 0 ? ` The data currently there came from: ${existingSourceFiles.join(", ")}.` : "";
      const proceed = window.confirm(
        `${fileLabel} — month(s) ${overlappingMonths.join(", ")} already have data in this dataset for ${year}.${existingFilesNote} ` +
          `Continuing will delete the existing rows for those months and replace them with ` +
          `this file. This cannot be undone. Continue?`,
      );
      if (!proceed) return false;

      // Replacing a month deletes EVERY area's rows for it, not just the
      // ones this file has. An area that currently has data for these
      // months but isn't in this file at all would lose that data
      // permanently with nothing to replace it — a second, more explicit
      // confirmation makes that impossible to blow through by accident
      // (this is the exact shape of mistake that produced a real
      // production data-loss incident: a smaller/test file silently
      // wiping out other areas' real numbers for the same month).
      const areasAtRisk: { area: string; rowCount: number; totalValue: number }[] = overlapJson.areasAtRisk ?? [];
      if (areasAtRisk.length > 0) {
        const list = areasAtRisk
          .map((a) => `${a.area} (${formatNumber(a.totalValue)} across ${a.rowCount} row(s))`)
          .join(", ");
        const proceedAnyway = window.confirm(
          `⚠️ WARNING — ${fileLabel} does NOT include these area(s), which currently have data for month(s) ` +
            `${overlappingMonths.join(", ")}: ${list}. ` +
            `Continuing will PERMANENTLY DELETE their data for these months, with nothing from this file to replace it. ` +
            `Only continue if you really mean to remove those areas' data for these months.`,
        );
        if (!proceedAnyway) return false;
      }

      const replaceRes = await fetch("/api/lumen/replace-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId: targetDatasetId, months: overlappingMonths }),
      });
      const replaceJson = await replaceRes.json();
      if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not clear the old months");
    }

    const batches = intoBatches(rows);
    let inserted = 0;
    try {
      for (let i = 0; i < batches.length; i++) {
        status.setProgress(`${fileLabel}: batch ${i + 1} of ${batches.length}…`);
        const res = await fetch("/api/lumen/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            datasetId: targetDatasetId,
            sourceFile: fileName,
            rows: batches[i],
            // Tells the server which duplicate-check mode is safe to run:
            // with a real per-row identifier mapped, each row already
            // carries its own uniqueId (part of ParsedSalesRow), so the
            // server can dedupe-and-continue using the SAME strong key
            // this file was already deduped with above; without one, it
            // falls back to the original reject-and-ask behavior, since
            // there's no way to tell a real duplicate apart from two
            // different customers who coincidentally share every tracked
            // column.
            hasUniqueId: Boolean(mapping.uniqueId),
            // Reported once (on the first batch only) — the whole file's
            // duplicates were already found and dropped above, before
            // batching, so there is exactly one summary for this upload.
            ...(i === 0 && duplicatesRemoved.count > 0 ? { duplicatesRemoved } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }
    } catch (err) {
      // A batch failed partway through — rather than leave this file's
      // months half-written (some areas present, others missing, with no
      // visible sign anything went wrong), roll back everything this
      // attempt touched so the month is either fully there or not there
      // at all, never a silent partial mix.
      await fetch("/api/lumen/replace-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, datasetId: targetDatasetId, months: monthsInFile }),
      }).catch(() => {});
      throw new Error(
        `${errorText(err, "Upload failed")} — the partial data from this attempt was rolled back. Please try again.`,
      );
    }

    const warnings: string[] = [];
    if (skipped.count > 0) {
      warnings.push(
        `${fileLabel}: skipped ${skipped.count} row(s) that couldn't be read (${skipped.examples.join("; ") || "missing area/item/value/month"}) — check the source file for those rows.`,
      );
    }
    if (duplicatesRemoved.count > 0) {
      warnings.push(
        `${fileLabel}: removed ${duplicatesRemoved.count} row(s) repeated identically within this file ` +
          `(e.g. ${duplicatesRemoved.examples.join("; ") || "a repeated row"}) — kept one copy of each, logged in the Correction log.`,
      );
    }
    // Final sanity check: does the dataset actually now hold as many rows
    // for these months as we just inserted? This should always match — the
    // within-file dedup above and the database's own uniqueness constraint
    // both prevent a mismatch — but this is the one place we can catch
    // anything neither of those anticipated before the user walks away
    // trusting a silently wrong number.
    try {
      const countRes = await fetch(
        `/api/lumen/sales-records/count?year=${year}&datasetId=${targetDatasetId}&months=${monthsInFile.join(",")}`,
      );
      const countJson = await countRes.json();
      if (countRes.ok && typeof countJson.count === "number" && countJson.count !== inserted) {
        warnings.push(
          `${fileLabel}: expected ${inserted} rows for this upload, but the dataset now has ${countJson.count} for these months — please check the Correction log and this area's numbers before relying on them.`,
        );
      }
    } catch {
      // best-effort only; not being able to verify isn't itself an error
    }

    return { inserted, warning: issueLine(warnings) ?? undefined };
  }

  async function handleWizardConfirm(choice: WizardChoice) {
    const files = pendingFiles;
    setPendingFiles([]);
    if (files.length === 0) return;

    status.setUploading(true);
    status.setError(null);
    status.setMessage(null);

    try {
      let targetDatasetId: string;
      let mapping: ColumnMapping;

      if (choice.mode === "new") {
        const res = await fetch("/api/lumen/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: choice.name, columnMapping: choice.mapping }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create the dataset");
        targetDatasetId = json.dataset.id;
        mapping = json.dataset.columnMapping;
        setDatasets((prev) => [json.dataset, ...prev]);
      } else {
        targetDatasetId = choice.datasetId;
        const existing = datasets.find((d) => d.id === targetDatasetId);
        if (!existing) throw new Error("Dataset not found");
        mapping = existing.columnMapping;
      }

      let successCount = 0;
      let totalInserted = 0;
      const failures: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const { file, sheet } = files[i];
        const fileLabel = files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name;
        try {
          const result = await uploadRowsToDataset(targetDatasetId, mapping, sheet, file.name, fileLabel);
          if (result !== false) {
            successCount++;
            totalInserted += result.inserted;
            if (result.warning) warnings.push(result.warning);
          }
        } catch (err) {
          failures.push(`${file.name}: ${errorText(err, "Upload failed")}`);
        }
      }

      if (successCount > 0) {
        status.setMessage(
          files.length > 1
            ? `Uploaded ${successCount} of ${files.length} files (${formatNumber(totalInserted)} rows).`
            : `Uploaded and processed ${files[0].file.name} (${formatNumber(totalInserted)} rows).`,
        );
        onDatasetSwitched(targetDatasetId);
        await fetchReport(targetDatasetId, year);
      }
      // Both at once, in one write: a file that failed and a file that went
      // in with a suspect row count are two different things to act on, and
      // reporting them one after the other left only the last one showing.
      status.setError(issueLine(warnings, failures));
    } catch (err) {
      status.setError(errorText(err, "Upload failed"));
    } finally {
      status.setUploading(false);
      status.setProgress(null);
    }
  }

  /** Returns whether the new mapping was saved, so the modal can close. */
  async function handleSaveSalesMapping(mapping: ColumnMapping): Promise<boolean> {
    if (!datasetId) return false;
    try {
      const res = await fetch(`/api/lumen/datasets/${datasetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMapping: mapping }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update the mapping");
      setDatasets((prev) => prev.map((d) => (d.id === datasetId ? { ...d, columnMapping: mapping } : d)));
      return true;
    } catch (err) {
      status.setError(errorText(err, "Could not update the mapping"));
      return false;
    }
  }

  return {
    pendingFiles,
    pendingTargets,
    cancelPendingFiles: () => setPendingFiles([]),
    cancelPendingTargets: () => setPendingTargets(null),
    handleFilesSelected,
    handleTargetsFileSelected,
    handleTargetsConfirm,
    handleWizardConfirm,
    handleSaveSalesMapping,
  };
}
