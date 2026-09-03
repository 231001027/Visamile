"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterConsumerPage() {
  const router = useRouter();
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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create account.");
        return;
      }
      router.push("/consumer/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src="/images/passport-takeoff.jpg"
          alt=""
          className="gate-atmosphere h-full w-full object-cover object-[center_45%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/90 via-paper/75 to-paper/40" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-sm border border-line/70 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
        <Link href="/" className="font-display text-xl text-teal-700">
          Visamile
        </Link>
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
          <Link href="/login" className="font-medium text-teal-600">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
