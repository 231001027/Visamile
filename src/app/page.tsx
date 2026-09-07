import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <img
          src="/images/flight-takeoff.jpg"
          alt=""
          className="gate-atmosphere h-full w-full object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/88 via-paper/55 to-paper/25" />
      </div>

      <header className="relative z-10 border-b border-line/60 bg-paper/55 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <BrandLogo href="/" variant="transparent" size="xl" priority />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-ink/70 hover:text-ink">
              Log in
            </Link>
            <Link href="/register-traveler" className="text-ink/70 hover:text-ink">
              Traveler signup
            </Link>
            <Link
              href="/register"
              className="rounded-sm bg-teal-500 px-4 py-2 font-medium text-paper hover:bg-teal-600"
            >
              Become a partner
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-stamp-600">
          For travel agencies &amp; immigration consultants
        </p>
        <h1 className="font-display max-w-3xl text-4xl leading-tight text-ink sm:text-5xl">
          Submit your clients&rsquo; visa applications. We handle the paperwork chase.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink/70">
          Visamile is the B2B partner portal for visa facilitation — wholesale pricing, document
          checklists per country, and real-time status without a single embassy phone call.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/register-traveler"
            className="rounded-sm bg-teal-500 px-6 py-3 font-medium text-paper hover:bg-teal-600"
          >
            Apply as a traveler
          </Link>
          <Link
            href="/register"
            className="rounded-sm border border-ink/20 bg-white/70 px-6 py-3 font-medium text-ink backdrop-blur-sm hover:bg-white"
          >
            Partner agency account
          </Link>
          <Link
            href="/login"
            className="rounded-sm border border-ink/20 bg-white/70 px-6 py-3 font-medium text-ink backdrop-blur-sm hover:bg-white"
          >
            Log in
          </Link>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-5xl px-6 py-10 text-xs text-ink/50">
        Visamile facilitates documentation and submission only. Visa decisions are made solely by
        the relevant embassy or consulate — approval is never guaranteed.
      </footer>
    </main>
  );
}
