import { CaseStatus } from "@prisma/client";

/**
 * Explicit finite-state machine for a visa case — revised against the real
 * reference platform's flow. The key correction from the first pass: a case
 * is NOT paid for at creation. It moves to PENDING_PAYMENT once the agent
 * has filled in applicant details and documents, sits in the Pending
 * Payment queue, and only becomes PAID once the agent batch-pays it (see
 * src/lib/ledger.ts `payCasesFromWallet`). Ops only ever works PAID cases.
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "DRAFT", "CANCELLED"],
  PAID: ["SUBMITTED", "CANCELLED"], // cancelling here must trigger a refund — see ledger.ts
  SUBMITTED: ["ADDITIONAL_DOCS_REQUESTED", "APPROVED", "REJECTED", "CANCELLED"],
  ADDITIONAL_DOCS_REQUESTED: ["SUBMITTED", "CANCELLED"],
  APPROVED: ["DELIVERED"],
  REJECTED: [], // terminal
  DELIVERED: [], // terminal
  CANCELLED: [], // terminal
};

// Which roles may perform which transitions. Note PENDING_PAYMENT->PAID is
// deliberately absent here: that transition only ever happens through the
// dedicated wallet-payment endpoint, never a generic status PATCH, because
// it has to happen inside the same DB transaction as the wallet debit.
export const TRANSITION_ACTOR: Record<string, "PARTNER" | "ADMIN" | "ANY"> = {
  "DRAFT->PENDING_PAYMENT": "PARTNER",
  "DRAFT->CANCELLED": "PARTNER",
  "PENDING_PAYMENT->DRAFT": "PARTNER", // agent pulls a case back to edit before paying
  "PENDING_PAYMENT->CANCELLED": "PARTNER",
  "PAID->CANCELLED": "ADMIN", // post-payment cancellation triggers a refund
  "SUBMITTED->ADDITIONAL_DOCS_REQUESTED": "ADMIN",
  "SUBMITTED->APPROVED": "ADMIN",
  "SUBMITTED->REJECTED": "ADMIN",
  "SUBMITTED->CANCELLED": "ADMIN",
  "ADDITIONAL_DOCS_REQUESTED->SUBMITTED": "ADMIN",
  "ADDITIONAL_DOCS_REQUESTED->CANCELLED": "PARTNER",
  "APPROVED->DELIVERED": "ADMIN",
};

// Transitions that must trigger a wallet refund alongside the status
// change, because money already left the wallet for this case (PAID or
// later). Used by the case PATCH route to decide whether to also call
// appendWalletTransaction(REFUND).
export const REFUND_ON_TRANSITION = new Set<CaseStatus>(["CANCELLED"]);

export class InvalidTransitionError extends Error {}

export function assertValidTransition(
  from: CaseStatus,
  to: CaseStatus,
  actorRole: "PARTNER" | "ADMIN"
) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(`Cannot move a case from ${from} to ${to}.`);
  }
  const requiredActor = TRANSITION_ACTOR[`${from}->${to}`];
  if (requiredActor && requiredActor !== "ANY" && requiredActor !== actorRole) {
    throw new InvalidTransitionError(
      `Only ${requiredActor.toLowerCase()} users can move a case from ${from} to ${to}.`
    );
  }
}

/** Which target statuses the given role may move this case to right now via the generic PATCH route. */
export function getAllowedTransitionsForRole(
  from: CaseStatus,
  role: "PARTNER" | "ADMIN"
): CaseStatus[] {
  const candidates = ALLOWED_TRANSITIONS[from] ?? [];
  return candidates.filter((to) => {
    const requiredActor = TRANSITION_ACTOR[`${from}->${to}`];
    return !requiredActor || requiredActor === "ANY" || requiredActor === role;
  });
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid — queued for submission",
  SUBMITTED: "Submitted to embassy",
  ADDITIONAL_DOCS_REQUESTED: "Additional documents requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
