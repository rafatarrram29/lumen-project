"use client";

// Everything the dashboard READS, in one place.
//
// LumenClient had grown to just over two thousand lines holding three
// different jobs at once: fetching, mutating, and drawing. This is the
// first of those pulled out — every read the dashboard performs, plus the
// state each read fills, so "how the data gets here" can be understood (and
// changed) without scrolling through the markup that displays it.
//
// Deliberately still a hook rather than a context: there is exactly one
// dashboard on the page, and a hook keeps the data flow visible at the one
// call site instead of hiding it behind a provider.

import { useEffect, useRef, useState } from "react";
import type { Report } from "@/lib/lumen/engine";
import type { EditedCell } from "@/lib/lumen/loadReport";
import type { RepAssignment } from "@/lib/lumen/repAssignments";
import type { LinkedFile, LinkedRecord } from "@/lib/lumen/linkedFiles";
import type { DataEdit } from "@/lib/lumen/corrections";
import type { ImsFile } from "./ImsPanel";
import type { ImsReport } from "@/lib/lumen/imsEngine";

export function editedCellMap(cells: EditedCell[]) {
  return new Map(cells.map((c) => [c.key, { editedBy: c.editedBy, editedAt: c.editedAt }]));
}

export function useLumenData({
  initialReport,
  initialEditedCells,
  initialDatasetId,
  initialYear,
  selectedDatasetId,
  year,
  activeTab,
  couldNotLoadMessage,
}: {
  initialReport: Report;
  initialEditedCells: EditedCell[];
  initialDatasetId: string | null;
  initialYear: number;
  /** The dataset and year currently on screen — what ensureImsLoaded acts on. */
  selectedDatasetId: string | null;
  year: number;
  activeTab: "sales" | "ims";
  couldNotLoadMessage: string;
}) {
  const [report, setReport] = useState<Report | null>(initialReport);
  const [loadingReport, setLoadingReport] = useState(false);
  const [assignments, setAssignments] = useState<RepAssignment[]>([]);
  const [linkedFiles, setLinkedFiles] = useState<LinkedFile[]>([]);
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [dataEdits, setDataEdits] = useState<DataEdit[]>([]);
  // Seeded from the server render rather than starting empty: the marks on
  // manually corrected figures used to appear only after the first refetch,
  // which made them look intermittent.
  const [editedCells, setEditedCells] = useState(() => editedCellMap(initialEditedCells));
  const [imsFiles, setImsFiles] = useState<ImsFile[]>([]);
  const [imsReport, setImsReport] = useState<ImsReport | null>(null);
  const [imsLoading, setImsLoading] = useState(false);
  // Which (dataset, year) the Market Insights data currently in state
  // belongs to; null means "not loaded, or no longer valid". A ref rather
  // than state because nothing renders from it — it only decides whether
  // opening the tab needs to fetch.
  const imsLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialDatasetId) {
      fetchAssignments(initialDatasetId, initialYear);
      loadLinkedData(initialDatasetId, initialYear);
      fetchDataEdits(initialDatasetId);
    }
    // Only on mount — subsequent dataset/year changes go through fetchReport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function fetchAssignments(datasetId: string, y: number) {
    try {
      const res = await fetch(`/api/lumen/rep-assignments?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setAssignments(res.ok ? (json.assignments ?? []) : []);
    } catch {
      setAssignments([]);
    }
  }

  async function fetchLinkedFiles(datasetId: string): Promise<LinkedFile[]> {
    try {
      const res = await fetch(`/api/lumen/dataset-files?datasetId=${datasetId}`);
      const json = await res.json();
      const files: LinkedFile[] = res.ok ? (json.files ?? []) : [];
      setLinkedFiles(files);
      return files;
    } catch {
      setLinkedFiles([]);
      return [];
    }
  }

  /**
   * Linked-file records are worth fetching only if there are linked files.
   * /api/lumen/dataset-records pages through the whole lumen_dataset_records
   * table for the dataset — and for a dataset with no linked files (most of
   * them) every one of those rows was guaranteed to come back empty. Asking
   * for the file list first costs one small query and skips a potentially
   * large one.
   */
  async function loadLinkedData(datasetId: string, y: number) {
    const files = await fetchLinkedFiles(datasetId);
    if (files.length === 0) {
      setLinkedRecords([]);
      return;
    }
    await fetchLinkedRecords(datasetId, y);
  }

  async function fetchLinkedRecords(datasetId: string, y: number) {
    try {
      const res = await fetch(`/api/lumen/dataset-records?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setLinkedRecords(res.ok ? (json.records ?? []) : []);
    } catch {
      setLinkedRecords([]);
    }
  }

  async function fetchImsFiles(datasetId: string) {
    try {
      const res = await fetch(`/api/lumen/ims-files?datasetId=${datasetId}`);
      const json = await res.json();
      setImsFiles(res.ok ? (json.files ?? []) : []);
    } catch {
      setImsFiles([]);
    }
  }

  async function fetchImsReport(datasetId: string, y: number) {
    setImsLoading(true);
    try {
      const res = await fetch(`/api/lumen/ims-analyze?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setImsReport(res.ok ? json : null);
    } catch {
      setImsReport(null);
    } finally {
      setImsLoading(false);
    }
  }

  /** Loads everything the Market Insights tab needs, for one dataset/year. */
  async function loadImsData(datasetId: string, y: number) {
    // Claim the key before awaiting, so a second click while the first
    // request is still in flight doesn't fire an identical one.
    imsLoadedKeyRef.current = `${datasetId}:${y}`;
    await Promise.all([fetchImsFiles(datasetId), fetchImsReport(datasetId, y)]);
  }

  /** Fetches the Market Insights data if what's in state isn't current. */
  function ensureImsLoaded() {
    if (!selectedDatasetId) return;
    if (imsLoadedKeyRef.current === `${selectedDatasetId}:${year}`) return;
    loadImsData(selectedDatasetId, year);
  }

  async function fetchDataEdits(datasetId: string) {
    try {
      const res = await fetch(`/api/lumen/data-edits?datasetId=${datasetId}`);
      const json = await res.json();
      setDataEdits(res.ok ? (json.edits ?? []) : []);
    } catch {
      setDataEdits([]);
    }
  }

  async function fetchReport(datasetId: string, y: number) {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/lumen/analyze?year=${y}&datasetId=${datasetId}`);
      const json = await res.json();
      setReport(json);
      setEditedCells(editedCellMap(json.editedCells ?? []));
    } catch {
      setReport({ error: couldNotLoadMessage });
    } finally {
      setLoadingReport(false);
    }
    fetchAssignments(datasetId, y);
    loadLinkedData(datasetId, y);
    fetchDataEdits(datasetId);
    // Market Insights is deliberately NOT loaded here.
    // /api/lumen/ims-analyze reads the whole sales table as well as the IMS
    // table, so calling it alongside the sales report meant every page load
    // read the sales table TWICE — the larger of the two reads, duplicated,
    // for a tab most visits never open. Invalidate instead, and let opening
    // the tab pay for its own data. If the tab is already open, that's now,
    // since a sales edit changes the IMS comparison too.
    imsLoadedKeyRef.current = null;
    if (activeTab === "ims") ensureImsLoaded();
  }

  return {
    report,
    setReport,
    loadingReport,
    editedCells,
    assignments,
    linkedFiles,
    linkedRecords,
    dataEdits,
    imsFiles,
    imsReport,
    imsLoading,
    fetchReport,
    fetchAssignments,
    fetchLinkedFiles,
    fetchLinkedRecords,
    loadLinkedData,
    fetchDataEdits,
    loadImsData,
    ensureImsLoaded,
  };
}
