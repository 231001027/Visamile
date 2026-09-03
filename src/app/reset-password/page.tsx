"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Reset failed.");
        return;
      }
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-danger">Invalid reset link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink/70">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-1 w-full"
          minLength={8}
          required
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-teal-500 py-2.5 font-medium text-paper hover:bg-teal-600 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-2xl font-medium">Reset password</h1>
      <Suspense fallback={<p className="mt-4 text-sm text-ink/60">Loading…</p>}>
        <ResetForm />
      </Suspense>
      <p className="mt-6 text-sm text-ink/60">
        <Link href="/login" className="text-teal-600 hover:underline">
          Back to login
        </Link>
      </p>
    </main>
  );
}
