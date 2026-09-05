import { NextResponse } from "next/server";
import { requireUser } from "@/lib/lumen/requireUser";
import { extractTablesFromPdf } from "@/lib/lumen/pdfTableExtract";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB

// IMS-only: reads an uploaded PDF, returns a per-page breakdown of
// candidate tables (or "no_table" / "image" status) for the client to
// preview before anything is imported. Never touches Sales in any way —
// see the module comment in pdfTableExtract.ts.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF is too large (max 20MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pages = await extractTablesFromPdf(buffer);
    return NextResponse.json({ pages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read that PDF" },
      { status: 400 },
    );
  }
}
