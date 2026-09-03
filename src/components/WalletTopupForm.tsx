"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { calculateTopupFee, PaymentMethod } from "@/lib/paymentFees";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "UPI", label: "UPI" },
  { value: "NETBANKING", label: "Net banking" },
  { value: "CARD", label: "Cards (credit/debit)" },
];

export function WalletTopupForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fee = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return null;
    return calculateTopupFee(n, method);
  }, [amount, method]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Top-up failed.");
        return;
      }
      if (data.usingRealGateway) {
        // A real PayU checkout needs a signed form POST, not a GET redirect
        // — see src/lib/payment.ts PayUGateway for the field list to wire
        // into a real checkout page.
        window.location.href = data.redirectUrl;
      } else {
        router.push(data.redirectUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-ink/70">Recharge amount (₹)</label>
          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input mt-1 w-40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70">Payment method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input mt-1">
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !amount}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Proceed to pay"}
        </button>
      </div>

      {fee && (
        <div className="max-w-xs rounded-sm border border-line bg-white px-4 py-3 text-sm">
          <div className="flex justify-between text-ink/70">
            <span>Subtotal</span>
            <span>₹{fee.subtotal.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-ink/70">
            <span>Internet handling fee</span>
            <span>₹{fee.gatewayFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-ink/70">
            <span>GST (18%)</span>
            <span>₹{fee.gatewayGst.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium text-ink">
            <span>Total payable</span>
            <span>₹{fee.totalPayable.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-ink/40">
            Your wallet is credited the full ₹{fee.subtotal.toLocaleString("en-IN")} — the fee above is the
            payment gateway's charge, paid on top, not deducted from your balance.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
