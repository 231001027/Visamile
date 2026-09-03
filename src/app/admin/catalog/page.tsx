"use client";

import { useEffect, useState } from "react";

type Country = {
  id: string;
  name: string;
  visaTypes: {
    id: string;
    name: string;
    code: string;
    rates: { adultGovFee: string; adultServiceFee: string; childGovFee: string; childServiceFee: string; commission: string }[];
  }[];
};

export default function AdminCatalogPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [visaTypeId, setVisaTypeId] = useState("");
  const [form, setForm] = useState({ adultGovFee: "", adultServiceFee: "", childGovFee: "", childServiceFee: "", commission: "" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/catalog")
      .then((r) => r.json())
      .then((d) => setCountries(d.countries ?? []));
  }, []);

  const visaTypes = countries.flatMap((c) => c.visaTypes.map((v) => ({ ...v, countryName: c.name })));

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visaTypeId,
        adultGovFee: Number(form.adultGovFee),
        adultServiceFee: Number(form.adultServiceFee),
        childGovFee: Number(form.childGovFee),
        childServiceFee: Number(form.childServiceFee),
        commission: Number(form.commission || 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(typeof data.error === "string" ? data.error : "Failed to add rate.");
      return;
    }
    setMsg("New rate version created.");
    const refreshed = await fetch("/api/admin/catalog").then((r) => r.json());
    setCountries(refreshed.countries ?? []);
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Catalog &amp; pricing</h1>
      <p className="mt-1 text-sm text-ink/60">Add a new rate version for a visa package. Existing cases keep their snapshots.</p>

      <form onSubmit={addRate} className="mt-8 max-w-xl space-y-4 rounded-sm border border-line bg-white p-5">
        <div>
          <label className="block text-xs font-medium text-ink/70">Visa package</label>
          <select
            value={visaTypeId}
            onChange={(e) => setVisaTypeId(e.target.value)}
            className="input mt-1 w-full text-sm"
            required
          >
            <option value="">Select…</option>
            {visaTypes.map((v) => (
              <option key={v.id} value={v.id}>
                {(v as { countryName: string }).countryName} — {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["adultGovFee", "Adult gov fee"],
              ["adultServiceFee", "Adult service fee"],
              ["childGovFee", "Child gov fee"],
              ["childServiceFee", "Child service fee"],
              ["commission", "Commission"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-ink/70">{label}</label>
              <input
                type="number"
                step="0.01"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="input mt-1 w-full text-sm"
                required={key !== "commission"}
              />
            </div>
          ))}
        </div>
        <button type="submit" className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600">
          Add rate version
        </button>
        {msg && <p className="text-sm text-teal-700">{msg}</p>}
      </form>

      <div className="mt-10 space-y-6">
        {countries.map((c) => (
          <section key={c.id}>
            <h2 className="font-medium text-teal-700">{c.name}</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {c.visaTypes.map((v) => {
                const rate = v.rates[0];
                return (
                  <li key={v.id} className="rounded-sm border border-line bg-white px-4 py-3">
                    <div className="font-medium">{v.name}</div>
                    {rate ? (
                      <div className="mt-1 text-ink/60">
                        Adult ₹{Number(rate.adultGovFee) + Number(rate.adultServiceFee)} · Child ₹
                        {Number(rate.childGovFee) + Number(rate.childServiceFee)} · Commission ₹{rate.commission}
                      </div>
                    ) : (
                      <div className="mt-1 text-ink/40">No rate yet</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
