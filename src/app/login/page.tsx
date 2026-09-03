"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const next = searchParams.get("next");
      router.push(next ?? (data.role === "ADMIN" ? "/admin/dashboard" : "/partner/dashboard"));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink/80">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink/80">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>

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
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/60">
        <Link href="/forgot-password" className="font-medium text-teal-600">
          Forgot password?
        </Link>
      </p>

      <p className="mt-4 text-sm text-ink/60">
        New partner?{" "}
        <Link href="/register" className="font-medium text-teal-600">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src="/images/passport-takeoff.jpg"
          alt=""
          className="gate-atmosphere h-full w-full object-cover object-[center_45%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/90 via-paper/75 to-paper/40" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-sm border border-line/70 bg-white/85 p-6 shadow-sm backdrop-blur-sm">
        <Link href="/" className="font-display text-xl text-teal-700">
          Visamile
        </Link>
        <h1 className="mt-6 text-2xl font-medium text-ink">Log in</h1>
        <p className="mt-1 text-sm text-ink/60">Partner and internal ops accounts both sign in here.</p>

        <Suspense fallback={<p className="mt-8 text-sm text-ink/60">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
