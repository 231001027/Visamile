"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { type ChecklistItem, areRequiredDocumentsUploaded } from "@/lib/documentChecklist";
import {
  allDocumentTypeOptions,
  checklistTypeOptions,
  documentTypesFromRequestNote,
} from "@/lib/documentTypes";

export function DocumentUploader({
  caseId,
  checklist,
  uploadedTypes = [],
  /** When true, completing the last required doc starts the payment redirect. */
  redirectToPaymentWhenComplete = false,
  /**
   * Additional-docs mode: dropdown prioritizes types from the verifier note
   * and includes the full document catalog (PAN, employment, etc.).
   */
  mode = "checklist",
  requestedNote = null,
}: {
  caseId: string;
  checklist?: ChecklistItem[];
  uploadedTypes?: string[];
  redirectToPaymentWhenComplete?: boolean;
  mode?: "checklist" | "additional";
  requestedNote?: string | null;
}) {
  const router = useRouter();

  const requested = useMemo(
    () => documentTypesFromRequestNote(requestedNote),
    [requestedNote]
  );

  const items = useMemo(() => {
    if (mode === "additional") {
      const catalog = allDocumentTypeOptions();
      const byValue = new Map(catalog.map((o) => [o.value, o]));
      const ordered: { value: string; label: string; required: boolean; uploaded: boolean }[] = [];
      const seen = new Set<string>();

      for (const r of requested) {
        if (seen.has(r.value)) continue;
        seen.add(r.value);
        ordered.push({
          value: r.value,
          label: r.label,
          required: true,
          uploaded: uploadedTypes.includes(r.value),
        });
      }
      for (const o of catalog) {
        if (seen.has(o.value)) continue;
        seen.add(o.value);
        ordered.push({
          value: o.value,
          label: byValue.get(o.value)?.label ?? o.label,
          required: false,
          uploaded: uploadedTypes.includes(o.value),
        });
      }
      return ordered;
    }

    return checklistTypeOptions(checklist).map((o) => ({
      ...o,
      uploaded: uploadedTypes.includes(o.value),
    }));
  }, [mode, checklist, requested, uploadedTypes]);

  const [type, setType] = useState(items[0]?.value ?? "OTHER_DOCUMENT");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);

  // Keep select in sync when switching into additional mode with new options
  const selectValue = items.some((i) => i.value === type) ? type : items[0]?.value ?? "OTHER_DOCUMENT";

  async function startPayment() {
    setStartingPayment(true);
    try {
      const res = await fetch("/api/consumer/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: [caseId], method: "UPI" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not start payment.");
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.refresh();
    } finally {
      setStartingPayment(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", selectValue);
      const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed.");
        return;
      }

      const nextUploaded = Array.from(new Set([...uploadedTypes, selectValue]));
      setFile(null);

      if (redirectToPaymentWhenComplete && areRequiredDocumentsUploaded(checklist, nextUploaded)) {
        await startPayment();
        return;
      }

      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  const showChecklistStatus = mode === "checklist" && checklist && checklist.length > 0;
  const showRequestedStatus = mode === "additional" && requested.length > 0;

  const checklistStatusItems = useMemo(() => {
    if (!showChecklistStatus) return [];
    return checklistTypeOptions(checklist).map((o) => ({
      ...o,
      uploaded: uploadedTypes.includes(o.value),
    }));
  }, [showChecklistStatus, checklist, uploadedTypes]);

  return (
    <div className="space-y-4">
      {showChecklistStatus && (
        <ul className="space-y-1 rounded-sm border border-line bg-white p-4 text-sm">
          {checklistStatusItems.map((item) => (
            <li key={`${item.value}-${item.label}`} className="flex items-center justify-between">
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

      {showRequestedStatus && (
        <ul className="space-y-1 rounded-sm border border-stamp-500/40 bg-stamp-400/10 p-4 text-sm">
          <li className="mb-2 text-xs font-medium uppercase tracking-wide text-stamp-600">
            Requested by verifier
          </li>
          {requested.map((item) => {
            const uploaded = uploadedTypes.includes(item.value);
            return (
              <li key={`${item.value}-${item.label}`} className="flex items-center justify-between">
                <span>
                  {item.label}
                  <span className="ml-1 text-danger">*</span>
                </span>
                <span className={uploaded ? "text-teal-600" : "text-stamp-600"}>
                  {uploaded ? "Uploaded" : "Needed"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={handleUpload}
        className="flex flex-wrap items-end gap-3 rounded-sm border border-dashed border-line bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-ink/70">Document type</label>
          <select
            value={selectValue}
            onChange={(e) => setType(e.target.value)}
            className="input mt-1 !py-1.5 text-sm"
          >
            {mode === "additional" && requested.length > 0 && (
              <optgroup label="Requested">
                {requested.map((t) => (
                  <option key={`req-${t.value}-${t.label}`} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={mode === "additional" ? "All document types" : "Checklist"}>
              {items
                .filter((t) => mode !== "additional" || !requested.some((r) => r.value === t.value))
                .map((t) => (
                  <option key={`${t.value}-${t.label}`} value={t.value}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70">File (PDF/PNG/JPEG, max 10 MB)</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={!file || uploading || startingPayment}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : startingPayment ? "Redirecting to payment…" : "Upload"}
        </button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>
    </div>
  );
}
