"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CHECKOUT_METHOD_OPTIONS,
  paymentMethodLabel,
  type OnlinePaymentMethod,
} from "@/lib/paymentMethods";

export function WalletTopupForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<OnlinePaymentMethod>("UPI");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const n = Number(amount);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
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
          <span className="block text-xs font-medium text-ink/70">Pay with</span>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {CHECKOUT_METHOD_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={method === opt.value}
                  onChange={() => setMethod(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !amount}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : `Pay with ${paymentMethodLabel(method).toLowerCase()}`}
        </button>
      </div>

      {n > 0 && (
        <p className="text-sm text-ink/50">
          Stripe Checkout will show Card and UPI (when enabled). Wallet is credited after payment confirms.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
