import { DOC_TYPE_MAP } from "./documentChecklist";

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PASSPORT_FRONT_PAGE: "Passport front page",
  PASSPORT_BACK_PAGE: "Passport back page",
  PHOTOGRAPH: "Photograph",
  PAN_CARD: "PAN card",
  GOVERNMENT_EMPLOYEE_DOCS: "Government employee documents",
  RETIRED_SENIOR_CITIZEN_DOCS: "Retired / senior citizen documents",
  TRAVEL_HISTORY: "Travel history",
  SALARIED_EMPLOYEE_DOCS: "Employment / salary proof",
  BUSINESS_OWNER_DOCS: "Business owner documents",
  PROFESSIONAL_DOCS: "Professional documents",
  STUDENT_WITH_PARENTS_DOCS: "Student documents (with parents)",
  STUDENT_WITHOUT_PARENTS_DOCS: "Student documents (without parents)",
  INVITATION_DOCS: "Invitation letter / documents",
  COVERING_LETTER: "Covering letter",
  IDENTITY_PROOF: "Identity proof",
  PERSONAL_FINANCIAL_DOCS: "Bank statement / financial docs",
  LEGAL_DOCUMENT: "Legal document",
  OTHER_DOCUMENT: "Other document",
};

const KEYWORD_TO_TYPE: { pattern: RegExp; type: string }[] = [
  { pattern: /\bpan\b/i, type: "PAN_CARD" },
  { pattern: /passport\s*front/i, type: "PASSPORT_FRONT_PAGE" },
  { pattern: /passport\s*back/i, type: "PASSPORT_BACK_PAGE" },
  { pattern: /photograph|photo\b/i, type: "PHOTOGRAPH" },
  { pattern: /travel\s*history/i, type: "TRAVEL_HISTORY" },
  { pattern: /invitation/i, type: "INVITATION_DOCS" },
  { pattern: /identity|aadhaar|aadhar|voter/i, type: "IDENTITY_PROOF" },
  { pattern: /bank\s*statement|financial/i, type: "PERSONAL_FINANCIAL_DOCS" },
  { pattern: /covering\s*letter/i, type: "COVERING_LETTER" },
  { pattern: /employment|salary|salary\s*slip|employer/i, type: "SALARIED_EMPLOYEE_DOCS" },
  { pattern: /business\s*owner|gst/i, type: "BUSINESS_OWNER_DOCS" },
  { pattern: /student/i, type: "STUDENT_WITH_PARENTS_DOCS" },
  { pattern: /government\s*employee/i, type: "GOVERNMENT_EMPLOYEE_DOCS" },
  { pattern: /legal/i, type: "LEGAL_DOCUMENT" },
];

/** Parse verifier note like "Documents required: PAN card; Employment proof" into types. */
export function documentTypesFromRequestNote(note: string | null | undefined): {
  value: string;
  label: string;
}[] {
  if (!note?.trim()) return [];
  const body = note.replace(/^Documents required:\s*/i, "");
  const parts = body.split(/[;,\n]+/).map((p) => p.trim()).filter(Boolean);
  const found: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    let matched: string | null = null;
    for (const { pattern, type } of KEYWORD_TO_TYPE) {
      if (pattern.test(part)) {
        matched = type;
        break;
      }
    }
    const value = matched ?? "OTHER_DOCUMENT";
    if (seen.has(value) && value !== "OTHER_DOCUMENT") continue;
    if (value === "OTHER_DOCUMENT" && seen.has(`OTHER:${part.toLowerCase()}`)) continue;
    if (value === "OTHER_DOCUMENT") seen.add(`OTHER:${part.toLowerCase()}`);
    else seen.add(value);
    found.push({
      value,
      label: matched ? DOCUMENT_TYPE_LABELS[value] ?? part : part,
    });
  }

  return found;
}

export function allDocumentTypeOptions(): { value: string; label: string }[] {
  return Object.keys(DOCUMENT_TYPE_LABELS).map((value) => ({
    value,
    label: DOCUMENT_TYPE_LABELS[value]!,
  }));
}

export function checklistTypeOptions(
  checklist: { id: string; label: string; required: boolean }[] | null | undefined
): { value: string; label: string; required: boolean }[] {
  if (!checklist?.length) {
    return Object.values(DOC_TYPE_MAP).map((value) => ({
      value,
      label: DOCUMENT_TYPE_LABELS[value] ?? value.replaceAll("_", " "),
      required: false,
    }));
  }
  return checklist.map((c) => {
    const value = DOC_TYPE_MAP[c.id] ?? "OTHER_DOCUMENT";
    return {
      value,
      label: c.label,
      required: c.required,
    };
  });
}
