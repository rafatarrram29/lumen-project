"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import Sidebar from "@/components/Sidebar";

type Dataset = {
  id: string;
  name: string;
  row_count: number;
  created_at: string;
};

type QA = { question: string; answer: string };

const SUGGESTIONS = [
  "Summarize this data for me",
  "What are the top performers?",
  "Any trends I should know about?",
];

export default function DashboardClient({
  userEmail,
  initialDatasets,
}: {
  userEmail: string;
  initialDatasets: Dataset[];
}) {
  const [datasets, setDatasets] = useState<Dataset[]>(initialDatasets);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDatasets[0]?.id ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Record<string, QA[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDataset = datasets.find((d) => d.id === selectedId) ?? null;
  const currentConversation = selectedId ? (conversation[selectedId] ?? []) : [];

  function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const columns = result.meta.fields ?? [];
        const rows = result.data;

        if (columns.length === 0 || rows.length === 0) {
          setUploadError("Couldn't find any data in that file.");
          setUploading(false);
          return;
        }

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, columns, rows }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Upload failed");

          setDatasets((prev) => [json.dataset, ...prev]);
          setSelectedId(json.dataset.id);
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        setUploadError(err.message);
        setUploading(false);
      },
    });
  }

  async function handleAsk(q: string) {
    if (!q.trim() || !selectedId) return;
    setAsking(true);
    setAskError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          datasetId: selectedId,
          history: currentConversation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");

      setConversation((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] ?? []), { question: q, answer: json.answer }],
      }));
      setQuestion("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg sm:flex-row">
      <Sidebar userEmail={userEmail} active="/dashboard">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mb-2 rounded-lg border border-dashed border-bdr px-3 py-2.5 text-sm text-muted transition-colors hover:border-amber hover:text-white disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "+ Upload CSV file"}
        </button>
        {uploadError && <p className="mb-2 text-xs text-red">{uploadError}</p>}

        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Your datasets
          </div>
          {datasets.length === 0 && (
            <p className="text-sm text-muted">No files uploaded yet.</p>
          )}
          {datasets.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                d.id === selectedId
                  ? "bg-surf2 text-amber"
                  : "text-muted hover:bg-surf2 hover:text-white"
              }`}
            >
              <div className="truncate font-medium">{d.name}</div>
              <div className="font-mono text-xs opacity-70">{d.row_count} rows</div>
            </button>
          ))}
        </div>
      </Sidebar>

      <main className="flex flex-1 flex-col">
        {!selectedDataset ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="mb-1 text-lg font-medium">No dataset selected</p>
            <p className="text-sm text-muted">
              Upload a CSV file from the sidebar to start asking questions.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-bdr px-6 py-4">
              <div className="font-mono text-xs text-amber">{selectedDataset.name}</div>
              <div className="text-xs text-muted">{selectedDataset.row_count} rows</div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {currentConversation.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleAsk(s)}
                      className="rounded-full border border-bdr px-3 py-1.5 text-xs text-muted transition-colors hover:border-amber hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {currentConversation.map((qa, i) => (
                <div key={i} className="space-y-2">
                  <div className="ml-auto max-w-lg rounded-2xl rounded-br-sm bg-surf2 px-4 py-2.5 text-sm">
                    {qa.question}
                  </div>
                  <div className="max-w-lg rounded-2xl rounded-bl-sm border-l-2 border-amber bg-surf px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {qa.answer}
                  </div>
                </div>
              ))}

              {asking && (
                <div className="max-w-lg rounded-2xl rounded-bl-sm border-l-2 border-amber bg-surf px-4 py-2.5 text-sm text-muted">
                  Thinking…
                </div>
              )}
              {askError && <p className="text-sm text-red">{askError}</p>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk(question);
              }}
              className="border-t border-bdr p-4"
            >
              <div className="flex items-end gap-2 rounded-xl border border-bdr bg-surf2 p-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAsk(question);
                    }
                  }}
                  placeholder="Ask anything about this data…"
                  rows={1}
                  className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
