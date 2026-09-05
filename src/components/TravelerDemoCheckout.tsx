"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Method = "UPI" | "CARD" | "NETBANKING";

export function TravelerDemoCheckout({
  orderId,
  amount,
  currency,
  referenceNos,
  caseIds,
}: {
  orderId: string;
  amount: number;
  currency: string;
  referenceNos: string[];
  caseIds: string[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("UPI");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function confirmPay() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Payment failed.");
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push(data.redirectTo ?? "/consumer/dashboard");
        router.refresh();
      }, 900);
    } catch {
      setError("Network error while completing payment.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-sm border border-line bg-white p-6 shadow-sm">
      <div className="text-center">
        <p className="font-display text-xl text-teal-700">Visamile</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-stamp-600">Demo payment portal</p>
        <p className="mt-1 text-xs text-ink/50">No real money is charged — for walkthroughs only</p>
      </div>

      <div className="mt-6 rounded-sm border border-line bg-paper/80 px-4 py-3 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Case{referenceNos.length > 1 ? "s" : ""}</span>
          <span className="text-right font-medium text-ink">{referenceNos.join(", ")}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base">
          <span className="font-medium text-ink">Amount payable</span>
          <span className="font-semibold text-teal-700">
            {currency} {amount.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-xs text-ink/50">Paid to Visamile (platform admin)</p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Pay using</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["UPI", "CARD", "NETBANKING"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              disabled={paying || done}
              className={`rounded-sm border px-2 py-2 text-xs font-medium ${
                method === m
                  ? "border-teal-500 bg-teal-50 text-teal-800"
                  : "border-line bg-white text-ink/70 hover:bg-ink/[0.03]"
              }`}
            >
              {m === "NETBANKING" ? "Net banking" : m === "CARD" ? "Card" : "UPI"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {done && <p className="mt-4 text-sm text-teal-700">Payment successful. Redirecting…</p>}

      <button
        type="button"
        onClick={confirmPay}
        disabled={paying || done}
        className="mt-6 w-full rounded-sm bg-teal-500 px-4 py-3 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
      >
        {paying ? "Processing…" : done ? "Paid" : `Pay ${currency} ${amount.toFixed(2)}`}
      </button>

      {caseIds[0] && (
        <button
          type="button"
          onClick={() => router.push(`/consumer/cases/${caseIds[0]}`)}
          disabled={paying}
          className="mt-3 w-full text-sm text-ink/50 underline hover:text-ink/70"
        >
          Cancel and go back
        </button>
      )}
    </div>
  );
}
