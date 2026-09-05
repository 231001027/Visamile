"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CaseApplicantData {
  applicantFirstName: string;
  applicantLastName: string;
  applicantPassportNo: string;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  bookingId?: string | null;
  address?: string | null;
  applicantEmail?: string | null;
  applicantPhone?: string | null;
}

function toDateInput(val?: string | Date | null) {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function CaseEditForm({ caseId, initial, editable }: { caseId: string; initial: CaseApplicantData; editable: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    applicantFirstName: initial.applicantFirstName,
    applicantLastName: initial.applicantLastName,
    applicantPassportNo: initial.applicantPassportNo,
    passportIssueDate: toDateInput(initial.passportIssueDate),
    passportExpiryDate: toDateInput(initial.passportExpiryDate),
    gender: initial.gender ?? "",
    dateOfBirth: toDateInput(initial.dateOfBirth),
    placeOfBirth: initial.placeOfBirth ?? "",
    fatherName: initial.fatherName ?? "",
    motherName: initial.motherName ?? "",
    spouseName: initial.spouseName ?? "",
    bookingId: initial.bookingId ?? "",
    address: initial.address ?? "",
    applicantEmail: initial.applicantEmail ?? "",
    applicantPhone: initial.applicantPhone ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  if (!editable) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/applicant`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Applicant details</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-medium text-teal-600 hover:underline"
        >
          {open ? "Cancel" : "Edit applicant"}
        </button>
      </div>

      {!open ? (
        <div className="grid grid-cols-2 gap-4 rounded-sm border border-line bg-white p-5 text-sm">
          <Field label="First name" value={form.applicantFirstName} />
          <Field label="Last name" value={form.applicantLastName} />
          <Field label="Passport number" value={form.applicantPassportNo} />
          <Field label="Gender" value={form.gender || "—"} />
          <Field label="Date of birth" value={form.dateOfBirth || "—"} />
          <Field label="Place of birth" value={form.placeOfBirth || "—"} />
          <Field label="Passport issue" value={form.passportIssueDate || "—"} />
          <Field label="Passport expiry" value={form.passportExpiryDate || "—"} />
          <Field label="Father's name" value={form.fatherName || "—"} />
          <Field label="Mother's name" value={form.motherName || "—"} />
          <Field label="Email" value={form.applicantEmail || "—"} />
          <Field label="Phone" value={form.applicantPhone || "—"} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 rounded-sm border border-line bg-white p-5">
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["applicantFirstName", "First name", "text"],
                ["applicantLastName", "Last name", "text"],
                ["applicantPassportNo", "Passport number", "text"],
                ["gender", "Gender", "text"],
                ["dateOfBirth", "Date of birth", "date"],
                ["placeOfBirth", "Place of birth", "text"],
                ["passportIssueDate", "Passport issue date", "date"],
                ["passportExpiryDate", "Passport expiry date", "date"],
                ["fatherName", "Father's name", "text"],
                ["motherName", "Mother's name", "text"],
                ["spouseName", "Spouse name", "text"],
                ["bookingId", "Booking ID", "text"],
                ["applicantEmail", "Email", "email"],
                ["applicantPhone", "Phone", "text"],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-ink/70">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="input mt-1 w-full text-sm"
                  required={key === "applicantFirstName" || key === "applicantLastName" || key === "applicantPassportNo"}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink/70">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="input mt-1 w-full text-sm"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save applicant details"}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink/40">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
