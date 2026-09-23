/** App-level payment method labels stored on WalletTopupOrder.paymentMethod. */
export const ONLINE_PAYMENT_METHODS = [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "UPI",
  "NETBANKING",
  "CARD", // legacy
  "STRIPE",
] as const;
export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

export const CARD_PAYMENT_METHODS = ["CREDIT_CARD", "DEBIT_CARD"] as const;
export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];

/** Methods offered on partner / traveler pay screens before Stripe Checkout. */
export const CHECKOUT_METHOD_OPTIONS: {
  value: OnlinePaymentMethod;
  label: string;
  hint?: string;
}[] = [
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "DEBIT_CARD", label: "Debit card" },
  { value: "UPI", label: "UPI" },
  {
    value: "NETBANKING",
    label: "Net banking",
    hint: "Shown on Stripe when enabled for your account",
  },
];

export function isCardPaymentMethod(method: string | null | undefined): method is CardPaymentMethod {
  return method === "CREDIT_CARD" || method === "DEBIT_CARD";
}

export function isOnlineCheckoutMethod(
  method: string | null | undefined
): method is OnlinePaymentMethod {
  return (
    method === "CREDIT_CARD" ||
    method === "DEBIT_CARD" ||
    method === "UPI" ||
    method === "NETBANKING" ||
    method === "CARD" ||
    method === "STRIPE"
  );
}

/** Human label for UI / admin display. */
export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "CREDIT_CARD":
      return "Credit card";
    case "DEBIT_CARD":
      return "Debit card";
    case "CARD":
      return "Card";
    case "UPI":
      return "UPI";
    case "NETBANKING":
      return "Net banking";
    case "WALLET":
      return "Wallet";
    case "STRIPE":
      return "Stripe";
    default:
      return method?.replaceAll("_", " ") || "—";
  }
}

/**
 * Stripe Checkout payment_method_types for INR.
 *
 * Dynamic Payment Methods on non-India accounts (e.g. CA/AU) only surface
 * card (+ Link). Explicitly requesting `upi` with currency=inr does work in
 * test mode and shows UPI on Checkout — verified against this project's keys.
 *
 * Stripe has no separate "netbanking" Checkout type.
 */
export function stripePaymentMethodTypes(
  method: OnlinePaymentMethod | undefined
): string[] {
  // Prefer a single method when the user picked one; always keep card as fallback
  // so Checkout never fails if UPI is briefly unavailable.
  if (method === "UPI") return ["upi", "card"];
  if (method === "CREDIT_CARD" || method === "DEBIT_CARD" || method === "CARD") {
    return ["card", "upi"];
  }
  if (method === "NETBANKING") return ["card", "upi"];
  return ["card", "upi"];
}
