"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Profile = {
  companyName: string;
  contactEmail: string;
  contactPhone: string | null;
  invoiceFrequency: "DAILY" | "WEEKLY" | "MONTHLY";
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  contactPersonMobile: string | null;
  salesPersonId: string | null;
  financePersonEmail: string | null;
  gstRegistered: boolean;
  gstNo: string | null;
  panNo: string | null;
  tanNo: string | null;
  gstCountry: string | null;
  gstState: string | null;
  gstCity: string | null;
  gstPin: string | null;
  gstAddress: string | null;
  gstDocumentKey: string | null;
  gstDocumentStatus: "PENDING" | "APPROVED" | "REJECTED";
  msme: boolean;
  bankBeneficiaryName: string | null;
  bankAccountNo: string | null;
  bankType: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  cancelChequeKey: string | null;
  walletTermsAcceptedAt: string | null;
};

type Branch = { id: string; label: string; gstNo: string | null; address: string | null };
type IndemnityCountry = { id: string; name: string; text: string | null; accepted: boolean };

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-stamp-600",
  APPROVED: "text-teal-600",
  REJECTED: "text-danger",
};

export function ProfileForm({
  partner,
  salesPersons,
  branches: initialBranches,
  indemnityCountries: initialIndemnity,
}: {
  partner: Profile;
  salesPersons: { id: string; name: string }[];
  branches: Branch[];
  indemnityCountries: IndemnityCountry[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(partner);
  const [branches, setBranches] = useState(initialBranches);
  const [indemnity, setIndemnity] = useState(initialIndemnity);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ label: "", gstNo: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone ?? undefined,
          invoiceFrequency: form.invoiceFrequency,
          contactPersonName: form.contactPersonName ?? undefined,
          contactPersonEmail: form.contactPersonEmail ?? undefined,
          contactPersonMobile: form.contactPersonMobile ?? undefined,
          salesPersonId: form.salesPersonId ?? undefined,
          financePersonEmail: form.financePersonEmail ?? undefined,
          gstRegistered: form.gstRegistered,
          gstNo: form.gstNo ?? undefined,
          panNo: form.panNo ?? undefined,
          tanNo: form.tanNo ?? undefined,
          gstCountry: form.gstCountry ?? undefined,
          gstState: form.gstState ?? undefined,
          gstCity: form.gstCity ?? undefined,
          gstPin: form.gstPin ?? undefined,
          gstAddress: form.gstAddress ?? undefined,
          msme: form.msme,
          bankBeneficiaryName: form.bankBeneficiaryName ?? undefined,
          bankAccountNo: form.bankAccountNo ?? undefined,
          bankType: form.bankType ?? undefined,
          bankName: form.bankName ?? undefined,
          bankIfsc: form.bankIfsc ?? undefined,
          walletTermsAccepted: !!form.walletTermsAcceptedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save your profile.");
        return;
      }
      setMessage("Profile saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function uploadDoc(kind: "GST" | "CANCEL_CHEQUE", file: File) {
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    const res = await fetch("/api/profile/documents", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Upload failed.");
      return;
    }
    if (kind === "GST") update("gstDocumentKey", data.partner.gstDocumentKey);
    else update("cancelChequeKey", data.partner.cancelChequeKey);
    router.refresh();
  }

  async function addBranch() {
    if (!newBranch.label.trim()) return;
    const res = await fetch("/api/partners/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBranch),
    });
    const data = await res.json();
    if (res.ok) {
      setBranches((b) => [...b, data.branch]);
      setNewBranch({ label: "", gstNo: "", address: "" });
      setShowAddBranch(false);
    }
  }

  async function acceptIndemnity(countryId: string) {
    const res = await fetch("/api/indemnity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryId }),
    });
    if (res.ok) {
      setIndemnity((list) => list.map((c) => (c.id === countryId ? { ...c, accepted: true } : c)));
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Company / contact */}
      <Section title="Profile update">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Company name">
            <input required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className="input" />
          </Field>
          <Field label="Email ID">
            <input type="email" required value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} className="input" />
          </Field>
          <Field label="Mobile no.">
            <input value={form.contactPhone ?? ""} onChange={(e) => update("contactPhone", e.target.value)} className="input" />
          </Field>
          <Field label="Invoice frequency">
            <select value={form.invoiceFrequency} onChange={(e) => update("invoiceFrequency", e.target.value as Profile["invoiceFrequency"])} className="input">
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </Field>
          <Field label="Contact person name">
            <input value={form.contactPersonName ?? ""} onChange={(e) => update("contactPersonName", e.target.value)} className="input" />
          </Field>
          <Field label="Contact person email">
            <input type="email" value={form.contactPersonEmail ?? ""} onChange={(e) => update("contactPersonEmail", e.target.value)} className="input" />
          </Field>
          <Field label="Contact person mobile no.">
            <input value={form.contactPersonMobile ?? ""} onChange={(e) => update("contactPersonMobile", e.target.value)} className="input" />
          </Field>
          <Field label="Sales person name">
            <select value={form.salesPersonId ?? ""} onChange={(e) => update("salesPersonId", e.target.value || null)} className="input">
              <option value="">Unassigned</option>
              {salesPersons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Finance person email">
            <input type="email" value={form.financePersonEmail ?? ""} onChange={(e) => update("financePersonEmail", e.target.value)} className="input" />
          </Field>
        </div>
      </Section>

      {/* GST */}
      <Section title="GST">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.gstRegistered} onChange={(e) => update("gstRegistered", e.target.checked)} />
          Registered
        </label>
        <div className="grid grid-cols-3 gap-4">
          <Field label="GST no."><input value={form.gstNo ?? ""} onChange={(e) => update("gstNo", e.target.value)} className="input" /></Field>
          <Field label="PAN no."><input value={form.panNo ?? ""} onChange={(e) => update("panNo", e.target.value)} className="input" /></Field>
          <Field label="TAN no."><input value={form.tanNo ?? ""} onChange={(e) => update("tanNo", e.target.value)} className="input" /></Field>
          <Field label="Country"><input value={form.gstCountry ?? ""} onChange={(e) => update("gstCountry", e.target.value)} className="input" /></Field>
          <Field label="State"><input value={form.gstState ?? ""} onChange={(e) => update("gstState", e.target.value)} className="input" /></Field>
          <Field label="City"><input value={form.gstCity ?? ""} onChange={(e) => update("gstCity", e.target.value)} className="input" /></Field>
          <Field label="Pin"><input value={form.gstPin ?? ""} onChange={(e) => update("gstPin", e.target.value)} className="input" /></Field>
        </div>
        <div className="mt-4">
          <Field label="Address">
            <textarea rows={2} value={form.gstAddress ?? ""} onChange={(e) => update("gstAddress", e.target.value)} className="input" />
          </Field>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-ink/70">GST certificate / PAN card copy</label>
          <div className="mt-1 flex items-center gap-3">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && uploadDoc("GST", e.target.files[0])} className="text-sm" />
            {form.gstDocumentKey && (
              <span className={`text-xs font-medium ${STATUS_COLOR[form.gstDocumentStatus]}`}>
                Status — {form.gstDocumentStatus}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* MSME */}
      <Section title="MSME">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.msme} onChange={(e) => update("msme", e.target.checked)} />
          MSME registered
        </label>
      </Section>

      {/* Indemnity */}
      {indemnity.length > 0 && (
        <Section title="Indemnity letter">
          <ul className="space-y-3">
            {indemnity.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 text-sm">
                <div>
                  <p className="text-ink/80">{c.text ?? `Indemnity terms for ${c.name} visas.`}</p>
                </div>
                {c.accepted ? (
                  <span className="whitespace-nowrap text-teal-600">Accepted</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => acceptIndemnity(c.id)}
                    className="whitespace-nowrap rounded-sm border border-teal-500 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                  >
                    Accept {c.name} terms
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Bank */}
      <Section title="Bank">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Beneficiary name"><input value={form.bankBeneficiaryName ?? ""} onChange={(e) => update("bankBeneficiaryName", e.target.value)} className="input" /></Field>
          <Field label="Bank A/C"><input value={form.bankAccountNo ?? ""} onChange={(e) => update("bankAccountNo", e.target.value)} className="input" /></Field>
          <Field label="Bank type"><input value={form.bankType ?? ""} onChange={(e) => update("bankType", e.target.value)} className="input" /></Field>
          <Field label="Bank name"><input value={form.bankName ?? ""} onChange={(e) => update("bankName", e.target.value)} className="input" /></Field>
          <Field label="IFSC"><input value={form.bankIfsc ?? ""} onChange={(e) => update("bankIfsc", e.target.value)} className="input" /></Field>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-ink/70">Cancelled cheque</label>
          <div className="mt-1 flex items-center gap-3">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && uploadDoc("CANCEL_CHEQUE", e.target.files[0])} className="text-sm" />
            {form.cancelChequeKey && <span className="text-xs text-teal-600">Uploaded</span>}
          </div>
        </div>
      </Section>

      {/* Branches */}
      <Section title="Branches">
        {branches.length > 0 && (
          <ul className="mb-4 space-y-2">
            {branches.map((b) => (
              <li key={b.id} className="rounded-sm border border-line bg-paper px-3 py-2 text-sm">
                <span className="font-medium">{b.label}</span>
                {b.gstNo && <span className="text-ink/50"> — GST {b.gstNo}</span>}
              </li>
            ))}
          </ul>
        )}
        {showAddBranch ? (
          <div className="space-y-3 rounded-sm border border-dashed border-line p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Branch label">
                <input value={newBranch.label} onChange={(e) => setNewBranch((b) => ({ ...b, label: e.target.value }))} className="input" />
              </Field>
              <Field label="GST no. (optional)">
                <input value={newBranch.gstNo} onChange={(e) => setNewBranch((b) => ({ ...b, gstNo: e.target.value }))} className="input" />
              </Field>
            </div>
            <Field label="Address (optional)">
              <input value={newBranch.address} onChange={(e) => setNewBranch((b) => ({ ...b, address: e.target.value }))} className="input" />
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={addBranch} className="rounded-sm bg-teal-500 px-4 py-1.5 text-sm font-medium text-paper hover:bg-teal-600">
                Save branch
              </button>
              <button type="button" onClick={() => setShowAddBranch(false)} className="text-sm text-ink/50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddBranch(true)}
            className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600"
          >
            + Add other branch
          </button>
        )}
      </Section>

      {/* Terms */}
      <Section title="Terms & conditions">
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink/70">
          <li>I agree to make an online deposit of money into the designated wallet, under the name of my company/travel agency.</li>
          <li>I authorize the company to debit my wallet for visa applications uploaded by my company/travel agency.</li>
          <li>I will not dispute any debit transactions in the wallet processed per applicant details I provided.</li>
          <li>The currency of the wallet shall be Indian Rupees (INR).</li>
        </ul>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={!!form.walletTermsAcceptedAt}
            onChange={(e) => update("walletTermsAcceptedAt", e.target.checked ? new Date().toISOString() : null)}
          />
          I agree
        </label>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-teal-600">{message}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-sm bg-teal-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-line bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink/50">{title}</h2>
      {children}
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
