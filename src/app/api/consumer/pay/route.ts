import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { payCasesOnlineSchema } from "@/lib/validators";
import { paymentGateway } from "@/lib/payment";
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

  const cases = await prisma.case.findMany({
    where: {
      id: { in: parsed.data.caseIds },
      consumerUserId: session.sub,
      status: "PENDING_PAYMENT",
    },
    include: {
      documents: { select: { type: true } },
      visaType: { select: { documentChecklist: true } },
    },
  });
  if (cases.length !== parsed.data.caseIds.length) {
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
      paymentMethod: parsed.data.method,
      totalPayable: total,
      createdByUserId: session.sub,
    },
  });

  const checkout = await paymentGateway.createTopupCheckout({
    orderId: order.id,
    amount: total,
    method: parsed.data.method,
    partnerEmail: session.email,
    partnerName: session.name,
  });

  return NextResponse.json({
    orderId: order.id,
    redirectUrl: checkout.redirectUrl,
    totalPayable: checkout.totalPayable,
  });
}
