import { CaseStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/caseStateMachine";

const STYLES: Record<CaseStatus, string> = {
  DRAFT: "border-ink/30 text-ink/60",
  PENDING_PAYMENT: "border-stamp-500 text-stamp-600",
  PAID: "border-teal-500 text-teal-600",
  SUBMITTED: "border-teal-500 text-teal-600",
  ADDITIONAL_DOCS_REQUESTED: "border-stamp-500 text-stamp-600",
  APPROVED: "border-teal-600 text-teal-700",
  DELIVERED: "border-teal-700 text-teal-700",
  REJECTED: "border-danger text-danger",
  CANCELLED: "border-ink/30 text-ink/40",
};

/**
 * Status shown as a passport-stamp motif: a double ring, slight rotation,
 * uppercase small caps — the one deliberate visual flourish in the app,
 * used consistently everywhere a case status appears.
 */
export function StatusStamp({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex -rotate-2 items-center justify-center rounded-sm border-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STYLES[status]}`}
      style={{ boxShadow: "inset 0 0 0 2px currentColor" }}
    >
      <span className="opacity-70">•</span>
      <span className="mx-1">{STATUS_LABELS[status]}</span>
      <span className="opacity-70">•</span>
    </span>
  );
}
