"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function DevCheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setStatus("error");
      setError("Missing orderId.");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/payments/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setError(typeof data.error === "string" ? data.error : "Payment could not be completed.");
          return;
        }
        router.push(data.redirectTo ?? "/login");
        router.refresh();
      } catch {
        setStatus("error");
        setError("Network error while completing payment.");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [orderId, router]);

  return (
    <div className="w-full max-w-sm rounded-sm border border-line bg-white p-8 text-center">
      <div className="font-display text-lg text-teal-700">Visamile</div>
      <p className="mt-4 text-xs uppercase tracking-wide text-stamp-600">
        Dev gateway — no real payment is being taken
      </p>
      {status === "processing" ? (
        <p className="mt-4 text-sm text-ink/70">Simulating PayU checkout…</p>
      ) : (
        <p className="mt-4 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}

export default function SharedDevCheckoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <Suspense fallback={<p className="text-sm text-ink/60">Loading checkout…</p>}>
        <DevCheckoutInner />
      </Suspense>
    </main>
  );
}
