import crypto from "crypto";
import { calculateTopupFee, PaymentMethod } from "./paymentFees";

/**
 * Wallet top-ups hand off to a payment gateway (PayU, per the reference
 * platform) and come back through a server-to-server callback. Two
 * implementations of the same interface:
 *
 *  - PayUGateway: real PayU hosted-checkout integration (hash-signed form
 *    POST redirect, per PayU's standard checkout API). Needs
 *    PAYMENT_GATEWAY_KEY / PAYMENT_GATEWAY_SECRET in .env.
 *  - DevInstantGateway: no external call at all — used when those env vars
 *    aren't set, so the app runs end-to-end without real credentials. It
 *    is NOT wired to a real callback signature check; never enable it
 *    outside local development.
 *
 * Whichever is active, the callers (src/app/api/wallet/route.ts and
 * src/app/api/payments/pay-cases-online/route.ts) only
 * ever talks to this interface — swapping providers means writing a third
 * class here, not touching the route.
 */

export interface CheckoutParams {
  orderId: string; // our WalletTopupOrder.id
  amount: number; // the requested recharge amount (before gateway fee)
  method: PaymentMethod;
  partnerEmail: string;
  partnerName: string;
}

export interface CheckoutResult {
  /** Where to send the browser to complete payment. Dev gateway returns an internal route that auto-completes. */
  redirectUrl: string;
  gatewayTxnId: string;
  totalPayable: number;
}

export interface PaymentGatewayAdapter {
  createTopupCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** Verifies a callback's signature. Throws if it doesn't match. */
  verifyCallback(payload: Record<string, string>): void;
}

// ---------------- PayU ----------------

const PAYU_BASE_URL = "https://secure.payu.in/_payment"; // test: https://sandboxsecure.payu.in/_payment

class PayUGateway implements PaymentGatewayAdapter {
  private key = process.env.PAYMENT_GATEWAY_KEY!;
  private salt = process.env.PAYMENT_GATEWAY_SECRET!;

  async createTopupCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const fee = calculateTopupFee(params.amount, params.method);
    const txnid = params.orderId;
    // PayU's hash formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||salt)
    const productinfo = "Wallet top-up";
    const firstname = params.partnerName;
    const hashString = [
      this.key,
      txnid,
      fee.totalPayable.toFixed(2),
      productinfo,
      firstname,
      params.partnerEmail,
      "", "", "", "", "", "", "", "", "", // udf1-5 + 5 reserved blanks per PayU spec
      this.salt,
    ].join("|");
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    return {
      redirectUrl: `/partner/wallet/payu-checkout?orderId=${params.orderId}`,
      gatewayTxnId: txnid,
      totalPayable: fee.totalPayable,
    };
  }

  verifyCallback(payload: Record<string, string>): void {
    // Reverse hash formula: sha512(salt|status|||||||||||email|firstname|productinfo|amount|txnid|key)
    const { status, email, firstname, productinfo, amount, txnid, hash } = payload;
    const expected = crypto
      .createHash("sha512")
      .update(
        [this.salt, status, "", "", "", "", "", "", "", "", "", email, firstname, productinfo, amount, txnid, this.key].join(
          "|"
        )
      )
      .digest("hex");
    if (expected !== hash) {
      throw new Error("PayU callback hash mismatch — possible tampering, rejecting.");
    }
  }
}

// ---------------- Dev stub ----------------

class DevInstantGateway implements PaymentGatewayAdapter {
  async createTopupCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const fee = calculateTopupFee(params.amount, params.method);
    return {
      redirectUrl: `/partner/wallet/dev-checkout?orderId=${params.orderId}`,
      gatewayTxnId: `dev_${params.orderId}`,
      totalPayable: fee.totalPayable,
    };
  }
  verifyCallback(): void {
    // Dev stub trusts the caller — see the loud warnings on the route that
    // uses this, and never enable this adapter outside local development.
  }
}

export const paymentGateway: PaymentGatewayAdapter =
  process.env.PAYMENT_GATEWAY_KEY && process.env.PAYMENT_GATEWAY_SECRET
    ? new PayUGateway()
    : new DevInstantGateway();

export const isUsingRealGateway = Boolean(
  process.env.PAYMENT_GATEWAY_KEY && process.env.PAYMENT_GATEWAY_SECRET
);
