import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";
import { extractPassportFields } from "@/lib/ocr/passport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** OCR can be slow on cold start / large images. */
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

/**
 * Traveler/partner uploads a passport data-page image.
 * Returns structured fields for form prefill + a tempStorageKey so the same
 * file can be attached as PASSPORT_FRONT_PAGE when the case is created.
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
    await scanDocument(buffer, mime.startsWith("image/") || mime === "application/pdf" ? mime : "image/jpeg");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Document scan failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let ocr;
  try {
    ocr = await extractPassportFields(buffer, mime);
  } catch (err) {
    console.error("[ocr/passport] extract failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "OCR failed. Try a clearer photo." },
      { status: 500 }
    );
  }

  const tempKey = buildStorageKey(`ocr-temp/${session.sub}`, file.name);
  let tempStorageKey: string;
  try {
    tempStorageKey = await storage.put(tempKey, buffer, mime);
  } catch (err) {
    console.error("[ocr/passport] temp store failed:", err);
    return NextResponse.json({ error: "Could not store passport scan for later attachment." }, { status: 500 });
  }

  return NextResponse.json({
    fields: ocr.fields,
    confidence: ocr.confidence,
    source: ocr.source,
    warnings: ocr.warnings,
    tempStorageKey,
    fileName: file.name,
    contentType: mime,
  });
}
