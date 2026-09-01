// pdfjs-dist ships no type declarations for its worker entry point (it's
// meant to be loaded as a side-effecting script, not a typed module) — this
// just tells TypeScript what pdfTableExtract.ts's static import gets back.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
