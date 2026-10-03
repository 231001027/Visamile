"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { AnimatedCountryBackdrop } from "@/components/marketing/AnimatedCountryBackdrop";

/** Destination rotations tuned per login audience (same motion as home) */
const ROLE_BACKDROPS: Record<string, string[]> = {
  traveler: ["ARE", "THA", "SGP", "VNM", "IDN", "QAT", "GEO", "OMN"],
  partner: ["SAU", "ARE", "GBR", "AUS", "USA", "SGP", "THA", "FRA"],
  agent: ["THA", "VNM", "KHM", "IDN", "BHR", "QAT", "OMN", "ARE"],
  verifier: ["GBR", "USA", "AUS", "FRA", "AUT", "SGP", "ARE", "SAU"],
  admin: ["USA", "GBR", "ARE", "SAU", "SGP", "THA", "AUS", "RUS"],
};

function LoginForm({ asRole }: { asRole: string }) {
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
      const text = await res.text();
      let data: { error?: string; role?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(res.ok ? "Unexpected response." : `Sign-in failed (${res.status}). Try again.`);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      const next = searchParams.get("next");
      const fallback =
        data.role === "ADMIN"
          ? "/admin/dashboard"
          : data.role === "PROCESSOR"
            ? "/processor/dashboard"
            : data.role === "CONSUMER"
              ? "/consumer/dashboard"
              : "/partner/dashboard";
      router.push(next ?? fallback);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const signup =
    asRole === "traveler"
      ? { href: "/register-traveler", label: "Create traveler account" }
      : asRole === "partner" || asRole === "agent"
        ? { href: "/register", label: "Create partner account" }
        : null;

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

      {signup && (
        <p className="mt-4 text-sm text-ink/60">
          New here?{" "}
          <Link href={signup.href} className="font-medium text-teal-600">
            {signup.label}
          </Link>
        </p>
      )}
    </>
  );
}

const AS_COPY: Record<string, { title: string; subtitle: string }> = {
  traveler: {
    title: "Traveler log in",
    subtitle: "Track applications and continue your visa apply flow.",
  },
  partner: {
    title: "Partner log in",
    subtitle: "Agency portal — cases, wallet, and bulk apply.",
  },
  agent: {
    title: "Agent log in",
    subtitle: "Sign in with your agency staff account.",
  },
  verifier: {
    title: "Verifier log in",
    subtitle: "Open the document review and case queue.",
  },
  admin: {
    title: "Admin log in",
    subtitle: "Platform ops, catalog, and partner management.",
  },
};

function LoginShell() {
  const searchParams = useSearchParams();
  const as = (searchParams.get("as") || "").toLowerCase();
  const copy = AS_COPY[as] ?? {
    title: "Log in",
    subtitle: "Traveler, partner, agent, and ops accounts sign in here.",
  };
  const countries = ROLE_BACKDROPS[as] ?? [
    "ARE",
    "THA",
    "SGP",
    "VNM",
    "SAU",
    "IDN",
    "QAT",
    "GEO",
  ];

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <AnimatedCountryBackdrop countries={countries} />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-md">
        <BrandLogo href="/" size="md" />
        <h1 className="mt-6 text-2xl font-medium text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm text-ink/60">{copy.subtitle}</p>
        <LoginForm asRole={as} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0f0e] px-6">
          <p className="text-sm text-white/60">Loading…</p>
        </main>
      }
    >
      <LoginShell />
    </Suspense>
  );
}
