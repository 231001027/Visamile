import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, UserRole } from "@/lib/session";
import { updateCaseStatusSchema } from "@/lib/validators";
import { assertValidTransition, InvalidTransitionError, STATUS_LABELS } from "@/lib/caseStateMachine";
import { refundCase } from "@/lib/ledger";
import { notify } from "@/lib/notify";

const PAID_STATUSES = new Set([
  "PAID",
  "UNDER_VERIFICATION",
  "SUBMITTED",
  "ADDITIONAL_DOCS_REQUESTED",
  "APPROVED",
]);

async function loadCaseForSession(
  id: string,
  session: { role: string; partnerId: string | null; sub: string }
) {
  const found = await prisma.case.findUnique({
    where: { id },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { id: true, companyName: true } },
      consumer: { select: { id: true, name: true, email: true } },
      assignedProcessor: { select: { id: true, name: true, email: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!found) return null;
  if (session.role === "PARTNER" && found.partnerId !== session.partnerId) return null;
  if (session.role === "CONSUMER" && found.consumerUserId !== session.sub) return null;
  if (session.role === "PROCESSOR") {
    const isAssigned = found.assignedProcessorId === session.sub;
    const isOpenQueue =
      !found.assignedProcessorId && found.status === "UNDER_VERIFICATION";
    if (!isAssigned && !isOpenQueue) return null;
  }
  return found;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const found = await loadCaseForSession(params.id, session);
  if (!found) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  return NextResponse.json({ case: found });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const existing = await loadCaseForSession(params.id, session);
  if (!existing) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateCaseStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { toStatus, note } = parsed.data;

  if (toStatus === "ADDITIONAL_DOCS_REQUESTED" && !note?.trim()) {
    return NextResponse.json(
      { error: "Specify which document type(s) the traveler must provide." },
      { status: 400 }
    );
  }

  const wasPaid = PAID_STATUSES.has(existing.status);

  // Friendlier message before state-machine ADMIN-only reject for paid cancels.
  if (toStatus === "CANCELLED" && wasPaid && session.role === "CONSUMER") {
    return NextResponse.json(
      {
        error:
          "Paid applications can only be cancelled by support. Contact Visamile ops for a refund review.",
      },
      { status: 403 }
    );
  }

  try {
    assertValidTransition(existing.status, toStatus, session.role as UserRole);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const timestamps: Record<string, Date> = {};
  if (toStatus === "SUBMITTED") timestamps.submittedAt = new Date();
  if (toStatus === "APPROVED" || toStatus === "REJECTED") timestamps.decidedAt = new Date();
  if (toStatus === "DELIVERED") timestamps.deliveredAt = new Date();

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { status: toStatus, ...timestamps };
      // Claim case when processor starts working an unassigned item
      if (
        session.role === "PROCESSOR" &&
        !existing.assignedProcessorId &&
        existing.status === "UNDER_VERIFICATION"
      ) {
        data.assignedProcessorId = session.sub;
      }
      // Optimistic lock on status — blocks concurrent cancel/refund races.
      const claimed = await tx.case.updateMany({
        where: { id: existing.id, status: existing.status },
        data,
      });
      if (claimed.count === 0) {
        throw new Error("CASE_STATUS_CONFLICT");
      }
      await tx.caseStatusEvent.create({
        data: {
          caseId: existing.id,
          fromStatus: existing.status,
          toStatus,
          note,
          actorUserId: session.sub,
        },
      });
      return tx.case.findUniqueOrThrow({ where: { id: existing.id } });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "CASE_STATUS_CONFLICT") {
      return NextResponse.json(
        { error: "Case was modified by another request. Refresh and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  if (toStatus === "CANCELLED" && wasPaid && existing.partnerId) {
    // Status is already CANCELLED — never turn a refund hiccup into a 500 for the client.
    try {
      await refundCase({
        caseId: existing.id,
        note: note ?? `Cancelled after payment: ${existing.referenceNo}`,
      });
    } catch (refundErr) {
      console.error("[cases] refund after cancel failed:", refundErr);
      if (process.env.OPS_ALERT_EMAIL) {
        await notify({
          partnerId: null,
          toEmail: process.env.OPS_ALERT_EMAIL,
          channel: "EMAIL",
          subject: `Refund failed after cancel: ${existing.referenceNo}`,
          body: `Case ${existing.referenceNo} was cancelled but the wallet refund failed. Retry refund manually.`,
        }).catch(() => null);
      }
    }
  } else if (toStatus === "CANCELLED" && wasPaid && existing.consumerUserId) {
    // Flag for ops — Stripe refunds are manual until a dedicated refund path exists.
    if (process.env.OPS_ALERT_EMAIL) {
      await notify({
        partnerId: null,
        toEmail: process.env.OPS_ALERT_EMAIL,
        channel: "EMAIL",
        subject: `Refund review needed: ${existing.referenceNo}`,
        body: `Consumer cancelled/requested cancel on paid case ${existing.referenceNo}. Review Stripe Checkout for a refund.`,
      }).catch(() => null);
    }
  }

  // Never fail the status change if notification delivery hiccups.
  if (existing.partnerId) {
    await notify({
      partnerId: existing.partnerId,
      channel: "EMAIL",
      subject: `Case ${existing.referenceNo}: ${STATUS_LABELS[toStatus]}`,
      body: note ?? `Status changed from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[toStatus]}.`,
    }).catch(() => null);
  } else if (existing.consumer?.email) {
    await notify({
      partnerId: null,
      toEmail: existing.consumer.email,
      channel: "EMAIL",
      subject: `Case ${existing.referenceNo}: ${STATUS_LABELS[toStatus]}`,
      body: note ?? `Status changed from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[toStatus]}.`,
    }).catch(() => null);
  }

  return NextResponse.json({ case: updated });
}
