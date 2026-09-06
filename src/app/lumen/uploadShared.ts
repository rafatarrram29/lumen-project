// Small pieces the upload paths share.
//
// Uploading a sales file, a linked file and an IMS file are three separate
// flows that nonetheless drive the same status bar and the same undo
// window. Naming that here keeps each flow's hook from re-declaring it, and
// keeps the four status setters travelling together instead of as four
// loose parameters.

/** Rows per insert request. Big enough to be few round trips, small enough
 *  to stay under request-size limits on a company-sized file. */
export const UPLOAD_BATCH_SIZE = 1000;

/** How long an inline edit stays undoable. */
export const UNDO_WINDOW_MS = 8000;

/** The dashboard's one upload status bar, as the setters that drive it. */
export type UploadStatus = {
  setUploading: (v: boolean) => void;
  setProgress: (v: string | null) => void;
  setError: (v: string | null) => void;
  setMessage: (v: string | null) => void;
};

/** The message to show when something threw. */
export function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Rows split into insert-sized batches, in order. */
export function intoBatches<T>(rows: T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
    batches.push(rows.slice(i, i + UPLOAD_BATCH_SIZE));
  }
  return batches;
}

/**
 * Every problem an upload ran into, as the one line the status bar shows.
 *
 * There is a single error slot, and a multi-file upload can produce two
 * kinds of problem at once: a file that failed outright, and a file that
 * went in but with a warning worth reading (rows skipped, duplicates
 * dropped, a row count that does not match what was inserted). Writing
 * them to that slot in sequence meant the last write won and the warning
 * vanished — precisely the warnings that exist to stop someone trusting a
 * wrong number. They are combined instead.
 *
 * Null when there was nothing to report, so the caller can leave the slot
 * alone rather than clearing it with an empty string.
 */
export function issueLine(...groups: (string[] | string | null | undefined)[]): string | null {
  const all = groups
    .flatMap((g) => (Array.isArray(g) ? g : [g]))
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return all.length > 0 ? all.join(" | ") : null;
}
