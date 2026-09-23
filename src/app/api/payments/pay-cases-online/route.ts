import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { payCasesOnlineSchema } from "@/lib/validators";
import { createTopupCheckout, StripeNotConfiguredError } from "@/lib/payment";

/**
 * Partner "Pay online now" — charges via Stripe Checkout for the selected
 * PENDING_PAYMENT cases. Settlement (mark PAID + ledger) happens only in the
 * Stripe webhook via applyPaymentOrder.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Only partner users can pay cases." }, { status: 403 });
  }
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: session.partnerId } });

  const body = await req.json().catch(() => null);
  const parsed = payCasesOnlineSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { caseIds } = parsed.data;

  const cases = await prisma.case.findMany({ where: { id: { in: caseIds }, partnerId: partner.id } });
  if (cases.length !== caseIds.length) {
    return NextResponse.json({ error: "One or more selected cases could not be found." }, { status: 404 });
  }
  const ineligible = cases.find((c) => c.status !== "PENDING_PAYMENT");
  if (ineligible) {
    return NextResponse.json(
      { error: `Case ${ineligible.referenceNo} is not awaiting payment (status: ${ineligible.status}).` },
      { status: 409 }
    );
  }

  const total = cases.reduce((sum, c) => sum + Number(c.govFeeSnapshot) + Number(c.serviceFeeSnapshot), 0);

  const order = await prisma.walletTopupOrder.create({
    data: {
      partnerId: partner.id,
      purpose: "CASE_PAYMENT",
      amount: total,
      caseIds,
      paymentMethod: "STRIPE",
      status: "PENDING",
      createdByUserId: session.sub,
    },
  });

  try {
    const checkout = await createTopupCheckout({
      orderId: order.id,
      amount: total,
      description:
        cases.length === 1
          ? `Case payment — ${cases[0]!.referenceNo}`
          : `Case payment — ${cases.length} cases`,
      customerEmail: partner.contactEmail,
      customerName: partner.companyName,
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
