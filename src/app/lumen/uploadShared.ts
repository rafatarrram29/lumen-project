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
