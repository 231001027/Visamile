import { CaseStatus } from "@prisma/client";

/**
 * Case lifecycle with Consumer / Partner / Processor / Admin roles.
 * Embassy has no login — processor marks SUBMITTED and records APPROVED/REJECTED.
 */
export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "DRAFT", "CANCELLED"],
  PAID: ["UNDER_VERIFICATION", "CANCELLED"],
  UNDER_VERIFICATION: ["ADDITIONAL_DOCS_REQUESTED", "SUBMITTED", "CANCELLED"],
  SUBMITTED: ["ADDITIONAL_DOCS_REQUESTED", "APPROVED", "REJECTED", "CANCELLED"],
  ADDITIONAL_DOCS_REQUESTED: ["UNDER_VERIFICATION", "CANCELLED"],
  APPROVED: ["DELIVERED"],
  REJECTED: [],
  DELIVERED: [],
  CANCELLED: [],
};

export type TransitionActor = "PARTNER" | "ADMIN" | "CONSUMER" | "PROCESSOR" | "ANY" | "SYSTEM";

export const TRANSITION_ACTOR: Record<string, TransitionActor> = {
  "DRAFT->PENDING_PAYMENT": "ANY",
  "DRAFT->CANCELLED": "ANY",
  "PENDING_PAYMENT->DRAFT": "ANY",
  "PENDING_PAYMENT->CANCELLED": "ANY",
  "PAID->UNDER_VERIFICATION": "SYSTEM",
  "PAID->CANCELLED": "ADMIN",
  "UNDER_VERIFICATION->ADDITIONAL_DOCS_REQUESTED": "PROCESSOR",
  "UNDER_VERIFICATION->SUBMITTED": "PROCESSOR",
  "UNDER_VERIFICATION->CANCELLED": "ADMIN",
  "SUBMITTED->ADDITIONAL_DOCS_REQUESTED": "PROCESSOR",
  "SUBMITTED->APPROVED": "PROCESSOR",
  "SUBMITTED->REJECTED": "PROCESSOR",
  "SUBMITTED->CANCELLED": "ADMIN",
  "ADDITIONAL_DOCS_REQUESTED->UNDER_VERIFICATION": "ANY",
  "ADDITIONAL_DOCS_REQUESTED->CANCELLED": "ANY",
  "APPROVED->DELIVERED": "ADMIN",
};

export const REFUND_ON_TRANSITION = new Set<CaseStatus>(["CANCELLED"]);

export class InvalidTransitionError extends Error {}

export function assertValidTransition(
  from: CaseStatus,
  to: CaseStatus,
  actorRole: "PARTNER" | "ADMIN" | "CONSUMER" | "PROCESSOR"
) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(`Cannot move a case from ${from} to ${to}.`);
  }
  const requiredActor = TRANSITION_ACTOR[`${from}->${to}`];
  if (
    requiredActor &&
    requiredActor !== "ANY" &&
    requiredActor !== "SYSTEM" &&
    requiredActor !== actorRole
  ) {
    throw new InvalidTransitionError(
      `Only ${requiredActor.toLowerCase()} users can move a case from ${from} to ${to}.`
    );
  }
}

export function getAllowedTransitionsForRole(
  from: CaseStatus,
  role: "PARTNER" | "ADMIN" | "CONSUMER" | "PROCESSOR"
): CaseStatus[] {
  const candidates = ALLOWED_TRANSITIONS[from] ?? [];
  return candidates.filter((to) => {
    const requiredActor = TRANSITION_ACTOR[`${from}->${to}`];
    if (!requiredActor || requiredActor === "ANY") return true;
    if (requiredActor === "SYSTEM") return false;
    return requiredActor === role;
  });
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  UNDER_VERIFICATION: "Under verification",
  SUBMITTED: "Submitted to embassy",
  ADDITIONAL_DOCS_REQUESTED: "Additional docs requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
