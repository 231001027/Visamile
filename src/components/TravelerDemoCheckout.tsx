"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type Method = "UPI" | "CARD" | "CHEQUE";

function DemoQrPlaceholder() {
  return (
    <div className="flex flex-col items-center rounded-sm border border-dashed border-line bg-paper/80 px-4 py-5">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden className="text-ink/80">
        <rect x="8" y="8" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="6" />
        <rect x="18" y="18" width="20" height="20" fill="currentColor" />
        <rect x="92" y="8" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="6" />
        <rect x="102" y="18" width="20" height="20" fill="currentColor" />
        <rect x="8" y="92" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="6" />
        <rect x="18" y="102" width="20" height="20" fill="currentColor" />
        <rect x="60" y="60" width="12" height="12" fill="currentColor" />
        <rect x="80" y="60" width="12" height="12" fill="currentColor" />
        <rect x="60" y="80" width="12" height="12" fill="currentColor" />
        <rect x="92" y="80" width="20" height="12" fill="currentColor" />
        <rect x="80" y="100" width="12" height="20" fill="currentColor" />
        <rect x="100" y="100" width="20" height="20" fill="currentColor" />
        <rect x="56" y="20" width="8" height="8" fill="currentColor" />
        <rect x="72" y="20" width="8" height="8" fill="currentColor" />
        <rect x="56" y="36" width="8" height="8" fill="currentColor" />
        <rect x="20" y="56" width="8" height="8" fill="currentColor" />
        <rect x="36" y="56" width="8" height="8" fill="currentColor" />
        <rect x="20" y="72" width="8" height="8" fill="currentColor" />
      </svg>
      <p className="mt-2 text-center text-xs text-ink/50">Scan to pay — demo</p>
    </div>
  );
}

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

  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");

  function validateForConfirm(): string | null {
    if (method === "UPI") {
      const id = upiId.trim();
      if (!id.includes("@") || id.length < 5) return "Enter a valid UPI ID (e.g. name@bank).";
      return null;
    }
    if (method === "CARD") {
      const digits = cardNumber.replace(/\s+/g, "");
      if (digits.length < 12 || digits.length > 19 || !/^\d+$/.test(digits)) {
        return "Enter a valid card number.";
      }
      if (cardName.trim().length < 2) return "Enter the name on the card.";
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) return "Enter expiry as MM/YY.";
      if (!/^\d{3,4}$/.test(cardCvv.trim())) return "Enter a valid CVV.";
      return null;
    }
    if (chequeNumber.trim().length < 4) return "Enter the digital cheque number.";
    return null;
  }

  async function submit(outcome: "success" | "failed") {
    setError(null);
    if (outcome === "success") {
      const validationError = validateForConfirm();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setPaying(true);
    try {
      const res = await fetch("/api/payments/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, outcome, method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Payment failed.");
        return;
      }
      router.push(data.redirectTo ?? `/pay/demo-result?orderId=${orderId}&status=${outcome}`);
      router.refresh();
    } catch {
      setError("Network error while completing payment.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-sm border border-line bg-white p-6 shadow-sm">
      <div className="text-center">
        <div className="flex justify-center">
          <BrandLogo href={null} variant="dark" size="md" />
        </div>
        <p className="mt-2 text-xs uppercase tracking-wide text-stamp-600">Demo payment portal</p>
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
          {([
            { id: "UPI" as const, label: "UPI" },
            { id: "CARD" as const, label: "Card" },
            { id: "CHEQUE" as const, label: "Cheque" },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMethod(m.id);
                setError(null);
              }}
              disabled={paying}
              className={`rounded-sm border px-2 py-2 text-xs font-medium ${
                method === m.id
                  ? "border-teal-500 bg-teal-50 text-teal-800"
                  : "border-line bg-white text-ink/70 hover:bg-ink/[0.03]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {method === "UPI" && (
          <>
            <div>
              <label className="block text-xs font-medium text-ink/70">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="name@bank"
                disabled={paying}
                className="input mt-1"
                autoComplete="off"
              />
            </div>
            <DemoQrPlaceholder />
          </>
        )}

        {method === "CARD" && (
          <>
            <div>
              <label className="block text-xs font-medium text-ink/70">Card number</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="XXXX XXXX XXXX XXXX"
                disabled={paying}
                className="input mt-1"
                autoComplete="cc-number"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/70">Name on card</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="As printed on card"
                disabled={paying}
                className="input mt-1"
                autoComplete="cc-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70">Valid thru</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  disabled={paying}
                  className="input mt-1"
                  autoComplete="cc-exp"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70">CVV</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  placeholder="•••"
                  disabled={paying}
                  className="input mt-1"
                  autoComplete="cc-csc"
                  maxLength={4}
                />
              </div>
            </div>
          </>
        )}

        {method === "CHEQUE" && (
          <>
            <div>
              <label className="block text-xs font-medium text-ink/70">Digital cheque number</label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Cheque / reference number"
                disabled={paying}
                className="input mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/70">Bank name (optional)</label>
              <input
                type="text"
                value={chequeBank}
                onChange={(e) => setChequeBank(e.target.value)}
                placeholder="Issuing bank"
                disabled={paying}
                className="input mt-1"
                autoComplete="off"
              />
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => submit("success")}
        disabled={paying}
        className="mt-6 w-full rounded-sm bg-teal-500 px-4 py-3 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
      >
        {paying ? "Processing…" : `Confirm payment · ${currency} ${amount.toFixed(2)}`}
      </button>

      <button
        type="button"
        onClick={() => submit("failed")}
        disabled={paying}
        className="mt-2 w-full rounded-sm border border-line px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/[0.03] disabled:opacity-50"
      >
        Decline payment
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
