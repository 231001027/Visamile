import Stripe from "stripe";

/**
 * Stripe is the only payment gateway in the app. Every paid flow (partner
 * wallet top-up, partner "pay online now", traveler case payment) creates a
 * PENDING WalletTopupOrder, hands the browser to a Stripe Checkout Session,
 * and is only ever marked SUCCESS from the signed webhook at
 * src/app/api/payments/stripe/webhook/route.ts — never from a client call.
 *
 * Stripe collects the payment method (card / UPI / netbanking, depending on
 * what is enabled on the Stripe account), so the app no longer asks the user
 * to pick one up front.
 */

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      "Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) before taking payments."
    );
    this.name = "StripeNotConfiguredError";
  }
}

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazily built so a missing key surfaces as a handled error, not a boot crash. */
export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new StripeNotConfiguredError();
  if (!client) {
    client = new Stripe(secretKey, { typescript: true });
  }
  return client;
}

/** Currencies Stripe expects without a minor unit (¥100 is amount 100, not 10000). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function toMinorUnits(amount: number, currency: string): number {
  const code = currency.toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

export function appBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface CheckoutParams {
  /** Our WalletTopupOrder.id — echoed back on the webhook to settle the order. */
  orderId: string;
  /** Amount in major units (e.g. rupees), as stored on the order. */
  amount: number;
  currency?: string;
  /** Line-item name shown on the Stripe Checkout page. */
  description: string;
  customerEmail: string;
  /** Path the browser returns to after Stripe, e.g. "/pay/result". */
  returnPath: string;
}

export interface CheckoutResult {
  /** Absolute Stripe-hosted Checkout URL. */
  redirectUrl: string;
  /** Stripe Checkout Session id, stored as the order's gateway reference. */
  gatewayTxnId: string;
  /** What the customer will be charged. Stripe fees are borne by the merchant. */
  totalPayable: number;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const stripe = getStripe();
  const currency = (params.currency || "INR").toLowerCase();
  const base = appBaseUrl();
  const returnUrl = `${base}${params.returnPath}?orderId=${encodeURIComponent(params.orderId)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Stripe only allows methods enabled on the account; letting Stripe decide
    // means UPI/netbanking show up automatically once activated.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: toMinorUnits(params.amount, currency),
          product_data: { name: params.description },
        },
      },
    ],
    customer_email: params.customerEmail,
    client_reference_id: params.orderId,
    metadata: { orderId: params.orderId },
    payment_intent_data: { metadata: { orderId: params.orderId } },
    success_url: `${returnUrl}&status=success`,
    cancel_url: `${returnUrl}&status=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL for this order.");
  }

  return {
    redirectUrl: session.url,
    gatewayTxnId: session.id,
    totalPayable: params.amount,
  };
}
