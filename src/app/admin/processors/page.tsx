"use client";

import { useEffect, useState } from "react";

type Processor = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  openCases: number;
  createdAt: string;
};

export default function AdminProcessorsPage() {
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/processors");
    const data = await res.json();
    setProcessors(data.processors ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/processors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(typeof data.error === "string" ? data.error : "Failed to create processor.");
      return;
    }
    setForm({ name: "", email: "", password: "" });
    setMsg("Processor account created.");
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Processors</h1>
      <p className="mt-1 text-sm text-ink/60">
        Third-party verifiers who check documents and hand cases to the embassy (no embassy login).
      </p>

      <form onSubmit={create} className="mt-8 max-w-lg space-y-3 rounded-sm border border-line bg-white p-5">
        <div>
          <label className="block text-xs font-medium text-ink/70">Name</label>
          <input
            className="input mt-1"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70">Email</label>
          <input
            type="email"
            className="input mt-1"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink/70">Temp password</label>
          <input
            type="password"
            className="input mt-1"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </div>
        <button type="submit" className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600">
          Create processor
        </button>
        {msg && <p className="text-sm text-teal-700">{msg}</p>}
      </form>

      <ul className="mt-8 divide-y divide-line rounded-sm border border-line bg-white">
        {processors.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-ink/50">{p.email}</div>
            </div>
            <div className="text-right text-xs text-ink/50">
              <div>{p.openCases} open case(s)</div>
              <div>{p.active ? "Active" : "Inactive"}</div>
            </div>
          </li>
        ))}
        {processors.length === 0 && <li className="px-4 py-6 text-sm text-ink/50">No processors yet.</li>}
      </ul>
    </div>
  );
}
