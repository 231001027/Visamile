"use client";

import { useState } from "react";

export function ApiKeyManager({ initialKeys }: { initialKeys: { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/partner/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to create key.");
      return;
    }
    setNewKey(data.rawKey);
    setKeys((k) => [{ ...data.key, createdAt: new Date().toISOString(), lastUsedAt: null }, ...k]);
    setName("");
  }

  async function revoke(id: string) {
    await fetch(`/api/partner/api-keys/${id}`, { method: "DELETE" });
    setKeys((k) => k.filter((x) => x.id !== id));
  }

  return (
    <section className="mt-8 rounded-sm border border-line bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">API keys</h2>
      <p className="mt-1 text-sm text-ink/60">
        Use API keys to create cases from your CRM. Send <code className="text-xs">X-API-Key</code> header to{" "}
        <code className="text-xs">/api/v1/cases</code> and <code className="text-xs">/api/v1/cases/bulk</code>.
      </p>

      {newKey && (
        <div className="mt-4 rounded-sm border border-teal-200 bg-teal-50 p-3 text-sm">
          <p className="font-medium text-teal-800">Copy this key now — it won&apos;t be shown again:</p>
          <code className="mt-2 block break-all text-xs">{newKey}</code>
        </div>
      )}

      <form onSubmit={createKey} className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. CRM production)"
          className="input flex-1 text-sm"
          required
        />
        <button type="submit" className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600">
          Create key
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <ul className="mt-4 divide-y divide-line text-sm">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">{k.name}</div>
              <div className="text-xs text-ink/40">{k.keyPrefix}… · created {new Date(k.createdAt).toLocaleDateString("en-IN")}</div>
            </div>
            <button type="button" onClick={() => revoke(k.id)} className="text-xs text-danger hover:underline">
              Revoke
            </button>
          </li>
        ))}
        {keys.length === 0 && <li className="py-2 text-ink/50">No API keys yet.</li>}
      </ul>
    </section>
  );
}
