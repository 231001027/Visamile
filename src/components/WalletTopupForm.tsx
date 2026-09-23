"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WalletTopupForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
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
        body: JSON.stringify({ amount: Number(amount) }),
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
        <button
          type="submit"
          disabled={loading || !amount}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Pay with Stripe"}
        </button>
      </div>

      {n > 0 && (
        <p className="text-sm text-ink/50">
          You will pay ₹{n.toLocaleString("en-IN")} on Stripe Checkout (card / UPI / netbanking as enabled on
          your Stripe account). Wallet is credited after payment confirms.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
