import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { applyPaymentOrder } from "@/lib/ledger";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Stripe posts here after a Checkout Session settles. This is the ONLY place
 * a payment is ever applied — a client-side "it worked" call can be forged,
 * so /pay/result only ever *reads* the order status this route wrote.
 *
 * Signature verification needs the byte-exact request body, hence req.text()
 * rather than req.json(), and the Node runtime rather than edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function orderIdFrom(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.orderId || session.client_reference_id || null;
}

/** e.g. ["card"] -> "CARD". Stripe owns method selection now, so we just record it. */
function methodLabel(session: Stripe.Checkout.Session): string | null {
  const type = session.payment_method_types?.[0];
  return type ? type.toUpperCase() : null;
}

async function markFailed(orderId: string, session: Stripe.Checkout.Session) {
  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING") return;
  await prisma.walletTopupOrder.update({
    where: { id: order.id },
    data: {
      status: "FAILED",
      paymentMethod: methodLabel(session) ?? order.paymentMethod,
      completedAt: new Date(),
    },
  });
}

async function markPaid(orderId: string, session: Stripe.Checkout.Session) {
  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    console.error(`[stripe-webhook] Unknown order ${orderId} for session ${session.id}.`);
    return;
  }
  if (order.status !== "PENDING") return; // Stripe retries are expected; stay idempotent.

  await prisma.walletTopupOrder.update({
    where: { id: order.id },
    data: {
      paymentMethod: methodLabel(session) ?? order.paymentMethod,
      gatewayTxnId: session.id,
      totalPayable: (session.amount_total ?? 0) / 100,
    },
  });
  await applyPaymentOrder(order.id);
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhooks are not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error(`[stripe-webhook] Signature verification failed: ${reason}`);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = orderIdFrom(session);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (!orderId) break;
        // Async methods (UPI mandates, bank debits) complete "unpaid" and
        // settle later via async_payment_succeeded — don't credit yet.
        if (session.payment_status === "paid") await markPaid(orderId, session);
        break;

      case "checkout.session.async_payment_succeeded":
        if (orderId) await markPaid(orderId, session);
        break;

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        if (orderId) await markFailed(orderId, session);
        break;

      default:
        break;
    }
  } catch (err) {
    // Returning 5xx makes Stripe retry, which is what we want for a transient
    // DB failure — the order stays PENDING and visible until it lands.
    console.error(`[stripe-webhook] Failed handling ${event.type} for order ${orderId}:`, err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
