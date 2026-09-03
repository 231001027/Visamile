import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { applyPaymentOrder } from "@/lib/ledger";
import { isUsingRealGateway } from "@/lib/payment";
import { z } from "zod";

const schema = z.object({ orderId: z.string().min(1) });

// DEV-ONLY. When PAYMENT_GATEWAY_KEY/SECRET are set (a real PayU
// integration is configured), this route refuses to run — real payments
// must only ever be confirmed by the signed webhook at
// /api/payments/callback, never by a client-triggered "mark this paid"
// call like this one.
export async function POST(req: NextRequest) {
  if (isUsingRealGateway) {
    return NextResponse.json(
      { error: "A real payment gateway is configured; this dev-only route is disabled." },
      { status: 403 }
    );
  }

  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: parsed.data.orderId } });
  if (!order || order.partnerId !== session.partnerId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const result = await applyPaymentOrder(order.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
