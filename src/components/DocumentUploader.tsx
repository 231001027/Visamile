"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ChecklistItem = { id: string; label: string; required: boolean };

const DOC_TYPE_MAP: Record<string, string> = {
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

const FALLBACK_TYPES = Object.values(DOC_TYPE_MAP);

export function DocumentUploader({
  caseId,
  checklist,
  uploadedTypes = [],
}: {
  caseId: string;
  checklist?: ChecklistItem[];
  uploadedTypes?: string[];
}) {
  const router = useRouter();
  const items =
    checklist && checklist.length > 0
      ? checklist.map((c) => ({
          value: DOC_TYPE_MAP[c.id] ?? "OTHER_DOCUMENT",
          label: c.label,
          required: c.required,
          uploaded: uploadedTypes.includes(DOC_TYPE_MAP[c.id] ?? ""),
        }))
      : FALLBACK_TYPES.map((v) => ({ value: v, label: v.replaceAll("_", " "), required: false, uploaded: uploadedTypes.includes(v) }));

  const [type, setType] = useState(items[0]?.value ?? "OTHER_DOCUMENT");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }
      setFile(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {checklist && checklist.length > 0 && (
        <ul className="space-y-1 rounded-sm border border-line bg-white p-4 text-sm">
          {items.map((item) => (
            <li key={item.value} className="flex items-center justify-between">
              <span>
                {item.label}
                {item.required && <span className="ml-1 text-danger">*</span>}
              </span>
              <span className={item.uploaded ? "text-teal-600" : "text-ink/40"}>
                {item.uploaded ? "Uploaded" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 rounded-sm border border-dashed border-line bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-ink/70">Document type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input mt-1 !py-1.5 text-sm">
            {items.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70">File (PDF/PNG/JPEG, max 10 MB)</label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 text-sm" />
        </div>
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>
    </div>
  );
}
