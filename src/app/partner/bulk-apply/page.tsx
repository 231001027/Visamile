"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Rate = { adultGovFee: string; adultServiceFee: string; childGovFee: string; childServiceFee: string; currency: string };
type BulkVisaType = {
  id: string;
  name: string;
  bulkCategoryLabel: string | null;
  entryType: string;
  validityDays: number;
  processingDays: number;
  rates: Rate[];
};
type Country = { id: string; name: string };

type Row = { applicantFirstName: string; applicantLastName: string; applicantPassportNo: string };
const EMPTY_ROW: Row = { applicantFirstName: "", applicantLastName: "", applicantPassportNo: "" };

export default function BulkApplyPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaTypes, setVisaTypes] = useState<BulkVisaType[]>([]);
  const [selected, setSelected] = useState<BulkVisaType | null>(null);
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [travelerType, setTravelerType] = useState<"ADULT" | "CHILD">("ADULT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => setCountries(d.countries ?? []));
  }, []);

  useEffect(() => {
    if (!countryId) {
      setVisaTypes([]);
      return;
    }
    setSelected(null);
    fetch(`/api/pricing?countryId=${countryId}&bulk=true`)
      .then((r) => r.json())
      .then((d) => setVisaTypes(d.visaTypes ?? []));
  }, [countryId]);

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function submit() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const applicants = rows.filter((r) => r.applicantFirstName && r.applicantLastName && r.applicantPassportNo);
      const res = await fetch("/api/cases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId, visaTypeId: selected.id, travelerType, applicants }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Bulk creation failed.");
        return;
      }
      router.push("/partner/pending-payment");
    } finally {
      setLoading(false);
    }
  }

  // Group catalog rows by their bulk category label for display, mirroring the reference screen's colored sections.
  const grouped = visaTypes.reduce<Record<string, BulkVisaType[]>>((acc, vt) => {
    const key = vt.bulkCategoryLabel ?? vt.name;
    (acc[key] ??= []).push(vt);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-medium text-ink">Bulk apply visa</h1>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink/80">Nationality</label>
          <select disabled value="INDIAN" className="input mt-1">
            <option value="INDIAN">Indian</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink/80">Going to</label>
          <select required value={countryId} onChange={(e) => setCountryId(e.target.value)} className="input mt-1">
            <option value="">Select…</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {countryId && !selected && (
        <div className="mt-6 space-y-4">
          {Object.entries(grouped).map(([label, types]) => (
            <div key={label} className="overflow-hidden rounded-sm border border-line bg-white">
              <div className="bg-teal-500 px-4 py-2 text-sm font-medium text-paper">{label}</div>
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
                  <tr>
                    <th className="px-3 py-2">Entry</th>
                    <th className="px-3 py-2">Validity</th>
                    <th className="px-3 py-2">Processing</th>
                    <th className="px-3 py-2">Adult rate</th>
                    <th className="px-3 py-2">Child rate</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((vt) => {
                    const r = vt.rates[0];
                    return (
                      <tr key={vt.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">{vt.entryType}</td>
                        <td className="px-3 py-2">{vt.validityDays} days</td>
                        <td className="px-3 py-2">{vt.processingDays} business days</td>
                        <td className="px-3 py-2">{r ? `${r.currency} ${Number(r.adultGovFee) + Number(r.adultServiceFee)}` : "—"}</td>
                        <td className="px-3 py-2">{r ? `${r.currency} ${Number(r.childGovFee) + Number(r.childServiceFee)}` : "—"}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setSelected(vt)}
                            className="rounded-sm border border-teal-500 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {visaTypes.length === 0 && (
            <p className="text-sm text-ink/50">No bulk-eligible packages configured for this destination yet.</p>
          )}
        </div>
      )}

      {selected && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-sm border border-teal-500 bg-teal-50/50 px-4 py-3 text-sm">
            <span><strong>{selected.bulkCategoryLabel ?? selected.name}</strong></span>
            <button onClick={() => setSelected(null)} className="text-teal-700 underline">Change</button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            Traveler type:
            {(["ADULT", "CHILD"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input type="radio" checked={travelerType === t} onChange={() => setTravelerType(t)} />
                {t[0] + t.slice(1).toLowerCase()}
              </label>
            ))}
          </div>

          <div className="overflow-hidden rounded-sm border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-3 py-2">First name</th>
                  <th className="px-3 py-2">Last name</th>
                  <th className="px-3 py-2">Passport no.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-2 py-1"><input value={row.applicantFirstName} onChange={(e) => updateRow(i, "applicantFirstName", e.target.value)} className="input !py-1" /></td>
                    <td className="px-2 py-1"><input value={row.applicantLastName} onChange={(e) => updateRow(i, "applicantLastName", e.target.value)} className="input !py-1" /></td>
                    <td className="px-2 py-1"><input value={row.applicantPassportNo} onChange={(e) => updateRow(i, "applicantPassportNo", e.target.value)} className="input !py-1" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}
            className="text-sm text-teal-700 underline"
          >
            + Add another traveler
          </button>

          <p className="text-sm text-ink/50">
            Each row becomes its own case in Pending Payment, with just these fields set — add passport
            details and documents on each case afterward.
          </p>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="rounded-sm bg-teal-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
          >
            {loading ? "Creating…" : `Create ${rows.filter((r) => r.applicantFirstName).length || ""} cases`}
          </button>
        </div>
      )}
    </div>
  );
}
