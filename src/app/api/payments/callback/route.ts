import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPaymentOrder } from "@/lib/ledger";
import { paymentGateway } from "@/lib/payment";

/**
 * PayU posts here (form-encoded) once a payment completes. This is the
 * ONLY place a real payment is ever applied — never trust a client-side
 * "payment succeeded" call, since that can be forged. The hash check in
 * paymentGateway.verifyCallback is what makes this safe to trust. Works
 * for both wallet top-ups and direct case payments — applyPaymentOrder
 * branches on the order's purpose.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) payload[key] = String(value);

  try {
    paymentGateway.verifyCallback(payload);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const orderId = payload.txnid;
  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  if (order.status !== "PENDING") return NextResponse.json({ ok: true, note: "Already processed." });

  if (payload.status === "success") {
    await applyPaymentOrder(order.id);
  } else {
    await prisma.walletTopupOrder.update({ where: { id: order.id }, data: { status: "FAILED", completedAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}
