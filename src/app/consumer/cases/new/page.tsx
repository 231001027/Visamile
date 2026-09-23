"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline helpers so the apply page never depends on a separate module
 * failing to resolve in the client bundle.
 */
type VisaPurpose = "TOURIST" | "BUSINESS";

function purposeOf(pkg: { name: string; code?: string | null }): VisaPurpose {
  const code = (pkg.code || "").toUpperCase();
  if (code.includes("BUSINESS") || (code.includes("_B1") && !code.includes("B2"))) return "BUSINESS";
  const n = pkg.name.toLowerCase();
  if (n.includes("business")) return "BUSINESS";
  if (/\bb1\b/.test(n) && !/\bb2\b/.test(n)) return "BUSINESS";
  return "TOURIST";
}

function filterByPurpose<T extends { name: string; code?: string | null }>(
  visaTypes: T[],
  purpose: VisaPurpose | ""
): T[] {
  if (!purpose) return visaTypes;
  return visaTypes.filter((vt) => purposeOf(vt) === purpose);
}

type VisaTypeSummary = {
  id: string;
  name: string;
  code?: string;
  entryType: "SINGLE" | "MULTIPLE";
  visaCategory: "E_VISA" | "STICKER_VISA";
  validityDays: number;
  durationDays: number;
  processingDays: number;
};
type Country = { id: string; name: string; visaTypes: VisaTypeSummary[] };

const DATE_MIN = "1900-01-01";
const DATE_MAX = "2100-12-31";

function isValidCalendarDate(value: string): boolean {
  if (!value) return true;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  return y >= 1900 && y <= 2100;
}

const EMPTY_APPLICANT = {
  applicationGrouping: "INDIVIDUAL" as "INDIVIDUAL" | "GROUP" | "FAMILY",
  travelerType: "ADULT" as "ADULT" | "CHILD",
  departureDate: "",
  returnDate: "",
  applicantFirstName: "",
  applicantLastName: "",
  applicantPassportNo: "",
  applicantTitle: "",
  passportIssueDate: "",
  passportExpiryDate: "",
  gender: "",
  dateOfBirth: "",
  placeOfBirth: "",
  fatherName: "",
  motherName: "",
  spouseName: "",
  address: "",
  applicantEmail: "",
  applicantPhone: "",
};

type OcrConfidence = Partial<Record<keyof typeof EMPTY_APPLICANT, number>>;

const OCR_FILL_KEYS = [
  "applicantFirstName",
  "applicantLastName",
  "applicantPassportNo",
  "passportIssueDate",
  "passportExpiryDate",
  "gender",
  "dateOfBirth",
  "placeOfBirth",
] as const;

export default function NewCasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState("");
  const [travelPurpose, setTravelPurpose] = useState<VisaPurpose | "">("");
  const [selectedVisaType, setSelectedVisaType] = useState<VisaTypeSummary | null>(null);
  const [form, setForm] = useState(EMPTY_APPLICANT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ocrConsent, setOcrConsent] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<OcrConfidence>({});
  const [ocrSource, setOcrSource] = useState<string | null>(null);
  const [passportTempStorageKey, setPassportTempStorageKey] = useState<string | null>(null);
  const [passportFileName, setPassportFileName] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  useEffect(() => {
    fetch("/api/pricing")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setLoadError(typeof d.error === "string" ? d.error : "Could not load destinations.");
          return;
        }
        setCountries(d.countries ?? []);
      })
      .catch(() => setLoadError("Could not load destinations. Check your connection."));
  }, []);

  const allVisaTypes = countries.find((c) => c.id === countryId)?.visaTypes ?? [];
  const visaTypes = filterByPurpose(allVisaTypes, travelPurpose);

  function selectPackage(vt: VisaTypeSummary) {
    setSelectedVisaType(vt);
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handlePassportUpload(file: File) {
    setError(null);
    setOcrWarnings([]);
    if (!ocrConsent) {
      setError("Please confirm OCR consent before uploading your passport.");
      return;
    }
    setOcrScanning(true);
    try {
      // 1) Store passport on server (fast) — avoids Vercel 504 from server Tesseract.
      const body = new FormData();
      body.append("file", file);
      const storePromise = fetch("/api/ocr/passport", { method: "POST", body }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return { res, data };
      });

      // 2) OCR in the browser in parallel.
      let clientOcr: Awaited<ReturnType<typeof import("@/lib/ocr/browserPassport").extractPassportFieldsInBrowser>> | null =
        null;
      try {
        const { extractPassportFieldsInBrowser } = await import("@/lib/ocr/browserPassport");
        clientOcr = await extractPassportFieldsInBrowser(file);
      } catch (err) {
        console.error("[ocr] browser extract failed:", err);
      }

      const { res, data } = await storePromise;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Passport upload failed.");
        return;
      }

      const serverFields = (data.fields || {}) as Partial<typeof EMPTY_APPLICANT>;
      const clientFields = (clientOcr?.fields || {}) as Partial<typeof EMPTY_APPLICANT>;
      // Prefer client OCR (usually present); fall back to any server fields.
      const fields = { ...serverFields, ...clientFields };

      setForm((f) => {
        const next = { ...f };
        for (const key of OCR_FILL_KEYS) {
          const v = fields[key];
          if (typeof v === "string" && v.trim()) {
            (next as Record<string, string>)[key] = v.trim();
          }
        }
        return next;
      });
      setOcrConfidence(
        (clientOcr?.confidence || data.confidence || {}) as OcrConfidence
      );
      const warnings = [
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        ...(clientOcr?.warnings || []),
      ].filter(Boolean);
      if (!clientOcr) {
        warnings.push("Could not read the passport on this device. Enter details manually.");
      }
      setOcrWarnings(Array.from(new Set(warnings)));
      setOcrSource(clientOcr?.source || (typeof data.source === "string" ? data.source : null));
      setPassportTempStorageKey(typeof data.tempStorageKey === "string" ? data.tempStorageKey : null);
      setPassportFileName(typeof data.fileName === "string" ? data.fileName : file.name);
      setOcrDone(true);
    } catch (err) {
      console.error("[ocr] upload failed:", err);
      setError("Passport scan failed. Check your connection and try again, or skip OCR.");
    } finally {
      setOcrScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisaType) return;
    setError(null);

    const dateFields: { label: string; value: string }[] = [
      { label: "Departure date", value: form.departureDate },
      { label: "Return date", value: form.returnDate },
      { label: "Date of issue", value: form.passportIssueDate },
      { label: "Date of expiry", value: form.passportExpiryDate },
      { label: "Date of birth", value: form.dateOfBirth },
    ];
    const badDate = dateFields.find((f) => f.value && !isValidCalendarDate(f.value));
    if (badDate) {
      setError(`${badDate.label} must be a real date between 1900 and 2100.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryId,
          visaTypeId: selectedVisaType.id,
          ...form,
          ...(passportTempStorageKey
            ? { passportTempStorageKey, passportFileName: passportFileName || undefined }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create the case.");
        return;
      }
      router.push(`/consumer/cases/${data.case.id}`);
    } finally {
      setLoading(false);
    }
  }

  function fieldHint(key: keyof typeof EMPTY_APPLICANT): string | null {
    const c = ocrConfidence[key];
    if (c == null) return null;
    if (c < 0.6) return "Low confidence — please verify";
    if (c < 0.85) return "OCR filled — please confirm";
    return "OCR filled";
  }

  function fieldClass(key: keyof typeof EMPTY_APPLICANT): string {
    const c = ocrConfidence[key];
    if (c == null) return "input";
    if (c < 0.6) return "input ring-1 ring-amber-400";
    return "input ring-1 ring-teal-300";
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-medium text-ink">Apply visa</h1>
      {loadError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              setTravelPurpose("");
              setSelectedVisaType(null);
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
          <label className="block text-sm font-medium text-ink/80">Travel purpose</label>
          <select
            required
            value={travelPurpose}
            disabled={!countryId}
            onChange={(e) => {
              setTravelPurpose(e.target.value as VisaPurpose | "");
              setSelectedVisaType(null);
            }}
            className="input mt-1"
          >
            <option value="">{countryId ? "Select…" : "Select destination first"}</option>
            <option value="TOURIST">Tourist</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
      </div>

      {countryId && travelPurpose && !selectedVisaType && (
        <div className="mt-6 overflow-hidden rounded-sm border border-line bg-white">
          <div className="bg-teal-500 px-4 py-2 text-sm font-medium text-paper">Available packages</div>
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
                      type="button"
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
                    No {travelPurpose === "BUSINESS" ? "business" : "tourist"} packages for this destination.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedVisaType && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="flex items-center justify-between rounded-sm border border-teal-500 bg-teal-50/50 px-4 py-3 text-sm">
            <span>
              <strong>{selectedVisaType.name}</strong> — {countries.find((c) => c.id === countryId)?.name}
              {travelPurpose ? ` · ${travelPurpose === "BUSINESS" ? "Business" : "Tourist"}` : ""}
            </span>
            <button type="button" onClick={() => setSelectedVisaType(null)} className="text-teal-700 underline">
              Change package
            </button>
          </div>

          <div className="rounded-sm border border-line bg-white p-4">
            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
              1. Passport scan (OCR)
            </div>
            <p className="mb-3 text-sm text-ink/60">
              Upload a clear photo of the passport data page. We extract name, passport number, dates, and gender
              so you can confirm them below. Remaining checklist documents upload after you save.
            </p>
            <label className="mb-3 flex items-start gap-2 text-sm text-ink/80">
              <input
                type="checkbox"
                checked={ocrConsent}
                onChange={(e) => setOcrConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I consent to on-device passport text recognition (OCR) to prefill my application, and to
                storing this image with my case. I will review every field before submitting.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                disabled={!ocrConsent || ocrScanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePassportUpload(f);
                }}
                className="text-sm"
              />
              {ocrScanning && <span className="text-sm text-ink/50">Reading passport…</span>}
              {ocrDone && passportFileName && !ocrScanning && (
                <span className="text-sm text-teal-700">
                  Scanned: {passportFileName}
                  {ocrSource ? ` (${ocrSource})` : ""}
                </span>
              )}
            </div>
            {ocrWarnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {ocrWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-3 text-sm text-ink/50 underline"
              onClick={() => {
                setOcrDone(true);
                setOcrWarnings(["Skipped OCR — enter details manually."]);
              }}
            >
              Skip OCR and type manually
            </button>
          </div>

          {(ocrDone ||
            form.applicantFirstName ||
            form.applicantLastName ||
            form.applicantPassportNo) && (
            <>
              <div className="rounded-sm border border-line bg-white p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
                  Are you applying for
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
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
                  <span className="flex items-center gap-2">
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
                      min={DATE_MIN}
                      max={DATE_MAX}
                      value={form.departureDate}
                      onChange={(e) => update("departureDate", e.target.value)}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink/70">Return date</label>
                    <input
                      type="date"
                      min={DATE_MIN}
                      max={DATE_MAX}
                      value={form.returnDate}
                      onChange={(e) => update("returnDate", e.target.value)}
                      className="input mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-sm border border-line bg-white p-4">
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
                  2. Confirm passport &amp; applicant details
                </div>
                <p className="mb-3 text-xs text-ink/50">
                  Teal outline = OCR filled. Amber = low confidence — double-check. Parents, spouse, address,
                  email, and phone are usually entered manually.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First name" hint={fieldHint("applicantFirstName")}>
                    <input
                      required
                      value={form.applicantFirstName}
                      onChange={(e) => update("applicantFirstName", e.target.value)}
                      className={fieldClass("applicantFirstName")}
                    />
                  </Field>
                  <Field label="Last name" hint={fieldHint("applicantLastName")}>
                    <input
                      required
                      value={form.applicantLastName}
                      onChange={(e) => update("applicantLastName", e.target.value)}
                      className={fieldClass("applicantLastName")}
                    />
                  </Field>
                  <Field label="Passport number" hint={fieldHint("applicantPassportNo")}>
                    <input
                      required
                      value={form.applicantPassportNo}
                      onChange={(e) => update("applicantPassportNo", e.target.value)}
                      className={fieldClass("applicantPassportNo")}
                    />
                  </Field>
                  <Field label="Title">
                    <select
                      value={form.applicantTitle}
                      onChange={(e) => update("applicantTitle", e.target.value)}
                      className="input"
                    >
                      <option value="">Select…</option>
                      <option value="MR">Mr</option>
                      <option value="MS">Ms</option>
                      <option value="MRS">Mrs</option>
                    </select>
                  </Field>
                  <Field label="Gender" hint={fieldHint("gender")}>
                    <select
                      value={form.gender}
                      onChange={(e) => update("gender", e.target.value)}
                      className={fieldClass("gender")}
                    >
                      <option value="">Select…</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Date of issue" hint={fieldHint("passportIssueDate")}>
                    <input
                      type="date"
                      min={DATE_MIN}
                      max={DATE_MAX}
                      value={form.passportIssueDate}
                      onChange={(e) => update("passportIssueDate", e.target.value)}
                      className={fieldClass("passportIssueDate")}
                    />
                  </Field>
                  <Field label="Date of expiry" hint={fieldHint("passportExpiryDate")}>
                    <input
                      type="date"
                      min={DATE_MIN}
                      max={DATE_MAX}
                      value={form.passportExpiryDate}
                      onChange={(e) => update("passportExpiryDate", e.target.value)}
                      className={fieldClass("passportExpiryDate")}
                    />
                  </Field>
                  <Field label="Date of birth" hint={fieldHint("dateOfBirth")}>
                    <input
                      type="date"
                      min={DATE_MIN}
                      max={DATE_MAX}
                      value={form.dateOfBirth}
                      onChange={(e) => update("dateOfBirth", e.target.value)}
                      className={fieldClass("dateOfBirth")}
                    />
                  </Field>
                  <Field label="Place of birth" hint={fieldHint("placeOfBirth")}>
                    <input
                      value={form.placeOfBirth}
                      onChange={(e) => update("placeOfBirth", e.target.value)}
                      className={fieldClass("placeOfBirth")}
                    />
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
                </div>
                <div className="mt-4">
                  <Field label="Address">
                    <textarea value={form.address} onChange={(e) => update("address", e.target.value)} className="input" rows={2} />
                  </Field>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Field label="Applicant email">
                    <input
                      type="email"
                      value={form.applicantEmail}
                      onChange={(e) => update("applicantEmail", e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Applicant phone">
                    <input value={form.applicantPhone} onChange={(e) => update("applicantPhone", e.target.value)} className="input" />
                  </Field>
                </div>
              </div>

              <p className="text-sm text-ink/50">
                {passportTempStorageKey
                  ? "This passport scan will be saved as Passport front page. Upload remaining checklist docs on the next page."
                  : "Document upload continues on the next page after you save these details."}
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
                {loading ? "Saving…" : "Confirm & continue to documents"}
              </button>
            </>
          )}

          {error && !ocrDone && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink/70">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-0.5 text-[11px] text-ink/45">{hint}</p>}
    </div>
  );
}
