/** Shared checklist id → DocumentType enum mapping. */
export const DOC_TYPE_MAP: Record<string, string> = {
  passport_front: "PASSPORT_FRONT_PAGE",
  passport_back: "PASSPORT_BACK_PAGE",
  photograph: "PHOTOGRAPH",
  pan_card: "PAN_CARD",
  travel_history: "TRAVEL_HISTORY",
  invitation_docs: "INVITATION_DOCS",
  identity_proof: "IDENTITY_PROOF",
  legal_document: "LEGAL_DOCUMENT",
  personal_financial: "PERSONAL_FINANCIAL_DOCS",
  government_employee: "GOVERNMENT_EMPLOYEE_DOCS",
  salaried_employee: "SALARIED_EMPLOYEE_DOCS",
  business_owner: "BUSINESS_OWNER_DOCS",
  professional: "PROFESSIONAL_DOCS",
  student_with_parents: "STUDENT_WITH_PARENTS_DOCS",
  student_without_parents: "STUDENT_WITHOUT_PARENTS_DOCS",
  covering_letter: "COVERING_LETTER",
  other: "OTHER_DOCUMENT",
};

export type ChecklistItem = { id: string; label: string; required: boolean };

/** True when every required checklist item has a matching uploaded document type. */
export function areRequiredDocumentsUploaded(
  checklist: ChecklistItem[] | null | undefined,
  uploadedTypes: string[]
): boolean {
  if (!checklist || checklist.length === 0) {
    // No checklist configured — require at least one document before payment.
    return uploadedTypes.length > 0;
  }
  const required = checklist.filter((c) => c.required);
  if (required.length === 0) return uploadedTypes.length > 0;
  return required.every((item) => {
    const mapped = DOC_TYPE_MAP[item.id] ?? "OTHER_DOCUMENT";
    return uploadedTypes.includes(mapped);
  });
}
