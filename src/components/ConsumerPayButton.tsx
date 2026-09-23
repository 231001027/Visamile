"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CHECKOUT_METHOD_OPTIONS,
  paymentMethodLabel,
  type OnlinePaymentMethod,
} from "@/lib/paymentMethods";

export function ConsumerPayButton({
  caseId,
  disabled = false,
  disabledReason,
}: {
  caseId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<OnlinePaymentMethod>("UPI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (disabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/consumer/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: [caseId], method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Payment failed.");
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        {CHECKOUT_METHOD_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={method === opt.value}
              onChange={() => setMethod(opt.value)}
              disabled={disabled || loading}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={disabled || loading}
        className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
      >
        {loading ? "Opening checkout…" : `Pay with ${paymentMethodLabel(method).toLowerCase()}`}
      </button>
      <p className="text-xs text-ink/45">
        On the next page choose Card (credit/debit) or UPI.
      </p>
      {disabled && disabledReason && <p className="text-sm text-ink/60">{disabledReason}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
