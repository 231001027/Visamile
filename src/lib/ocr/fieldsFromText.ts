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
  confidence: Partial<Record<keyof PassportOcrFields, number>>;
  rawText: string;
  source: "mrz" | "ocr_text" | "external" | "mixed";
  warnings: string[];
};

export function emptyPassportFields(): PassportOcrFields {
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
export function scrapeVisualZone(text: string): Partial<PassportOcrFields> {
  const out: Partial<PassportOcrFields> = {};
  const upper = text.toUpperCase();

  const passportMatch =
    upper.match(/\b([A-Z]{1,2}\d{6,9})\b/) ||
    upper.match(/PASSPORT\s*(?:NO|NUMBER)?[:.\s]*([A-Z0-9]{6,12})/);
  if (passportMatch?.[1]) out.applicantPassportNo = passportMatch[1];

  const dob =
    upper.match(/DATE OF BIRTH[:.\s]*(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/) ||
    upper.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (dob) out.dateOfBirth = `${dob[3]}-${dob[2]}-${dob[1]}`;

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

/** Shared MRZ / visual-zone parsing used by server and browser OCR. */
export function fieldsFromOcrText(rawText: string, ocrConfidence = 0.7): PassportOcrResult {
  const warnings: string[] = [];
  const confidence: PassportOcrResult["confidence"] = {};
  let fields = emptyPassportFields();
  let source: PassportOcrResult["source"] = "ocr_text";

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
      if (fields[key]) confidence[key] = Math.max(0.75, ocrConfidence);
    }
  } else {
    warnings.push(
      "Could not read MRZ — filled what we could from the visual zone. Please check every field."
    );
    const scraped = scrapeVisualZone(rawText);
    fields = { ...fields, ...scraped } as PassportOcrFields;
    for (const [k, v] of Object.entries(scraped)) {
      if (v) confidence[k as keyof PassportOcrFields] = Math.min(0.55, ocrConfidence);
    }
  }

  if (!fields.applicantPassportNo && !fields.applicantLastName) {
    warnings.push("OCR found little usable data. Retake a clear, well-lit photo of the passport data page.");
  }
  warnings.push("OCR is assistive — review and correct all fields before submitting.");

  return { fields, confidence, rawText, source, warnings };
}
