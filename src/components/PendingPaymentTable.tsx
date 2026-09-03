"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@/lib/paymentFees";

type PendingCase = {
  id: string;
  referenceNo: string;
  applicantFirstName: string;
  applicantLastName: string;
  visaType: { name: string; country: { name: string } };
  departureDate: string | null;
  returnDate: string | null;
  govFeeSnapshot: string;
  serviceFeeSnapshot: string;
  currency: string;
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "UPI", label: "UPI" },
  { value: "NETBANKING", label: "Net banking" },
  { value: "CARD", label: "Cards (credit/debit)" },
];

export function PendingPaymentTable({
  cases,
  walletBalance,
}: {
  cases: PendingCase[];
  walletBalance: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payMode, setPayMode] = useState<"WALLET" | "ONLINE">("WALLET");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === cases.length ? new Set() : new Set(cases.map((c) => c.id))));
  }

  const totalPayable = useMemo(
    () =>
      cases
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + Number(c.govFeeSnapshot) + Number(c.serviceFeeSnapshot), 0),
    [cases, selected]
  );
  const walletShortfall = totalPayable > walletBalance;

  async function payFromWallet() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch("/api/wallet/pay-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Payment failed.");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setPaying(false);
    }
  }

  async function payOnline() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch("/api/payments/pay-cases-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: Array.from(selected), method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not start payment.");
        return;
      }
      router.push(data.redirectUrl);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={cases.length > 0 && selected.size === cases.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Departure</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-teal-700">{c.referenceNo}</td>
                <td className="px-4 py-3">
                  {c.applicantFirstName} {c.applicantLastName}
                </td>
                <td className="px-4 py-3">
                  {c.visaType.country.name} — {c.visaType.name}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {c.departureDate ? new Date(c.departureDate).toLocaleDateString("en-IN") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.currency} {(Number(c.govFeeSnapshot) + Number(c.serviceFeeSnapshot)).toFixed(2)}
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  Nothing waiting on payment right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cases.length > 0 && (
        <div className="mt-4 rounded-sm border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-8 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink/40">Total payable</div>
                <div className="font-display text-lg text-ink">₹{totalPayable.toLocaleString("en-IN")}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-ink/40">Wallet balance</div>
                <div className="font-display text-lg text-ink">₹{walletBalance.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={payMode === "WALLET"} onChange={() => setPayMode("WALLET")} />
                Pay from wallet
              </label>
              <label className="ml-3 flex items-center gap-1.5">
                <input type="radio" checked={payMode === "ONLINE"} onChange={() => setPayMode("ONLINE")} />
                Pay online now
              </label>
              {payMode === "ONLINE" && (
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input !py-1.5">
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            {payMode === "WALLET" ? (
              <button
                onClick={payFromWallet}
                disabled={selected.size === 0 || paying || walletShortfall}
                className="rounded-sm bg-teal-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
              >
                {paying ? "Paying…" : `Pay ${selected.size || ""} from wallet`}
              </button>
            ) : (
              <button
                onClick={payOnline}
                disabled={selected.size === 0 || paying}
                className="rounded-sm bg-teal-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
              >
                {paying ? "Redirecting…" : `Pay ${selected.size || ""} online`}
              </button>
            )}
          </div>

          {payMode === "WALLET" && walletShortfall && selected.size > 0 && (
            <p className="mt-2 text-right text-sm text-danger">
              Wallet balance is short by ₹{(totalPayable - walletBalance).toLocaleString("en-IN")} — switch
              to "Pay online now", or recharge your wallet first.
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
