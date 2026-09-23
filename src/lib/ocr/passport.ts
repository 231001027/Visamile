import path from "path";
import { createWorker } from "tesseract.js";
import {
  emptyPassportFields,
  fieldsFromOcrText,
  type PassportOcrFields,
  type PassportOcrResult,
} from "./fieldsFromText";

export type { PassportOcrFields, PassportOcrResult };

/**
 * Optional managed OCR: POST raw bytes to OCR_PASSPORT_URL.
 * Expected JSON: { text?: string, fields?: Partial<PassportOcrFields> }
 */
async function ocrExternal(
  buffer: Buffer,
  mime: string
): Promise<{
  text: string;
  fields?: Partial<PassportOcrFields>;
} | null> {
  const url = process.env.OCR_PASSPORT_URL;
  if (!url) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": mime || "application/octet-stream",
      ...(process.env.OCR_PASSPORT_API_KEY
        ? { Authorization: `Bearer ${process.env.OCR_PASSPORT_API_KEY}` }
        : {}),
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    throw new Error(`External OCR failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    text?: string;
    fields?: Partial<PassportOcrFields>;
  };
  return { text: data.text || "", fields: data.fields };
}

async function ocrWithTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const root = process.cwd();
  const workerPath = path.join(root, "node_modules/tesseract.js/src/worker-script/node/index.js");
  const worker = await createWorker("eng", 1, {
    workerPath,
    cachePath: path.join(root, ".tesscache"),
    gzip: true,
    workerBlobURL: false,
  });
  try {
    const result = await worker.recognize(buffer);
    return {
      text: result.data.text || "",
      confidence: (result.data.confidence ?? 0) / 100,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Server-side OCR. Prefer OCR_PASSPORT_URL in production; local Tesseract is
 * too slow/cold for Vercel Hobby and often causes 504s.
 */
export async function extractPassportFields(
  buffer: Buffer,
  mime: string
): Promise<PassportOcrResult> {
  const warnings: string[] = [];
  let fields = emptyPassportFields();

  const external = await ocrExternal(buffer, mime).catch((err) => {
    warnings.push(err instanceof Error ? err.message : "External OCR unavailable.");
    return null;
  });

  if (external?.fields && Object.values(external.fields).some(Boolean)) {
    fields = { ...fields, ...external.fields } as PassportOcrFields;
    return {
      fields,
      confidence: {},
      rawText: external.text,
      source: "external",
      warnings: [...warnings, "OCR is assistive — review and correct all fields before submitting."],
    };
  }

  if (process.env.OCR_SERVER_TESSERACT === "1") {
    try {
      const tess = await ocrWithTesseract(buffer);
      const parsed = fieldsFromOcrText(tess.text, tess.confidence);
      return {
        ...parsed,
        warnings: [...warnings, ...parsed.warnings],
        source: external?.fields ? "mixed" : parsed.source,
      };
    } catch (err) {
      console.error("[ocr/passport] tesseract failed:", err);
      warnings.push("Server OCR failed. Enter details manually or retry with a clearer photo.");
    }
  }

  return {
    fields,
    confidence: {},
    rawText: external?.text || "",
    source: "ocr_text",
    warnings: [
      ...warnings,
      "Server OCR skipped — use browser OCR or fill the form manually.",
      "OCR is assistive — review and correct all fields before submitting.",
    ],
  };
}
