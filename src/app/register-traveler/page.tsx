"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { AnimatedCountryBackdrop } from "@/components/marketing/AnimatedCountryBackdrop";

const TRAVELER_BACKDROP = ["ARE", "THA", "SGP", "VNM", "IDN", "AUS", "QAT", "OMN", "SAU", "GEO"];

function RegisterConsumerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-consumer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
        }),
      });
      const text = await res.text();
      let data: { error?: string; role?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(res.ok ? "Unexpected response." : `Server error (${res.status}). Try again.`);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create account.");
        return;
      }
      const countryId = searchParams.get("countryId");
      const visaTypeId = searchParams.get("visaTypeId");
      const q = new URLSearchParams();
      if (countryId) q.set("countryId", countryId);
      if (visaTypeId) q.set("visaTypeId", visaTypeId);
      const next =
        q.toString().length > 0
          ? `/consumer/cases/new?${q.toString()}`
          : "/consumer/cases/new";
      router.push(next);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <AnimatedCountryBackdrop
        countries={TRAVELER_BACKDROP}
        overlayClassName="bg-gradient-to-b from-black/45 via-black/35 to-black/50"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-md">
        <BrandLogo href="/" size="md" />
        <h1 className="mt-6 text-2xl font-medium text-ink">Traveler account</h1>
        <p className="mt-1 text-sm text-ink/60">Apply for your own visa and track status end to end.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {(
            [
              ["name", "Full name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone (optional)", "text"],
              ["password", "Password", "password"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-ink/80">{label}</label>
              <input
                type={type}
                required={key !== "phone"}
                minLength={key === "password" ? 8 : undefined}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="input mt-1"
              />
            </div>
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-teal-500 px-4 py-2.5 text-sm font-medium text-paper hover:bg-teal-600 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create traveler account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink/60">
          Agency?{" "}
          <Link href="/register" className="font-medium text-teal-600">
            Partner signup
          </Link>
          {" · "}
          <Link
            href={`/login?next=${encodeURIComponent(
              (() => {
                const countryId = searchParams.get("countryId");
                const visaTypeId = searchParams.get("visaTypeId");
                const q = new URLSearchParams();
                if (countryId) q.set("countryId", countryId);
                if (visaTypeId) q.set("visaTypeId", visaTypeId);
                return q.toString()
                  ? `/consumer/cases/new?${q.toString()}`
                  : "/consumer/cases/new";
              })()
            )}`}
            className="font-medium text-teal-600"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterConsumerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink/60">
          Loading…
        </main>
      }
    >
      <RegisterConsumerForm />
    </Suspense>
  );
}
