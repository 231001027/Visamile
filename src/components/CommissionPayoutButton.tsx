"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CommissionPayoutButton({ partnerId, companyName }: { partnerId: string; companyName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function pay() {
    if (!confirm(`Process commission payout for ${companyName}?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      setMsg(`Credited ₹${Number(data.payout.amount).toFixed(2)} for ${data.payout.caseCount} case(s).`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={pay}
        disabled={loading}
        className="text-xs font-medium text-teal-600 hover:underline disabled:opacity-50"
      >
        {loading ? "Processing…" : "Pay commission"}
      </button>
      {msg && <span className="text-xs text-ink/50">{msg}</span>}
    </div>
  );
}
