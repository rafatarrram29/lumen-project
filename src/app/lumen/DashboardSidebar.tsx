"use client";

// The dashboard's left rail: the upload buttons, the year, Analyze, the
// dataset list, linked files, and the correction log.
//
// It came out of LumenClient's render as one piece because that is what it
// is — everything here is the sidebar and nothing else in the page is. The
// four dashed "do something with a file" buttons had four copies of the
// same twelve utility classes between them; they share SidebarAction now,
// so they cannot drift apart one hover colour at a time.

import { useRef } from "react";
import Sidebar from "@/components/Sidebar";
import type { Dataset } from "@/lib/lumen/columnMapping";
import type { Translations } from "@/lib/i18n/translations";
import type { LinkedFile, JoinKey } from "@/lib/lumen/linkedFiles";
import { LinkedFilesPanel } from "./LinkedFilesPanel";

const SHEET_TYPES = ".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.ods";

/** One of the rail's dashed, full-width buttons. */
function SidebarAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mb-2 w-full rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function DashboardSidebar({
  userEmail,
  userId,
  t,
  activeTab,
  uploading,
  uploadProgress,
  uploadError,
  uploadMessage,
  loadingReport,
  year,
  setYear,
  datasets,
  selectedDatasetId,
  linkedFiles,
  onFilesSelected,
  onTargetsFileSelected,
  onAssignAreas,
  onAssignManagers,
  onAnalyze,
  onSelectDataset,
  onEditMapping,
  onDeleteDataset,
  onShowCorrectionLog,
  onAddLinkedFile,
  onReplaceLinkedFile,
  onDeleteLinkedFile,
  onEditJoinKeys,
}: {
  userEmail: string;
  userId: string;
  t: Translations;
  activeTab: "sales" | "ims";
  uploading: boolean;
  uploadProgress: string | null;
  uploadError: string | null;
  uploadMessage: string | null;
  loadingReport: boolean;
  year: number;
  setYear: (y: number) => void;
  datasets: Dataset[];
  selectedDatasetId: string | null;
  linkedFiles: LinkedFile[];
  onFilesSelected: (files: File[]) => void;
  onTargetsFileSelected: (file: File) => void;
  onAssignAreas: () => void;
  onAssignManagers: () => void;
  onAnalyze: () => void;
  onSelectDataset: (datasetId: string) => void;
  onEditMapping: () => void;
  onDeleteDataset: (dataset: Dataset) => void;
  onShowCorrectionLog: () => void;
  onAddLinkedFile: (file: File) => void;
  onReplaceLinkedFile: (fileId: string, file: File) => void;
  onDeleteLinkedFile: (file: LinkedFile) => void;
  onEditJoinKeys: (fileId: string, joinKeys: JoinKey[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetsFileInputRef = useRef<HTMLInputElement>(null);
  const onSales = activeTab === "sales";

  return (
    <Sidebar userEmail={userEmail}>
      {onSales && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={SHEET_TYPES}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onFilesSelected(files);
              e.target.value = "";
            }}
          />
          <SidebarAction onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (uploadProgress ?? t.sidebar.uploading) : t.sidebar.upload}
          </SidebarAction>

          {selectedDatasetId && (
            <>
              <input
                ref={targetsFileInputRef}
                type="file"
                accept={SHEET_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onTargetsFileSelected(file);
                  e.target.value = "";
                }}
              />
              <SidebarAction onClick={() => targetsFileInputRef.current?.click()} disabled={uploading}>
                {t.sidebar.uploadTargets}
              </SidebarAction>
              <SidebarAction onClick={onAssignAreas} disabled={uploading}>
                {t.org.assignAreasButton}
              </SidebarAction>
              <SidebarAction onClick={onAssignManagers} disabled={uploading}>
                {t.org.assignManagersButton}
              </SidebarAction>
            </>
          )}

          <label className="mb-2 flex items-center justify-between gap-2 text-sm text-muted">
            {t.sidebar.year}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-20 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 font-mono text-sm text-white outline-none focus:border-amber"
            />
          </label>
          <button
            onClick={onAnalyze}
            disabled={loadingReport || !selectedDatasetId}
            className="w-full rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {loadingReport ? t.sidebar.loading : t.sidebar.analyze}
          </button>
        </>
      )}

      {/* Shared by both the Sales and IMS upload flows, so this stays
          visible regardless of which tab is active. */}
      {uploadError && <p className="mb-2 mt-2 break-words text-xs text-red">{uploadError}</p>}
      {uploadMessage && <p className="mb-2 mt-2 break-words text-xs text-green">{uploadMessage}</p>}

      {datasets.length > 0 && (
        <div className="mt-4 border-t border-bdr pt-4">
          <div className="mb-2 text-xs font-semibold text-muted">{t.sidebar.datasets}</div>
          <div className="flex flex-col gap-1.5">
            {datasets.map((d) => {
              const isSelected = d.id === selectedDatasetId;
              return (
                <div key={d.id} className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectDataset(d.id)}
                    title={d.name}
                    dir="auto"
                    className={`min-w-0 flex-1 truncate rounded-lg border px-3 py-1.5 text-start text-sm transition-colors ${
                      isSelected ? "border-amber bg-amber/10 text-white" : "border-bdr text-muted hover:text-white"
                    }`}
                  >
                    {d.name}
                  </button>
                  {/* Only the owner may change a dataset's shape or remove
                      it; a shared dataset is read-only to everyone else. */}
                  {isSelected && d.userId === userId && (
                    <>
                      <button
                        onClick={onEditMapping}
                        title={t.editMapping.editSalesButton}
                        aria-label={t.editMapping.editSalesButton}
                        className="shrink-0 rounded-lg border border-bdr px-2.5 py-1.5 text-muted transition-colors hover:border-amber hover:text-amber"
                      >
                        ⚙
                      </button>
                      <button
                        onClick={() => onDeleteDataset(d)}
                        title={t.sidebar.deleteDataset(d.name)}
                        aria-label={t.sidebar.deleteDataset(d.name)}
                        className="shrink-0 rounded-lg border border-bdr px-2.5 py-1.5 text-muted transition-colors hover:border-red hover:text-red"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onSales && selectedDatasetId && (
        <>
          <LinkedFilesPanel
            files={linkedFiles}
            disabled={uploading}
            onAddFile={onAddLinkedFile}
            onReplaceFile={onReplaceLinkedFile}
            onDeleteFile={onDeleteLinkedFile}
            onEditJoinKeys={onEditJoinKeys}
          />
          <button
            onClick={onShowCorrectionLog}
            className="mt-4 w-full rounded-lg border border-bdr px-3 py-2 text-xs text-muted transition-colors hover:border-amber hover:text-white"
          >
            {t.corrections.logButton}
          </button>
        </>
      )}
    </Sidebar>
  );
}
