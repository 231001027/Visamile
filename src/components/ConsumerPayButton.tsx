"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        body: JSON.stringify({ caseIds: [caseId], method: "UPI" }),
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
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={disabled || loading}
        className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
      >
        {loading ? "Opening payment portal…" : "Pay now"}
      </button>
      {disabled && disabledReason && <p className="mt-2 text-sm text-ink/60">{disabledReason}</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
