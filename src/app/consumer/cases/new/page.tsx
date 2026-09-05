"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { filterVisaTypesByPurpose, type VisaPurpose } from "@/lib/visaPurpose";

type Rate = {
  adultGovFee: string;
  adultServiceFee: string;
  childGovFee: string;
  childServiceFee: string;
  currency: string;
};
type VisaTypeSummary = {
  id: string;
  name: string;
  entryType: "SINGLE" | "MULTIPLE";
  visaCategory: "E_VISA" | "STICKER_VISA";
  validityDays: number;
  durationDays: number;
  processingDays: number;
};
type Country = { id: string; name: string; visaTypes: VisaTypeSummary[] };

const EMPTY_APPLICANT = {
  applicationGrouping: "INDIVIDUAL" as "INDIVIDUAL" | "GROUP" | "FAMILY",
  travelerType: "ADULT" as "ADULT" | "CHILD",
  departureDate: "",
  returnDate: "",
  applicantFirstName: "",
  applicantLastName: "",
  applicantPassportNo: "",
  passportIssueDate: "",
  passportExpiryDate: "",
  gender: "",
  dateOfBirth: "",
  placeOfBirth: "",
  fatherName: "",
  motherName: "",
  spouseName: "",
  bookingId: "",
  address: "",
  applicantEmail: "",
  applicantPhone: "",
};

export default function NewCasePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaPurpose, setVisaPurpose] = useState<VisaPurpose | "">("");
  const [selectedVisaType, setSelectedVisaType] = useState<VisaTypeSummary | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);
  const [form, setForm] = useState(EMPTY_APPLICANT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => setCountries(d.countries ?? []));
  }, []);

  const allVisaTypes = countries.find((c) => c.id === countryId)?.visaTypes ?? [];
  const visaTypes = filterVisaTypesByPurpose(allVisaTypes, visaPurpose);

  async function selectPackage(vt: VisaTypeSummary) {
    setSelectedVisaType(vt);
    const res = await fetch(`/api/pricing?visaTypeId=${vt.id}`);
    const data = await res.json();
    setRate(data.rate ?? null);
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const feeForTraveler =
    rate &&
    (form.travelerType === "CHILD"
      ? { gov: rate.childGovFee, service: rate.childServiceFee }
      : { gov: rate.adultGovFee, service: rate.adultServiceFee });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisaType) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId, visaTypeId: selectedVisaType.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create the case.");
        return;
      }
      router.push(`/consumer/cases/${data.case.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-medium text-ink">Apply visa</h1>

      {/* Step 1: destination + package, mirrors the real Apply Visa rate table */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink/80">Nationality</label>
          <select disabled value="INDIAN" className="input mt-1">
            <option value="INDIAN">Indian</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink/80">Going to</label>
          <select
            required
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              setVisaPurpose("");
              setSelectedVisaType(null);
              setRate(null);
            }}
            className="input mt-1"
          >
            <option value="">Select…</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink/80">Visa purpose</label>
          <select
            required
            value={visaPurpose}
            disabled={!countryId}
            onChange={(e) => {
              setVisaPurpose(e.target.value as VisaPurpose | "");
              setSelectedVisaType(null);
              setRate(null);
            }}
            className="input mt-1"
          >
            <option value="">Select…</option>
            <option value="TOURIST">Tourist</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
      </div>

      {countryId && visaPurpose && !selectedVisaType && (
        <div className="mt-6 overflow-hidden rounded-sm border border-line bg-white">
          <div className="bg-teal-500 px-4 py-2 text-sm font-medium text-paper">
            Available {visaPurpose === "BUSINESS" ? "business" : "tourist"} packages
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">Visa type</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Validity</th>
                <th className="px-3 py-2">Processing</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visaTypes.map((vt) => (
                <tr key={vt.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">{vt.name}</td>
                  <td className="px-3 py-2">{vt.entryType}</td>
                  <td className="px-3 py-2">{vt.visaCategory === "E_VISA" ? "E-Visa" : "Sticker visa"}</td>
                  <td className="px-3 py-2">{vt.validityDays} days</td>
                  <td className="px-3 py-2">{vt.processingDays} business days</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => selectPackage(vt)}
                      className="rounded-sm border border-teal-500 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
              {visaTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink/50">
                    No {visaPurpose === "BUSINESS" ? "business" : "tourist"} packages for this destination yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Step 2: applicant details, once a package is selected */}
      {selectedVisaType && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-sm border border-teal-500 bg-teal-50/50 px-4 py-3 text-sm">
            <span>
              <strong>{selectedVisaType.name}</strong> — {countries.find((c) => c.id === countryId)?.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedVisaType(null);
                setRate(null);
              }}
              className="text-teal-700 underline"
            >
              Change package
            </button>
          </div>

          <div className="rounded-sm border border-line bg-white p-4">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
              Are you applying for
            </div>
            <div className="flex gap-4 text-sm">
              {(["INDIVIDUAL", "GROUP", "FAMILY"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="grouping"
                    checked={form.applicationGrouping === g}
                    onChange={() => update("applicationGrouping", g)}
                  />
                  {g[0] + g.slice(1).toLowerCase()}
                </label>
              ))}
              <span className="ml-6 flex items-center gap-2">
                Traveler type:
                {(["ADULT", "CHILD"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="travelerType"
                      checked={form.travelerType === t}
                      onChange={() => update("travelerType", t)}
                    />
                    {t[0] + t.slice(1).toLowerCase()}
                  </label>
                ))}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink/70">Departure date</label>
                <input
                  type="date"
                  value={form.departureDate}
                  onChange={(e) => update("departureDate", e.target.value)}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70">Return date</label>
                <input
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => update("returnDate", e.target.value)}
                  className="input mt-1"
                />
              </div>
            </div>
          </div>

          {feeForTraveler && rate && (
            <div className="rounded-sm border border-line bg-white px-4 py-3 text-sm">
              <div className="flex justify-between text-ink/70">
                <span>Government fee</span>
                <span>{rate.currency} {feeForTraveler.gov}</span>
              </div>
              <div className="flex justify-between text-ink/70">
                <span>Service fee</span>
                <span>{rate.currency} {feeForTraveler.service}</span>
              </div>
              <p className="mt-2 text-xs text-ink/40">
                Upload required documents on the case page first. Payment opens after that and goes to Visamile.
              </p>
            </div>
          )}

          <div className="rounded-sm border border-line bg-white p-4">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
              Passport &amp; applicant details
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name">
                <input required value={form.applicantFirstName} onChange={(e) => update("applicantFirstName", e.target.value)} className="input" />
              </Field>
              <Field label="Last name">
                <input required value={form.applicantLastName} onChange={(e) => update("applicantLastName", e.target.value)} className="input" />
              </Field>
              <Field label="Passport number">
                <input required value={form.applicantPassportNo} onChange={(e) => update("applicantPassportNo", e.target.value)} className="input" />
              </Field>
              <Field label="Gender">
                <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="input">
                  <option value="">Select…</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Date of issue">
                <input type="date" value={form.passportIssueDate} onChange={(e) => update("passportIssueDate", e.target.value)} className="input" />
              </Field>
              <Field label="Date of expiry">
                <input type="date" value={form.passportExpiryDate} onChange={(e) => update("passportExpiryDate", e.target.value)} className="input" />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} className="input" />
              </Field>
              <Field label="Place of birth">
                <input value={form.placeOfBirth} onChange={(e) => update("placeOfBirth", e.target.value)} className="input" />
              </Field>
              <Field label="Father's name">
                <input value={form.fatherName} onChange={(e) => update("fatherName", e.target.value)} className="input" />
              </Field>
              <Field label="Mother's name">
                <input value={form.motherName} onChange={(e) => update("motherName", e.target.value)} className="input" />
              </Field>
              <Field label="Spouse name">
                <input value={form.spouseName} onChange={(e) => update("spouseName", e.target.value)} className="input" />
              </Field>
              <Field label="Booking ID">
                <input value={form.bookingId} onChange={(e) => update("bookingId", e.target.value)} className="input" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Address">
                <textarea value={form.address} onChange={(e) => update("address", e.target.value)} className="input" rows={2} />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Applicant email">
                <input type="email" value={form.applicantEmail} onChange={(e) => update("applicantEmail", e.target.value)} className="input" />
              </Field>
              <Field label="Applicant phone">
                <input value={form.applicantPhone} onChange={(e) => update("applicantPhone", e.target.value)} className="input" />
              </Field>
            </div>
          </div>

          <p className="text-sm text-ink/50">
            Document upload (passport copy, photograph, and the rest of the checklist) happens on the case
            detail page right after you save these details.
          </p>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-sm bg-teal-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save & continue to documents"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink/70">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
