import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { updateCaseStatusSchema } from "@/lib/validators";
import { assertValidTransition, InvalidTransitionError, STATUS_LABELS } from "@/lib/caseStateMachine";
import { refundCase } from "@/lib/ledger";
import { notify } from "@/lib/notify";

const PAID_STATUSES = new Set(["PAID", "SUBMITTED", "ADDITIONAL_DOCS_REQUESTED"]);

async function loadCaseForSession(id: string, session: { role: string; partnerId: string | null }) {
  const found = await prisma.case.findUnique({
    where: { id },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { id: true, companyName: true } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!found) return null;
  if (session.role === "PARTNER" && found.partnerId !== session.partnerId) return null;
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

  try {
    assertValidTransition(existing.status, toStatus, session.role as "PARTNER" | "ADMIN");
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

  const wasPaid = PAID_STATUSES.has(existing.status);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCase = await tx.case.update({
      where: { id: existing.id },
      data: { status: toStatus, ...timestamps },
    });
    await tx.caseStatusEvent.create({
      data: {
        caseId: existing.id,
        fromStatus: existing.status,
        toStatus,
        note,
        actorUserId: session.sub,
      },
    });
    return updatedCase;
  });

  // Cancelling a case that money had already been taken for (PAID or
  // later) must hand that money back — see src/lib/caseStateMachine.ts
  // REFUND_ON_TRANSITION for the rule this implements.
  if (toStatus === "CANCELLED" && wasPaid) {
    await refundCase({ caseId: existing.id, note: note ?? `Cancelled after payment: ${existing.referenceNo}` });
  }

  await notify({
    partnerId: existing.partnerId,
    channel: "EMAIL",
    subject: `Case ${existing.referenceNo}: ${STATUS_LABELS[toStatus]}`,
    body: note ?? `Status changed from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[toStatus]}.`,
  });

  return NextResponse.json({ case: updated });
}
