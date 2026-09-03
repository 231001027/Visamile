"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssignProcessorForm({
  caseId,
  currentProcessorId,
  processors,
}: {
  caseId: string;
  currentProcessorId: string | null;
  processors: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [processorUserId, setProcessorUserId] = useState(currentProcessorId ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/processors/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, processorUserId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(typeof data.error === "string" ? data.error : "Assign failed.");
      return;
    }
    setMsg("Processor assigned.");
    router.refresh();
  }

  return (
    <form onSubmit={assign} className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-white p-4">
      <div className="min-w-[220px] flex-1">
        <label className="block text-xs font-medium text-ink/70">Assign processor</label>
        <select
          className="input mt-1 text-sm"
          value={processorUserId}
          onChange={(e) => setProcessorUserId(e.target.value)}
          required
        >
          <option value="">Select…</option>
          {processors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600">
        Assign
      </button>
      {msg && <p className="w-full text-xs text-teal-700">{msg}</p>}
    </form>
  );
}
