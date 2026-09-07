import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { applyPaymentOrder } from "@/lib/ledger";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["success", "failed"]),
  method: z.enum(["UPI", "CARD", "CHEQUE"]),
});

/**
 * Completes traveler demo checkout. Allowed even when PayU keys are set,
 * so demos work without a real gateway charge.
 * Does not persist card/UPI/cheque numbers — only method + outcome.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }

  const { orderId, outcome, method } = parsed.data;

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order || order.consumerUserId !== session.sub) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.purpose !== "CASE_PAYMENT") {
    return NextResponse.json({ error: "This order cannot use demo checkout." }, { status: 400 });
  }
  if (order.status === "SUCCESS" || order.status === "FAILED") {
    return NextResponse.json(
      {
        error: "This payment was already completed.",
        redirectTo: `/pay/demo-result?orderId=${order.id}&status=${order.status === "SUCCESS" ? "success" : "failed"}`,
      },
      { status: 409 }
    );
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Order is not payable." }, { status: 409 });
  }

  const resultPath = `/pay/demo-result?orderId=${order.id}&status=${outcome}`;

  if (outcome === "failed") {
    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        paymentMethod: method,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, outcome: "failed", redirectTo: resultPath });
  }

  try {
    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: { paymentMethod: method },
    });
    const result = await applyPaymentOrder(order.id);
    return NextResponse.json({ ok: true, outcome: "success", ...result, redirectTo: resultPath });
  } catch (err) {
    if (err instanceof Error) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
