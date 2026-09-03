import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { walletTopupSchema } from "@/lib/validators";
import { paymentGateway, isUsingRealGateway } from "@/lib/payment";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Only partner users have a wallet." }, { status: 403 });
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { partnerId: session.partnerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { case: { select: { referenceNo: true } } },
  });

  const balance = transactions[0]?.balanceAfter ?? 0;
  return NextResponse.json({ balance, transactions });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Only partner users have a wallet." }, { status: 403 });
  }
  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: session.partnerId } });

  const body = await req.json().catch(() => null);
  const parsed = walletTopupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { amount, method } = parsed.data;

  // Create the pending order first so we have an id to hand the gateway as
  // the transaction reference, then ask the gateway to price it (its fee +
  // GST depend on the chosen method — see src/lib/paymentFees.ts) and tell
  // us where to send the browser.
  const order = await prisma.walletTopupOrder.create({
    data: {
      partnerId: partner.id,
      purpose: "WALLET_TOPUP",
      amount,
      paymentMethod: method,
      status: "PENDING",
      createdByUserId: session.sub,
    },
  });

  const checkout = await paymentGateway.createTopupCheckout({
    orderId: order.id,
    amount,
    method,
    partnerEmail: partner.contactEmail,
    partnerName: partner.companyName,
  });

  await prisma.walletTopupOrder.update({
    where: { id: order.id },
    data: {
      gatewayTxnId: checkout.gatewayTxnId,
      totalPayable: checkout.totalPayable,
      gatewayFee: checkout.totalPayable - amount, // fee + GST combined; split stored precisely in paymentFees calc if needed later
    },
  });

  return NextResponse.json({
    orderId: order.id,
    redirectUrl: checkout.redirectUrl,
    totalPayable: checkout.totalPayable,
    usingRealGateway: isUsingRealGateway,
  });
}
