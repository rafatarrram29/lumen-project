"use client";

// Adding, replacing, deleting and re-linking a linked file.
//
// Lifted out of LumenClient with the rest of the read layer already gone
// (see useLumenData.ts). Linked files are a self-contained feature: their
// own pending-upload state, their own endpoints, and nothing else in the
// dashboard reads any of it. Keeping them here means the component no
// longer has to be read to answer a question about them.

import { useState } from "react";
import { applyLinkedMapping, type JoinKey, type LinkedFile } from "@/lib/lumen/linkedFiles";
import { dedupeExactDuplicates } from "@/lib/lumen/duplicateCheck";
import type { RawSheet } from "@/lib/lumen/columnMapping";
import type { Translations } from "@/lib/i18n/translations";
import type { LinkedFileSave } from "./AddLinkedFileModal";
import { UPLOAD_BATCH_SIZE, type UploadStatus } from "./uploadShared";

export function useLinkedFileUploads({
  datasetId,
  year,
  t,
  status,
  fetchLinkedFiles,
  fetchLinkedRecords,
  fetchDataEdits,
}: {
  datasetId: string | null;
  year: number;
  t: Translations;
  status: UploadStatus;
  fetchLinkedFiles: (datasetId: string) => Promise<unknown>;
  fetchLinkedRecords: (datasetId: string, year: number) => Promise<unknown>;
  fetchDataEdits: (datasetId: string) => Promise<unknown>;
}) {
  const [pendingLinkedFile, setPendingLinkedFile] = useState<{ file: File; sheet: RawSheet } | null>(null);
  const [replacingLinkedFileId, setReplacingLinkedFileId] = useState<string | null>(null);

  async function handleAddLinkedFile(file: File) {
    status.setError(null);
    status.setMessage(null);
    setReplacingLinkedFileId(null);
    try {
      const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
      const sheet = await readWorkbookSheet(file);
      setPendingLinkedFile({ file, sheet });
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleReplaceLinkedFile(fileId: string, file: File) {
    status.setError(null);
    status.setMessage(null);
    setReplacingLinkedFileId(fileId);
    try {
      const { readWorkbookSheet } = await import("@/lib/lumen/readWorkbookSheet");
      const sheet = await readWorkbookSheet(file);
      setPendingLinkedFile({ file, sheet });
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  async function handleLinkedFileConfirm(save: LinkedFileSave) {
    const pending = pendingLinkedFile;
    const replaceId = replacingLinkedFileId;
    setPendingLinkedFile(null);
    setReplacingLinkedFileId(null);
    if (!pending || !datasetId) return;

    status.setUploading(true);
    status.setError(null);
    status.setMessage(null);

    try {
      const parsedRows = applyLinkedMapping(pending.sheet, save.mapping);
      const { kept: rows, removed: duplicatesRemoved } = dedupeExactDuplicates(
        parsedRows,
        (r) => `${r.month}|${r.area ?? ""}|${r.rep ?? ""}|${r.line ?? ""}|${JSON.stringify(r.data)}`,
        (r) => `${r.area ?? "—"} / month ${r.month}`,
      );

      let fileId: string;
      if (replaceId) {
        const replaceRes = await fetch(`/api/lumen/dataset-files/${replaceId}/replace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: save.displayName, columnMapping: save.mapping, joinKeys: save.joinKeys }),
        });
        const replaceJson = await replaceRes.json();
        if (!replaceRes.ok) throw new Error(replaceJson.error || "Could not replace the file");
        fileId = replaceId;
      } else {
        const createRes = await fetch("/api/lumen/dataset-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetId: datasetId,
            fileType: save.fileType,
            displayName: save.displayName,
            sourceFile: pending.file.name,
            columnMapping: save.mapping,
            joinKeys: save.joinKeys,
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson.error || "Could not create the linked file");
        fileId = createJson.file.id;
      }

      const batches = [];
      for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
        batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
      }

      let inserted = 0;
      for (let i = 0; i < batches.length; i++) {
        status.setProgress(`Uploading batch ${i + 1} of ${batches.length}…`);
        const res = await fetch(`/api/lumen/dataset-files/${fileId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasetId: datasetId,
            year,
            rows: batches[i],
            ...(i === 0 && duplicatesRemoved.count > 0 ? { duplicatesRemoved } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        inserted += json.inserted;
      }

      status.setMessage(
        duplicatesRemoved.count > 0
          ? `${t.linkedFiles.uploadSuccess(inserted)} Removed ${duplicatesRemoved.count} duplicate row(s) repeated within this file — logged in the Correction log.`
          : t.linkedFiles.uploadSuccess(inserted),
      );
      await fetchLinkedFiles(datasetId);
      await fetchLinkedRecords(datasetId, year);
      await fetchDataEdits(datasetId);
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      status.setUploading(false);
      status.setProgress(null);
    }
  }

  async function handleDeleteLinkedFile(file: LinkedFile) {
    const proceed = window.confirm(t.linkedFiles.deleteConfirm(file.displayName));
    if (!proceed || !datasetId) return;

    try {
      const res = await fetch(`/api/lumen/dataset-files/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete the file");
      await fetchLinkedFiles(datasetId);
      await fetchLinkedRecords(datasetId, year);
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not delete the file");
    }
  }

  async function handleEditJoinKeys(fileId: string, joinKeys: JoinKey[]) {
    if (!datasetId) return;
    try {
      const res = await fetch(`/api/lumen/dataset-files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinKeys }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update the link");
      await fetchLinkedFiles(datasetId);
    } catch (err) {
      status.setError(err instanceof Error ? err.message : "Could not update the link");
    }
  }

  return {
    pendingLinkedFile,
    setPendingLinkedFile,
    replacingLinkedFileId,
    setReplacingLinkedFileId,
    handleAddLinkedFile,
    handleReplaceLinkedFile,
    handleLinkedFileConfirm,
    handleDeleteLinkedFile,
    handleEditJoinKeys,
  };
}
