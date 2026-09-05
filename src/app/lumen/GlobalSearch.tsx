"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type SearchGroup = "area" | "item" | "rep" | "market";

function rankedMatches(list: string[], query: string): string[] {
  const q = query.toLowerCase();
  return list
    .filter((name) => name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.localeCompare(b);
    })
    .slice(0, 8);
}

// Fixed at the top of the dashboard regardless of which tab (Sales/IMS) is
// active, so a manager can jump straight to an entity's detail instead of
// scrolling the lists by hand. It covers both tabs: picking a Market
// Insights group switches to that tab and opens on it, the same way
// picking an area opens its Sales breakdown.
export function GlobalSearch({
  areas,
  items,
  reps,
  marketGroups = [],
  onFocus,
  onSelect,
}: {
  areas: string[];
  items: string[];
  reps: string[];
  marketGroups?: string[];
  /**
   * Market Insights is no longer fetched on page load, so starting a
   * search is the cue to go and get it — otherwise its groups would be
   * searchable only after visiting that tab once.
   */
  onFocus?: () => void;
  onSelect: (group: SearchGroup, name: string) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const trimmed = query.trim();
  const areaMatches = trimmed ? rankedMatches(areas, trimmed) : [];
  const itemMatches = trimmed ? rankedMatches(items, trimmed) : [];
  const repMatches = trimmed ? rankedMatches(reps, trimmed) : [];
  const marketMatches = trimmed ? rankedMatches(marketGroups, trimmed) : [];
  const totalMatches = areaMatches.length + itemMatches.length + repMatches.length + marketMatches.length;
  const showDropdown = open && trimmed !== "";

  function pick(group: SearchGroup, name: string) {
    onSelect(group, name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="sticky top-0 z-30 mb-4 bg-bg pb-3 pt-1">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            onFocus?.();
          }}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder={t.search.placeholder}
          aria-label={t.search.placeholder}
          className="w-full rounded-xl border border-bdr bg-surf px-4 py-2.5 text-sm text-white outline-none focus:border-amber"
        />

        {showDropdown && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-xl border border-bdr bg-surf shadow-lg">
            {totalMatches === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">{t.search.noResults(trimmed)}</div>
            ) : (
              <>
                {areaMatches.length > 0 && (
                  <SearchGroupList label={t.search.areasGroup} names={areaMatches} onPick={(n) => pick("area", n)} />
                )}
                {itemMatches.length > 0 && (
                  <SearchGroupList label={t.search.itemsGroup} names={itemMatches} onPick={(n) => pick("item", n)} />
                )}
                {repMatches.length > 0 && (
                  <SearchGroupList label={t.search.repsGroup} names={repMatches} onPick={(n) => pick("rep", n)} />
                )}
                {marketMatches.length > 0 && (
                  <SearchGroupList label={t.search.marketGroup} names={marketMatches} onPick={(n) => pick("market", n)} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchGroupList({
  label,
  names,
  onPick,
}: {
  label: string;
  names: string[];
  onPick: (name: string) => void;
}) {
  return (
    <div className="border-b border-bdr py-1 last:border-b-0">
      <div className="px-4 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      {names.map((name) => (
        <button
          key={name}
          type="button"
          data-testid="search-result"
          onClick={() => onPick(name)}
          className="block w-full truncate px-4 py-1.5 text-start text-sm text-white transition-colors hover:bg-surf2/60"
          dir="auto"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
