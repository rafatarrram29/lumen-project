"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// A number rendered as plain text that turns into an input on click, used
// for every raw data figure the signed-in user can correct directly (a
// sales value for one item inside one area, for a given month). Saving
// just calls back up to the parent, which persists the edit and re-fetches
// the report — every level that depends on this value (area totals,
// line averages, targets, rep leaderboard, findings) is recomputed
// fresh from the raw rows on that re-fetch, so nothing here needs to know
// about any of that.
export function EditableValue({
  value,
  formatted,
  edited,
  onSave,
  className,
}: {
  value: number;
  formatted: string;
  edited?: { editedBy: string | null; editedAt: string };
  onSave: (newValue: number) => Promise<void>;
  className?: string;
}) {
  const { t, lang } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const n = Number(draft);
    if (!Number.isFinite(n) || n === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        disabled={saving}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-24 rounded border border-amber bg-surf2 px-1 py-0.5 font-mono text-xs text-white outline-none disabled:opacity-50"
      />
    );
  }

  const editedTitle = edited
    ? t.inlineEdit.editedTitle(
        edited.editedBy ?? "?",
        new Date(edited.editedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US"),
      )
    : undefined;

  return (
    <span
      role="button"
      tabIndex={0}
      title={editedTitle ?? t.inlineEdit.editHint}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          setDraft(String(value));
          setEditing(true);
        }
      }}
      className={`cursor-pointer underline decoration-dotted decoration-muted/50 hover:decoration-white ${className ?? ""}`}
    >
      {formatted}
      {edited && (
        <span className="ms-0.5 text-amber" aria-hidden>
          ✎
        </span>
      )}
    </span>
  );
}

// Same click-to-edit interaction, for a linked file's (Achievement, KPIs,
// or any other type) free-form field values — these can be text or
// numbers, so it edits and displays as plain text rather than a number
// input.
export function EditableFieldValue({
  value,
  edited,
  onSave,
  className,
  title,
}: {
  value: unknown;
  edited?: { editedBy: string | null; editedAt: string };
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  title?: string;
}) {
  const { t, lang } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (draft === String(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        disabled={saving}
        dir="auto"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={`w-32 rounded border border-amber bg-surf2 px-1 py-0.5 text-xs text-white outline-none disabled:opacity-50 ${className ?? ""}`}
      />
    );
  }

  const editedTitle = edited
    ? t.inlineEdit.editedTitle(
        edited.editedBy ?? "?",
        new Date(edited.editedAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US"),
      )
    : undefined;

  return (
    <span
      role="button"
      tabIndex={0}
      dir="auto"
      title={editedTitle ?? title ?? t.inlineEdit.editHint}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          setDraft(String(value));
          setEditing(true);
        }
      }}
      className={`cursor-pointer underline decoration-dotted decoration-muted/50 hover:decoration-white ${className ?? ""}`}
    >
      {String(value)}
      {edited && (
        <span className="ms-0.5 text-amber" aria-hidden>
          ✎
        </span>
      )}
    </span>
  );
}
