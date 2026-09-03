"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartnerStatusActions({
  partnerId,
  status,
}: {
  partnerId: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(next: "APPROVED" | "SUSPENDED" | "PENDING") {
    setLoading(true);
    try {
      await fetch("/api/partners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, status: next }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {status !== "APPROVED" && (
        <button
          onClick={() => setStatus("APPROVED")}
          disabled={loading}
          className="rounded-sm bg-teal-500 px-3 py-1.5 text-xs font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
        >
          Approve
        </button>
      )}
      {status !== "SUSPENDED" && (
        <button
          onClick={() => setStatus("SUSPENDED")}
          disabled={loading}
          className="rounded-sm border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
        >
          Suspend
        </button>
      )}
    </div>
  );
}
