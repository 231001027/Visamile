/**
 * ICAO 9303 TD3 passport MRZ parser (2 lines × 44 chars).
 * Used after OCR to pull structured passport fields with higher accuracy
 * than free-text OCR alone.
 */

export type MrzFields = {
  documentNumber: string;
  nationality: string;
  dateOfBirth: string; // YYYY-MM-DD
  sex: "MALE" | "FEMALE" | "OTHER" | "";
  expiryDate: string; // YYYY-MM-DD
  lastName: string;
  firstName: string;
  middleName: string;
  personalNumber?: string;
};

function mrzCharValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  if (ch === "<") return 0;
  return 0;
}

function checkDigit(data: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += mrzCharValue(data[i]!) * weights[i % 3]!;
  }
  return sum % 10;
}

function parseYyMmDd(raw: string): string {
  if (!/^\d{6}$/.test(raw)) return "";
  const yy = Number(raw.slice(0, 2));
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  // Passports: DOB usually 19xx/20xx; expiry usually near-term → prefer 20xx if yy < 50 for expiry handled by caller
  const century = yy >= 50 ? 1900 : 2000;
  const yyyy = century + yy;
  return `${yyyy}-${mm}-${dd}`;
}

function parseExpiry(raw: string): string {
  if (!/^\d{6}$/.test(raw)) return "";
  const yy = Number(raw.slice(0, 2));
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  // Expiry is almost always 20xx for current travelers
  const yyyy = 2000 + yy;
  return `${yyyy}-${mm}-${dd}`;
}

function cleanName(part: string): string {
  return part.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

/** Find TD3 MRZ lines in noisy OCR text. */
export function extractMrzLines(ocrText: string): [string, string] | null {
  const normalized = ocrText
    .toUpperCase()
    .replace(/[^\nA-Z0-9<]/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Prefer lines that look like P<… and a second 44-char line
  for (let i = 0; i < normalized.length - 1; i++) {
    let a = normalized[i]!.replace(/\s/g, "");
    let b = normalized[i + 1]!.replace(/\s/g, "");
    // Pad / trim common OCR length errors around 44
    if (a.startsWith("P") && a.length >= 40 && b.length >= 40) {
      a = a.slice(0, 44).padEnd(44, "<");
      b = b.slice(0, 44).padEnd(44, "<");
      if (a.length === 44 && b.length === 44) return [a, b];
    }
  }

  // Fallback: any two consecutive long lines with <<
  const long = normalized.map((l) => l.replace(/\s/g, "")).filter((l) => l.length >= 40 && l.includes("<"));
  if (long.length >= 2) {
    const a = long[long.length - 2]!.slice(0, 44).padEnd(44, "<");
    const b = long[long.length - 1]!.slice(0, 44).padEnd(44, "<");
    if (a.startsWith("P")) return [a, b];
  }
  return null;
}

export function parseTd3Mrz(line1: string, line2: string): MrzFields | null {
  if (line1.length !== 44 || line2.length !== 44) return null;
  if (!line1.startsWith("P")) return null;

  const names = line1.slice(5);
  const [lastRaw, givenRaw = ""] = names.split("<<");
  const lastName = cleanName(lastRaw ?? "");
  const givenParts = cleanName(givenRaw).split(/\s+/).filter(Boolean);
  const firstName = givenParts[0] ?? "";
  const middleName = givenParts.slice(1).join(" ");

  const documentNumber = line2.slice(0, 9).replace(/</g, "");
  const docCheck = line2[9];
  if (docCheck !== String(checkDigit(line2.slice(0, 9)))) {
    // Soft-fail: still return fields; OCR often mangles check digits
  }

  const nationality = line2.slice(10, 13).replace(/</g, "");
  const dobRaw = line2.slice(13, 19);
  const sexChar = line2[20];
  const expRaw = line2.slice(21, 27);

  const sex: MrzFields["sex"] =
    sexChar === "M" ? "MALE" : sexChar === "F" ? "FEMALE" : sexChar === "<" ? "" : "OTHER";

  return {
    documentNumber,
    nationality,
    dateOfBirth: parseYyMmDd(dobRaw),
    sex,
    expiryDate: parseExpiry(expRaw),
    lastName,
    firstName,
    middleName,
    personalNumber: line2.slice(28, 42).replace(/</g, "") || undefined,
  };
}

export function parseMrzFromOcrText(ocrText: string): MrzFields | null {
  const lines = extractMrzLines(ocrText);
  if (!lines) return null;
  return parseTd3Mrz(lines[0], lines[1]);
}
