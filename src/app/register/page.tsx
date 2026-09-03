"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    country: "",
    contactEmail: "",
    contactPhone: "",
    adminName: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/partner/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-xl text-teal-700">
          Visamile
        </Link>
        <h1 className="mt-6 text-2xl font-medium text-ink">Create a partner account</h1>
        <p className="mt-1 text-sm text-ink/60">
          New accounts start in review — our team approves before you can submit paid cases.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Company name">
            <input
              required
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Country">
            <input
              required
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Your name">
            <input
              required
              value={form.adminName}
              onChange={(e) => update("adminName", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Work email">
            <input
              type="email"
              required
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="input"
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-teal-500 px-4 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal-600">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink/80">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
