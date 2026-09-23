"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaseStatus } from "@prisma/client";

const LABELS: Partial<Record<CaseStatus, string>> = {
  PENDING_PAYMENT: "Send back to editing",
  PAID: "Mark paid",
  UNDER_VERIFICATION: "Return to verification",
  SUBMITTED: "Mark sent to embassy",
  ADDITIONAL_DOCS_REQUESTED: "Request additional documents",
  APPROVED: "Mark approved (embassy)",
  REJECTED: "Mark rejected (embassy)",
  DELIVERED: "Mark delivered to applicant",
  CANCELLED: "Cancel case",
  DRAFT: "Send back to editing",
};

/** Common doc types the verifier can tap to fill the request note. */
const DOC_SUGGESTIONS = [
  "Passport front page",
  "Passport back page",
  "Photograph",
  "PAN card",
  "Travel history",
  "Invitation letter",
  "Identity proof",
  "Bank statement / financial docs",
  "Covering letter",
  "Employment proof",
];

export function CaseStatusActions({ caseId, options }: { caseId: string; options: CaseStatus[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<CaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docsNeeded, setDocsNeeded] = useState("");

  const canRequestDocs = options.includes("ADDITIONAL_DOCS_REQUESTED");

  async function transition(toStatus: CaseStatus) {
    setError(null);

    let note: string | undefined;
    if (toStatus === "ADDITIONAL_DOCS_REQUESTED") {
      const trimmed = docsNeeded.trim();
      if (!trimmed) {
        setError("Describe which document(s) the traveler must upload.");
        return;
      }
      note = `Documents required: ${trimmed}`;
    }

    setPending(toStatus);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update status.");
        return;
      }
      setDocsNeeded("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function appendSuggestion(label: string) {
    setDocsNeeded((prev) => {
      const next = prev.trim();
      if (!next) return label;
      if (next.toLowerCase().includes(label.toLowerCase())) return next;
      return `${next}; ${label}`;
    });
  }

  if (options.length === 0) return null;

  return (
    <div className="space-y-3">
      {canRequestDocs && (
        <div className="rounded-sm border border-line bg-white p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink/50">
            Document(s) needed from traveler
          </label>
          <textarea
            value={docsNeeded}
            onChange={(e) => setDocsNeeded(e.target.value)}
            rows={3}
            placeholder="e.g. Latest 6-month bank statement, and a clearer passport photo…"
            className="input mt-2 w-full text-sm"
            disabled={pending !== null}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DOC_SUGGESTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => appendSuggestion(label)}
                disabled={pending !== null}
                className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink/70 hover:bg-ink/[0.03] disabled:opacity-50"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {options.map((status) => (
          <button
            key={status}
            onClick={() => transition(status)}
            disabled={
              pending !== null ||
              (status === "ADDITIONAL_DOCS_REQUESTED" && !docsNeeded.trim())
            }
            className={`rounded-sm px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
              status === "REJECTED" || status === "CANCELLED"
                ? "border border-danger text-danger hover:bg-danger/5"
                : status === "ADDITIONAL_DOCS_REQUESTED"
                  ? "border border-stamp-500 bg-stamp-400/15 text-stamp-700 hover:bg-stamp-400/25"
                  : "bg-teal-500 text-paper hover:bg-teal-600"
            }`}
          >
            {pending === status ? "Updating…" : LABELS[status] ?? status}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
