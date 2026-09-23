import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { payCasesOnlineSchema } from "@/lib/validators";
import { createTopupCheckout, StripeNotConfiguredError } from "@/lib/payment";
import { areRequiredDocumentsUploaded, type ChecklistItem } from "@/lib/documentChecklist";

/** Consumer pays PENDING_PAYMENT cases online after required documents are uploaded. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payCasesOnlineSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { caseIds, method } = parsed.data;

  const cases = await prisma.case.findMany({
    where: {
      id: { in: caseIds },
      consumerUserId: session.sub,
      status: "PENDING_PAYMENT",
    },
    include: {
      documents: { select: { type: true } },
      visaType: { select: { documentChecklist: true } },
    },
  });
  if (cases.length !== caseIds.length) {
    return NextResponse.json({ error: "One or more cases are not payable." }, { status: 400 });
  }

  for (const kase of cases) {
    const checklist = kase.visaType.documentChecklist as ChecklistItem[] | null;
    const uploadedTypes = kase.documents.map((d) => d.type);
    if (!areRequiredDocumentsUploaded(checklist, uploadedTypes)) {
      return NextResponse.json(
        { error: `Upload all required documents for ${kase.referenceNo} before paying.` },
        { status: 400 }
      );
    }
  }

  const total = cases.reduce(
    (sum, c) => sum + Number(c.govFeeSnapshot) + Number(c.serviceFeeSnapshot),
    0
  );

  const order = await prisma.walletTopupOrder.create({
    data: {
      partnerId: null,
      consumerUserId: session.sub,
      purpose: "CASE_PAYMENT",
      amount: total,
      caseIds: cases.map((c) => c.id),
      paymentMethod: method,
      totalPayable: total,
      createdByUserId: session.sub,
    },
  });

  try {
    const checkout = await createTopupCheckout({
      orderId: order.id,
      amount: total,
      description:
        cases.length === 1
          ? `Visa payment — ${cases[0]!.referenceNo}`
          : `Visa payment — ${cases.length} cases`,
      customerEmail: session.email,
      customerName: session.name,
      method,
    });

    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: {
        gatewayTxnId: checkout.gatewayTxnId,
        totalPayable: checkout.totalPayable,
        gatewayFee: 0,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      redirectUrl: checkout.redirectUrl,
      totalPayable: checkout.totalPayable,
    });
  } catch (err) {
    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
