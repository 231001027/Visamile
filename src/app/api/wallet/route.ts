import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { walletTopupSchema } from "@/lib/validators";
import { createTopupCheckout, StripeNotConfiguredError } from "@/lib/payment";

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

  try {
    const checkout = await createTopupCheckout({
      orderId: order.id,
      amount,
      description: `Wallet top-up — ${partner.companyName}`,
      customerEmail: partner.contactEmail,
      customerName: partner.companyName,
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
