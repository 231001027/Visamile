import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { applyPaymentOrder } from "@/lib/ledger";
import { z } from "zod";

const schema = z.object({ orderId: z.string().min(1) });

/**
 * Completes traveler demo checkout. Allowed even when PayU keys are set,
 * so demos work without a real gateway charge.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "orderId is required." }, { status: 400 });

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: parsed.data.orderId } });
  if (!order || order.consumerUserId !== session.sub) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.purpose !== "CASE_PAYMENT") {
    return NextResponse.json({ error: "This order cannot use demo checkout." }, { status: 400 });
  }

  try {
    const result = await applyPaymentOrder(order.id);
    const caseIds = (order.caseIds as string[] | null) ?? [];
    const redirectTo =
      caseIds.length === 1 ? `/consumer/cases/${caseIds[0]}` : "/consumer/dashboard";
    return NextResponse.json({ ok: true, ...result, redirectTo });
  } catch (err) {
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
