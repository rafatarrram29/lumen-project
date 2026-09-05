"use client";

// Adding, importing, deleting and renaming inside Market Insights files.
//
// The same lift as useLinkedFileUploads: a self-contained feature with its
// own pending-upload state and its own endpoints, which the dashboard
// component no longer has to carry.

import { useState } from "react";
import { applyImsMapping } from "@/lib/lumen/imsMapping";
import { dedupeExactDuplicates } from "@/lib/lumen/duplicateCheck";
import type { RawSheet } from "@/lib/lumen/columnMapping";
import type { Translations } from "@/lib/i18n/translations";
import type { ImsFile } from "./ImsPanel";
import type { ImsFileSave } from "./AddImsFileModal";
import { UPLOAD_BATCH_SIZE, type UploadStatus } from "./uploadShared";

export function useImsFileUploads({
  datasetId,
  year,
  t,
  status,
  loadImsData,
  fetchDataEdits,
  armUndo,
}: {
  datasetId: string | null;
  year: number;
  t: Translations;
  status: UploadStatus;
  loadImsData: (datasetId: string, year: number) => Promise<unknown>;
  fetchDataEdits: (datasetId: string) => Promise<unknown>;
  /** Renames are undoable, so the dashboard's undo window is armed here. */
  armUndo: (edit: { kind: "imsRename"; field: "area" | "product" | "company"; oldValue: string; newValue: string }) => void;
}) {
  const [pendingImsFile, setPendingImsFile] = useState<{ file: File; sheet: RawSheet | null } | null>(null);

  async function handleAddImsFile(file: File) {
    status.setError(null);
    status.setMessage(null);
    // PDF is IMS-only — the sales/linked-file paths never see this
    // branch. The PDF itself isn't parsed here; AddImsFileModal sends the
    // raw file to /api/lumen/ims-pdf-extract and works from its response.
    if (file.name.toLowerCase().endsWith(".pdf")) {
      setPendingImsFile({ file, sheet: null });
      return;
    }
    try {
      const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
      const sheet = await readWorkbookSheet(file);
      setPendingImsFile({ file, sheet });
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  // Imports a single mapped table into a new IMS file. Doesn't close the
  // upload modal itself — AddImsFileModal owns that decision, since one PDF
  // upload can queue up several selected tables to import one after
  // another, and the modal only closes once the whole queue is done.
  async function handleImsFileConfirm(save: ImsFileSave) {
    const pending = pendingImsFile;
    if (!pending || !datasetId) return;

    status.setUploading(true);
    status.setError(null);
    status.setMessage(null);

    try {
      const { rows: parsedRows, skipped } = applyImsMapping(save.sheet, save.mapping);
      const { kept: rows, removed: duplicatesRemoved } = dedupeExactDuplicates(
        parsedRows,
        (r) => `${r.month}|${r.area ?? ""}|${r.product ?? ""}|${r.company ?? ""}|${r.marketShare}`,
        (r) => `${r.area ?? "—"} / ${r.product ?? "—"} / month ${r.month}`,
      );

      const createRes = await fetch("/api/lumen/ims-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: datasetId,
          displayName: save.displayName,
          sourceFile: pending.file.name,
          columnMapping: save.mapping,
          ownCompany: save.ownCompany,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || "Could not create the IMS file");
      const fileId = createJson.file.id;

      const batches = [];
      for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
        batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
      }

      let inserted = 0;
      for (let i = 0; i < batches.length; i++) {
        status.setProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
        const res = await fetch(`/api/lumen/ims-files/${fileId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetId: datasetId,
            year,
            rows: batches[i].map((r) => ({
              area: r.area,
              product: r.product,
              company: r.company,
              marketShare: r.marketShare,
              month: r.month,
              growthRate: r.growthRate,
            })),
            ...(i === 0 && duplicatesRemoved.count > 0 ? { duplicatesRemoved } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }

      const notes: string[] = [];
      if (skipped.count > 0) notes.push(`Skipped ${skipped.count} row(s) (${skipped.examples.join("; ") || "invalid values"}).`);
      if (duplicatesRemoved.count > 0) {
        notes.push(`Removed ${duplicatesRemoved.count} duplicate row(s) repeated within this file — logged in the Correction log.`);
      }
      status.setMessage(notes.length > 0 ? `${t.ims.uploadSuccess(inserted)} ${notes.join(" ")}` : t.ims.uploadSuccess(inserted));
      await loadImsData(datasetId, year);
      await fetchDataEdits(datasetId);
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      status.setUploading(false);
      status.setProgress(null);
    }
  }

  async function handleDeleteImsFile(file: ImsFile) {
    const proceed = window.confirm(t.ims.deleteConfirm(file.displayName));
    if (!proceed || !datasetId) return;

    try {
      const res = await fetch(`/api/lumen/ims-files/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete the file");
      await loadImsData(datasetId, year);
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not delete the file");
    }
  }

  async function handleRenameImsField(
    field: "area" | "product" | "company",
    oldValue: string,
    newValue: string,
    isUndo = false,
  ) {
    if (!datasetId || oldValue === newValue) return;
    try {
      const res = await fetch("/api/lumen/ims-files/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: datasetId, field, oldValue, newValue, isUndo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.inlineEdit.saveFailed);
      await loadImsData(datasetId, year);
      await fetchDataEdits(datasetId);
      if (!isUndo) armUndo({ kind: "imsRename", field, oldValue, newValue });
    } catch (err) {
      status.setError(err instanceof Error ? err.message : t.inlineEdit.saveFailed);
    }
  }

  return {
    pendingImsFile,
    setPendingImsFile,
    handleAddImsFile,
    handleImsFileConfirm,
    handleDeleteImsFile,
    handleRenameImsField,
  };
}
