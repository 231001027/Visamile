import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { payCasesOnlineSchema } from "@/lib/validators";
import { paymentGateway } from "@/lib/payment";

/**
 * "Pay online now" — the second half of the hybrid payment model. Unlike
 * POST /api/wallet/pay-cases (which spends existing wallet balance), this
 * doesn't touch the wallet balance at all up front: it charges the agent
 * directly for exactly this batch of cases via PayU, and only on a
 * confirmed payment does src/lib/ledger.ts `applyPaymentOrder` mark them
 * PAID (crediting then immediately spending the same amount, so the
 * ledger still shows a clean per-case DEBIT either way).
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
  const { caseIds, method } = parsed.data;

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
      paymentMethod: method,
      status: "PENDING",
      createdByUserId: session.sub,
    },
  });

  const checkout = await paymentGateway.createTopupCheckout({
    orderId: order.id,
    amount: total,
    method,
    partnerEmail: partner.contactEmail,
    partnerName: partner.companyName,
  });

  await prisma.walletTopupOrder.update({
    where: { id: order.id },
    data: { gatewayTxnId: checkout.gatewayTxnId, totalPayable: checkout.totalPayable, gatewayFee: checkout.totalPayable - total },
  });

  return NextResponse.json({ orderId: order.id, redirectUrl: checkout.redirectUrl, totalPayable: checkout.totalPayable });
}
