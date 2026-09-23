import path from "path";
import { createWorker } from "tesseract.js";
import { parseMrzFromOcrText, type MrzFields } from "./mrz";

export type PassportOcrFields = {
  applicantFirstName: string;
  applicantLastName: string;
  applicantPassportNo: string;
  dateOfBirth: string;
  passportExpiryDate: string;
  passportIssueDate: string;
  gender: string;
  nationality: string;
  placeOfBirth: string;
};

export type PassportOcrResult = {
  fields: PassportOcrFields;
  /** Per-field confidence 0–1 where known; missing keys mean unknown. */
  confidence: Partial<Record<keyof PassportOcrFields, number>>;
  /** Raw OCR text (debug / processor review). */
  rawText: string;
  /** How the fields were obtained. */
  source: "mrz" | "ocr_text" | "external" | "mixed";
  warnings: string[];
};

function emptyFields(): PassportOcrFields {
  return {
    applicantFirstName: "",
    applicantLastName: "",
    applicantPassportNo: "",
    dateOfBirth: "",
    passportExpiryDate: "",
    passportIssueDate: "",
    gender: "",
    nationality: "",
    placeOfBirth: "",
  };
}

function fromMrz(mrz: MrzFields): PassportOcrFields {
  return {
    applicantFirstName: mrz.firstName,
    applicantLastName: mrz.lastName,
    applicantPassportNo: mrz.documentNumber,
    dateOfBirth: mrz.dateOfBirth,
    passportExpiryDate: mrz.expiryDate,
    passportIssueDate: "",
    gender: mrz.sex,
    nationality: mrz.nationality,
    placeOfBirth: "",
  };
}

/** Heuristic free-text fallback when MRZ parse fails. */
function scrapeVisualZone(text: string): Partial<PassportOcrFields> {
  const out: Partial<PassportOcrFields> = {};
  const upper = text.toUpperCase();

  const passportMatch =
    upper.match(/\b([A-Z]{1,2}\d{6,9})\b/) ||
    upper.match(/PASSPORT\s*(?:NO|NUMBER)?[:.\s]*([A-Z0-9]{6,12})/);
  if (passportMatch?.[1]) out.applicantPassportNo = passportMatch[1];

  const dob =
    upper.match(/DATE OF BIRTH[:.\s]*(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/) ||
    upper.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (dob) {
    // Prefer DD/MM/YYYY for Indian passports
    out.dateOfBirth = `${dob[3]}-${dob[2]}-${dob[1]}`;
  }

  const exp = upper.match(
    /(?:DATE OF EXPIRY|DATE OF EXPIRATION|EXPIRY)[:.\s]*(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/
  );
  if (exp) out.passportExpiryDate = `${exp[3]}-${exp[2]}-${exp[1]}`;

  const issue = upper.match(/(?:DATE OF ISSUE|DATE OF ISS)[:.\s]*(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (issue) out.passportIssueDate = `${issue[3]}-${issue[2]}-${issue[1]}`;

  if (/\bSEX[:.\s]*M\b|\bMALE\b/.test(upper)) out.gender = "MALE";
  else if (/\bSEX[:.\s]*F\b|\bFEMALE\b/.test(upper)) out.gender = "FEMALE";

  const pob = upper.match(/PLACE OF BIRTH[:.\s]*([A-Z\s]{3,40})/);
  if (pob?.[1]) out.placeOfBirth = pob[1].trim().replace(/\s+/g, " ");

  return out;
}

async function ocrWithTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  // Pin absolute paths so Next/webpack cannot rewrite workers into .next/worker-script.
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

export async function extractPassportFields(
  buffer: Buffer,
  mime: string
): Promise<PassportOcrResult> {
  const warnings: string[] = [];
  let rawText = "";
  let source: PassportOcrResult["source"] = "ocr_text";
  const confidence: PassportOcrResult["confidence"] = {};
  let fields = emptyFields();

  const external = await ocrExternal(buffer, mime).catch((err) => {
    warnings.push(err instanceof Error ? err.message : "External OCR unavailable.");
    return null;
  });

  if (external?.fields && Object.values(external.fields).some(Boolean)) {
    fields = { ...fields, ...external.fields } as PassportOcrFields;
    rawText = external.text;
    source = "external";
  } else {
    let tess: { text: string; confidence: number };
    try {
      tess = await ocrWithTesseract(buffer);
    } catch (err) {
      console.error("[ocr/passport] tesseract failed:", err);
      warnings.push(
        "Could not run local OCR on this image. Enter details manually, or try a clearer JPEG/PNG."
      );
      warnings.push("OCR is assistive — review and correct all fields before submitting.");
      return { fields, confidence, rawText: "", source: "ocr_text", warnings };
    }
    rawText = tess.text;
    const mrz = parseMrzFromOcrText(rawText);
    if (mrz) {
      fields = fromMrz(mrz);
      source = "mrz";
      for (const key of [
        "applicantFirstName",
        "applicantLastName",
        "applicantPassportNo",
        "dateOfBirth",
        "passportExpiryDate",
        "gender",
        "nationality",
      ] as const) {
        if (fields[key]) confidence[key] = Math.max(0.75, tess.confidence);
      }
    } else {
      warnings.push(
        "Could not read MRZ — filled what we could from the visual zone. Please check every field."
      );
      const scraped = scrapeVisualZone(rawText);
      fields = { ...fields, ...scraped } as PassportOcrFields;
      source = "ocr_text";
      for (const [k, v] of Object.entries(scraped)) {
        if (v) confidence[k as keyof PassportOcrFields] = Math.min(0.55, tess.confidence);
      }
    }

    if (external?.fields) {
      fields = { ...fields, ...external.fields } as PassportOcrFields;
      source = source === "mrz" ? "mixed" : "external";
    }
  }

  if (!fields.applicantPassportNo && !fields.applicantLastName) {
    warnings.push("OCR found little usable data. Retake a clear, well-lit photo of the passport data page.");
  }

  warnings.push("OCR is assistive — review and correct all fields before submitting.");

  return { fields, confidence, rawText, source, warnings };
}
