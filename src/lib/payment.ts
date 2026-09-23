import {
  createCheckoutSession,
  isStripeConfigured,
  StripeNotConfiguredError,
  type CheckoutParams as StripeCheckoutParams,
  type CheckoutResult,
} from "./stripe";

/**
 * Thin payment facade. All paid flows go through Stripe Checkout;
 * settlement happens only in the signed Stripe webhook.
 */

export type { CheckoutResult };

export interface CheckoutParams {
  orderId: string;
  amount: number;
  currency?: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  /** Override return path; defaults to /pay/result */
  returnPath?: string;
}

export async function createTopupCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  if (!isStripeConfigured()) throw new StripeNotConfiguredError();

  const stripeParams: StripeCheckoutParams = {
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency || "INR",
    description: params.description,
    customerEmail: params.customerEmail,
    returnPath: params.returnPath || "/pay/result",
  };

  return createCheckoutSession(stripeParams);
}

/** @deprecated Use createTopupCheckout — kept so older import sites compile during cutover. */
export const paymentGateway = {
  createTopupCheckout,
};

export const isUsingRealGateway = isStripeConfigured;
export { isStripeConfigured, StripeNotConfiguredError };
