"use client";

import { useRef, useState } from "react";
import { parseFile, type ParsedFile } from "@/lib/fileParsing";
import { CATEGORIES, CATEGORY_IDS, requiredFields, type CategoryId } from "@/lib/categories";

type Stage = "idle" | "parsing" | "classifying" | "reviewing" | "importing" | "done" | "error";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function guessMapping(category: CategoryId, columns: string[]) {
  const guess: Record<string, string | null> = {};
  for (const f of CATEGORIES[category].fields) {
    const match = columns.find(
      (c) => normalize(c) === normalize(f.key) || normalize(c) === normalize(f.label),
    );
    guess[f.key] = match ?? null;
  }
  return guess;
}

export default function UploadModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (category: CategoryId) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [category, setCategory] = useState<CategoryId | "unknown">("unknown");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setFileName("");
    setParsed(null);
    setCategory("unknown");
    setConfidence(null);
    setReasoning("");
    setMapping({});
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStage("parsing");

    try {
      const parsedFile = await parseFile(file);
      if (parsedFile.columns.length === 0 || parsedFile.rows.length === 0) {
        throw new Error("Couldn't find any data in that file.");
      }
      setParsed(parsedFile);
      setStage("classifying");

      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          columns: parsedFile.columns,
          rows: parsedFile.rows,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Classification failed");

      setCategory(json.category);
      setConfidence(json.confidence);
      setReasoning(json.reasoning);
      setMapping(json.columnMapping ?? {});
      setStage("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  function handleCategoryChange(next: CategoryId | "unknown") {
    setCategory(next);
    if (next === "unknown" || !parsed) {
      setMapping({});
      return;
    }
    setMapping(guessMapping(next, parsed.columns));
  }

  async function handleConfirm() {
    if (category === "unknown" || !parsed) {
      setError("Please choose a category before importing.");
      return;
    }
    const missing = requiredFields(category).filter((f) => !mapping[f.key]);
    if (missing.length > 0) {
      setError(`Please map a column for: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setError(null);
    setStage("importing");

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          category,
          columnMapping: mapping,
          rows: parsed.rows,
          aiConfidence: confidence,
          aiReasoning: reasoning,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");

      setResult({ imported: json.imported, skipped: json.skipped });
      setStage("done");
      onImported(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStage("reviewing");
    }
  }

  if (!open) return null;

  const needsAttention =
    category === "unknown" || (confidence !== null && confidence < 0.75);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-bdr bg-surf p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upload New Data</h2>
          <button onClick={handleClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        {stage === "idle" && (
          <div>
            <p className="mb-4 text-sm text-muted">
              Upload a .csv or .xlsx file. Claude will read the column headers and a
              sample of rows to figure out which category it belongs to and how the
              columns map -- you&apos;ll get a chance to review before anything is saved.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-bdr px-3 py-6 text-sm text-muted transition-colors hover:border-amber hover:text-white"
            >
              Click to choose a file
            </button>
          </div>
        )}

        {(stage === "parsing" || stage === "classifying") && (
          <p className="py-8 text-center text-sm text-muted">
            {stage === "parsing" ? "Reading file…" : "Asking Claude to classify this file…"}
          </p>
        )}

        {stage === "error" && (
          <div>
            <p className="mb-4 text-sm text-red">{error}</p>
            <button
              onClick={reset}
              className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg"
            >
              Try again
            </button>
          </div>
        )}

        {stage === "reviewing" && parsed && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Detected category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as CategoryId | "unknown")}
                className="w-full rounded-lg border border-bdr bg-surf2 px-3 py-2 text-sm outline-none focus:border-amber"
              >
                <option value="unknown">Unknown -- please choose one</option>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].label}
                  </option>
                ))}
              </select>
              {confidence !== null && (
                <p className={`mt-1.5 text-xs ${needsAttention ? "text-amber" : "text-muted"}`}>
                  {needsAttention ? "⚠ " : ""}
                  Claude is {Math.round(confidence * 100)}% confident. {reasoning}
                </p>
              )}
            </div>

            {category !== "unknown" && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted">
                  Column mapping (required fields marked *)
                </div>
                <div className="space-y-2 rounded-lg border border-bdr p-3">
                  {CATEGORIES[category].fields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3">
                      <span className="text-sm">
                        {f.label}
                        {f.required && <span className="text-red"> *</span>}
                      </span>
                      <select
                        value={mapping[f.key] ?? ""}
                        onChange={(e) =>
                          setMapping((prev) => ({ ...prev, [f.key]: e.target.value || null }))
                        }
                        className="w-48 rounded-lg border border-bdr bg-surf2 px-2 py-1.5 text-sm outline-none focus:border-amber"
                      >
                        <option value="">-- none --</option>
                        {parsed.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">
                Preview ({parsed.rows.length} rows total)
              </div>
              <div className="overflow-x-auto rounded-lg border border-bdr">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-bdr text-muted">
                      {parsed.columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 font-medium whitespace-nowrap">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 3).map((r, i) => (
                      <tr key={i} className="border-b border-bdr/50">
                        {parsed.columns.map((c) => (
                          <td key={c} className="px-2 py-1.5 whitespace-nowrap">
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-sm text-red">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="rounded-lg border border-bdr px-4 py-2 text-sm text-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg"
              >
                Confirm &amp; Import
              </button>
            </div>
          </div>
        )}

        {stage === "importing" && (
          <p className="py-8 text-center text-sm text-muted">Importing…</p>
        )}

        {stage === "done" && result && (
          <div>
            <p className="mb-4 text-sm text-green">
              Imported {result.imported} row{result.imported === 1 ? "" : "s"}
              {result.skipped > 0
                ? ` (${result.skipped} skipped for missing required fields)`
                : ""}{" "}
              into {category !== "unknown" ? CATEGORIES[category].label : ""}.
            </p>
            <button
              onClick={handleClose}
              className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
