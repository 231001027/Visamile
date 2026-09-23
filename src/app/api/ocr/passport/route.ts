import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";
import { emptyPassportFields } from "@/lib/ocr/fieldsFromText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep short — production OCR runs in the browser to avoid Vercel 504s. */
export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

/**
 * Stores the passport scan for later attachment and optionally runs server OCR
 * when OCR_SERVER_TESSERACT=1 or OCR_PASSPORT_URL is set.
 * Default on Vercel: store only (fast) — client runs Tesseract in-browser.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "CONSUMER" && session.role !== "PARTNER")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required (passport photo or scan)." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Upload a JPEG or PNG photo of the passport data page (PDF is not supported for OCR yet)." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10 MB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  try {
    const { scanDocument } = await import("@/lib/scan");
    await scanDocument(buffer, mime.startsWith("image/") ? mime : "image/jpeg");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Document scan failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const tempKey = buildStorageKey(`ocr-temp/${session.sub}`, file.name);
  let tempStorageKey: string;
  try {
    tempStorageKey = await storage.put(tempKey, buffer, mime);
  } catch (err) {
    console.error("[ocr/passport] temp store failed:", err);
    return NextResponse.json({ error: "Could not store passport scan for later attachment." }, { status: 500 });
  }

  // Optional server OCR (managed URL or explicit Tesseract). Browser OCR is the default path.
  const wantServerOcr =
    Boolean(process.env.OCR_PASSPORT_URL) || process.env.OCR_SERVER_TESSERACT === "1";

  if (wantServerOcr) {
    try {
      const { extractPassportFields } = await import("@/lib/ocr/passport");
      const ocr = await extractPassportFields(buffer, mime);
      return NextResponse.json({
        fields: ocr.fields,
        confidence: ocr.confidence,
        source: ocr.source,
        warnings: ocr.warnings,
        tempStorageKey,
        fileName: file.name,
        contentType: mime,
        clientOcrRecommended: false,
      });
    } catch (err) {
      console.error("[ocr/passport] server extract failed:", err);
    }
  }

  return NextResponse.json({
    fields: emptyPassportFields(),
    confidence: {},
    source: "ocr_text",
    warnings: [],
    tempStorageKey,
    fileName: file.name,
    contentType: mime,
    clientOcrRecommended: true,
  });
}
