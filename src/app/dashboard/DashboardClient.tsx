"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/categories";
import UploadModal from "./UploadModal";

type Row = Record<string, unknown>;
type QA = { question: string; answer: string };

const SUGGESTIONS: Record<CategoryId, string[]> = {
  sales: ["Summarize sales for me", "Who are the top customers?", "Any trends by area?"],
  doctors: ["Summarize doctor activity", "Which reps have the most expense entries?"],
  call_rate: ["What's our average coverage?", "Which reps are below target?"],
  ims_market: ["Summarize our market share", "Where are we losing share?"],
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v: unknown, decimals = 0): string {
  return num(v).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function computeKpis(category: CategoryId, rows: Row[]): { label: string; value: string }[] {
  if (rows.length === 0) return [];
  if (category === "sales") {
    const totalValue = rows.reduce((a, r) => a + num(r.sales_value), 0);
    const totalQty = rows.reduce((a, r) => a + num(r.sales_qty), 0);
    const customers = new Set(rows.map((r) => r.customer)).size;
    return [
      { label: "Total Sales Value", value: fmt(totalValue, 2) },
      { label: "Total Sales Qty", value: fmt(totalQty) },
      { label: "Customers", value: fmt(customers) },
    ];
  }
  if (category === "doctors") {
    const totalValue = rows.reduce((a, r) => a + num(r.value), 0);
    const doctors = new Set(rows.map((r) => r.doctor_name)).size;
    return [
      { label: "Activity Entries", value: fmt(rows.length) },
      { label: "Total Value", value: fmt(totalValue, 2) },
      { label: "Doctors", value: fmt(doctors) },
    ];
  }
  if (category === "call_rate") {
    const planned = rows.reduce((a, r) => a + num(r.calls_planned), 0);
    const made = rows.reduce((a, r) => a + num(r.calls_made), 0);
    const avgCoverage = rows.reduce((a, r) => a + num(r.coverage_pct), 0) / rows.length;
    return [
      { label: "Calls Planned", value: fmt(planned) },
      { label: "Calls Made", value: fmt(made) },
      { label: "Avg Coverage %", value: fmt(avgCoverage, 1) },
    ];
  }
  const avgShare = rows.reduce((a, r) => a + num(r.market_share_pct), 0) / rows.length;
  const totalCompany = rows.reduce((a, r) => a + num(r.company_sales), 0);
  return [
    { label: "Avg Market Share %", value: fmt(avgShare, 1) },
    { label: "Total Company Sales", value: fmt(totalCompany, 2) },
    { label: "Entries", value: fmt(rows.length) },
  ];
}

export default function DashboardClient({ userEmail }: { userEmail: string }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("sales");
  const [rowsByCategory, setRowsByCategory] = useState<Partial<Record<CategoryId, Row[]>>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Record<CategoryId, QA[]>>({
    sales: [],
    doctors: [],
    call_rate: [],
    ims_market: [],
  });

  const loadCategory = useCallback(async (category: CategoryId) => {
    const supabase = createClient();
    const def = CATEGORIES[category];
    const { data } = await supabase
      .from(def.table)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    setRowsByCategory((prev) => ({ ...prev, [category]: data ?? [] }));
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const def = CATEGORIES[activeCategory];
      const { data } = await supabase
        .from(def.table)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (!ignore) setRowsByCategory((prev) => ({ ...prev, [activeCategory]: data ?? [] }));
    })();
    return () => {
      ignore = true;
    };
  }, [activeCategory]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleAsk(q: string) {
    if (!q.trim()) return;
    setAsking(true);
    setAskError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          category: activeCategory,
          history: conversation[activeCategory],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");

      setConversation((prev) => ({
        ...prev,
        [activeCategory]: [...prev[activeCategory], { question: q, answer: json.answer }],
      }));
      setQuestion("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  const def = CATEGORIES[activeCategory];
  const loadedRows = rowsByCategory[activeCategory];
  const isLoading = loadedRows === undefined;
  const rows = loadedRows ?? [];
  const kpis = computeKpis(activeCategory, rows);
  const currentConversation = conversation[activeCategory];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-bdr bg-surf px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[#d68820] font-bold text-bg">
              L
            </div>
            <div className="font-semibold">Lumen</div>
          </div>
          <nav className="flex gap-1">
            {CATEGORY_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  id === activeCategory
                    ? "bg-surf2 text-amber"
                    : "text-muted hover:bg-surf2 hover:text-white"
                }`}
              >
                {CATEGORIES[id].label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowUpload(true)}
            className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-3 py-1.5 text-sm font-semibold text-bg"
          >
            + Upload New Data
          </button>
          <div className="text-xs text-muted">{userEmail}</div>
          <button onClick={handleLogout} className="text-sm text-muted hover:text-red">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex flex-1 gap-6 overflow-hidden p-6">
        <section className="flex flex-1 flex-col overflow-hidden">
          {kpis.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-bdr bg-surf p-4">
                  <div className="text-xs text-muted">{k.label}</div>
                  <div className="mt-1 font-mono text-xl text-amber">{k.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-xl border border-bdr bg-surf">
            {isLoading ? (
              <p className="p-6 text-sm text-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <p className="mb-1 text-sm font-medium">No {def.label.toLowerCase()} data yet</p>
                <p className="text-xs text-muted">
                  Click &quot;Upload New Data&quot; to add a file for this category.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surf2">
                  <tr>
                    {def.fields.map((f) => (
                      <th key={f.key} className="px-3 py-2 text-xs font-medium text-muted whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-bdr/50">
                      {def.fields.map((f) => (
                        <td key={f.key} className="px-3 py-1.5 whitespace-nowrap">
                          {f.type === "number" ? fmt(r[f.key], 2) : String(r[f.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {rows.length > 200 && (
            <p className="mt-1 text-xs text-muted">Showing 200 of {rows.length} rows.</p>
          )}
        </section>

        <aside className="flex w-96 shrink-0 flex-col rounded-xl border border-bdr bg-surf">
          <div className="border-b border-bdr px-4 py-3 text-sm font-medium">
            Ask about {def.label}
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {currentConversation.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS[activeCategory].map((s) => (
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
                <div className="ml-auto max-w-full rounded-2xl rounded-br-sm bg-surf2 px-3 py-2 text-sm">
                  {qa.question}
                </div>
                <div className="max-w-full rounded-2xl rounded-bl-sm border-l-2 border-amber bg-bg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {qa.answer}
                </div>
              </div>
            ))}
            {asking && <p className="text-sm text-muted">Thinking…</p>}
            {askError && <p className="text-sm text-red">{askError}</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(question);
            }}
            className="border-t border-bdr p-3"
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
                className="rounded-lg bg-gradient-to-br from-amber to-[#d68820] px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50"
              >
                Ask
              </button>
            </div>
          </form>
        </aside>
      </main>

      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onImported={(category) => {
          setActiveCategory(category);
          loadCategory(category);
        }}
      />
    </div>
  );
}
