/**
 * Payment-method fee schedule for wallet top-ups, calibrated against the
 * real PayU checkout screenshots: on a ₹10,000 top-up, UPI added a ₹2
 * "Internet Handling Fee" (0.02%) + 18% GST on that fee (₹0.36) — total
 * ₹10,002.36. Net Banking added ₹19 (0.19%) + ₹3.42 GST — total
 * ₹10,022.42. Card rates aren't visible in the screenshots; the figure
 * below is a placeholder typical of PayU's domestic card MDR and should be
 * replaced with your actual negotiated rate before going live.
 *
 * Important: this fee is charged TO THE AGENT on top of the recharge
 * amount — the wallet is still credited exactly the amount they asked to
 * top up. The fee is PayU's/the bank's processing cost, not Visamile
 * revenue, so it never touches the ledger balance.
 */

export type PaymentMethod = "UPI" | "NETBANKING" | "CARD";

const FEE_PERCENT: Record<PaymentMethod, number> = {
  UPI: 0.0002, // 0.02%
  NETBANKING: 0.0019, // 0.19%
  CARD: 0.02, // 2% — placeholder, confirm against your PayU MDR agreement
};

const GST_RATE_ON_FEE = 0.18;

export interface FeeBreakdown {
  subtotal: number;
  gatewayFee: number;
  gatewayGst: number;
  totalPayable: number;
}

export function calculateTopupFee(amount: number, method: PaymentMethod): FeeBreakdown {
  const gatewayFee = round2(amount * FEE_PERCENT[method]);
  const gatewayGst = round2(gatewayFee * GST_RATE_ON_FEE);
  return {
    subtotal: amount,
    gatewayFee,
    gatewayGst,
    totalPayable: round2(amount + gatewayFee + gatewayGst),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
