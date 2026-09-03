"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaseStatus } from "@prisma/client";

const LABELS: Partial<Record<CaseStatus, string>> = {
  PENDING_PAYMENT: "Send back to editing",
  PAID: "Mark paid", // rarely used directly — normal path is the Pending Payment batch-pay action
  SUBMITTED: "Mark submitted to embassy",
  ADDITIONAL_DOCS_REQUESTED: "Request additional documents",
  APPROVED: "Mark approved",
  REJECTED: "Mark rejected",
  DELIVERED: "Mark delivered to partner",
  CANCELLED: "Cancel case",
  DRAFT: "Send back to editing",
};

export function CaseStatusActions({ caseId, options }: { caseId: string; options: CaseStatus[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<CaseStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(toStatus: CaseStatus) {
    setError(null);
    setPending(toStatus);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update status.");
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((status) => (
        <button
          key={status}
          onClick={() => transition(status)}
          disabled={pending !== null}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            status === "REJECTED" || status === "CANCELLED"
              ? "border border-danger text-danger hover:bg-danger/5"
              : "bg-teal-500 text-paper hover:bg-teal-600"
          }`}
        >
          {pending === status ? "Updating…" : LABELS[status] ?? status}
        </button>
      ))}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
