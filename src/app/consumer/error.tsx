"use client";

export default function ConsumerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-sm border border-line bg-white p-6 text-center">
      <h1 className="text-lg font-medium text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink/60">
        The traveler page failed to load. Try again, or go back to your applications.
      </p>
      {error.digest && <p className="mt-2 text-xs text-ink/40">Ref: {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600"
        >
          Try again
        </button>
        <a href="/consumer/dashboard" className="rounded-sm border border-line px-4 py-2 text-sm text-ink/70 hover:bg-ink/[0.03]">
          My applications
        </a>
      </div>
    </div>
  );
}
