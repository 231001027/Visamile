import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, homeForRole } from "@/lib/session";
import { applyPaymentOrder } from "@/lib/ledger";
import { isUsingRealGateway } from "@/lib/payment";
import { z } from "zod";

const schema = z.object({ orderId: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (isUsingRealGateway) {
    return NextResponse.json(
      { error: "A real payment gateway is configured; this dev-only route is disabled." },
      { status: 403 }
    );
  }

  const session = await getSession();
  if (!session || (session.role !== "PARTNER" && session.role !== "CONSUMER")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: parsed.data.orderId } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (session.role === "PARTNER" && order.partnerId !== session.partnerId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (session.role === "CONSUMER" && order.consumerUserId !== session.sub) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const result = await applyPaymentOrder(order.id);
    return NextResponse.json({
      ok: true,
      ...result,
      redirectTo:
        session.role === "CONSUMER"
          ? "/consumer/dashboard"
          : result.purpose === "CASE_PAYMENT"
            ? "/partner/dashboard"
            : "/partner/wallet",
      home: homeForRole(session.role),
    });
  } catch (err) {
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
