"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  expectedByDate,
  flagUrl,
  formatExpected,
  formatInr,
  formatValidity,
  placesForIso,
  type MarketingCountry,
  type MarketingPackage,
  visualForIso,
} from "@/lib/marketingCatalog";

type Props = {
  countries: MarketingCountry[];
};

const TRUST_PILLS = ["CLEAR TIMELINES", "LIVE TRACKING", "TRANSPARENT FEES"];

const STATS = [
  { label: "destinations live", value: "20+" },
  { label: "cases tracked end-to-end", value: "Live" },
  { label: "document checks", value: "Built-in" },
  { label: "human support", value: "Chat" },
  { label: "payments", value: "UPI · Card" },
];

const STEPS = [
  {
    n: "01",
    title: "Tell us where you’re flying",
    body: "Pick your passport and destination. We show the exact visa package, fee in INR, and expected processing window.",
  },
  {
    n: "02",
    title: "Upload once — we handle paperwork",
    body: "Snap your passport and photo. Visamile pre-fills fields, checks every document, and routes your case to verifiers.",
  },
  {
    n: "03",
    title: "Track live, travel ready",
    body: "Follow each status in your dashboard — from payment to document review to embassy submission updates.",
  },
];

const FEATURES = [
  {
    title: "Clear delivery windows",
    body: "Every package shows processing days before you pay — no surprise embassies timelines buried in fine print.",
  },
  {
    title: "Document checklist per country",
    body: "Upload exactly what’s needed. Additional requests from verifiers show up as a clear list you can finish in one go.",
  },
  {
    title: "Live case tracking",
    body: "Watch your application move in real time — payment, verification, and status stamps in one place.",
  },
  {
    title: "Transparent INR pricing",
    body: "Government fee and service charges shown up front. Card and UPI checkout for travelers.",
  },
];

const FAQS = [
  {
    q: "Do I need a visa for my destination?",
    a: "Choose your destination above — we’ll show the eVisa or sticker package we support, the fee, and typical processing time.",
  },
  {
    q: "How long does it take?",
    a: "It depends on the destination. Each card shows an expected-by date based on the package’s processing days.",
  },
  {
    q: "What documents do I need?",
    a: "Most eVisas need passport pages and a photo. Extra items are listed on the apply form before you pay.",
  },
  {
    q: "Can I apply for family?",
    a: "Yes — create a case per traveler, or ask your partner agency to submit multiple applicants for you.",
  },
  {
    q: "Who decides the visa?",
    a: "Visamile facilitates documentation and submission. Final approval is always by the embassy or consulate.",
  },
];

const REVIEWS = [
  {
    quote:
      "Applied for UAE in minutes. Fees were clear, documents checklist was exact, and status updates meant I wasn’t guessing.",
    name: "Ananya M.",
    meta: "UAE eVisa",
  },
  {
    quote:
      "Singapore package with courier charge shown upfront — no surprises at payment. Tracking after upload was smooth.",
    name: "Rohit K.",
    meta: "Singapore eVisa",
  },
  {
    quote:
      "Uzbekistan single vs multiple entry options were easy to pick. The apply flow felt like a modern travel app.",
    name: "Priya S.",
    meta: "Uzbekistan eVisa",
  },
];

function applyHref(pkg?: MarketingPackage | null) {
  if (!pkg) return "/register-traveler";
  const q = new URLSearchParams({
    countryId: pkg.countryId,
    visaTypeId: pkg.visaTypeId,
  });
  return `/register-traveler?${q.toString()}`;
}

function categoryLabel(cat: string) {
  if (cat === "E_VISA") return "E-VISA";
  if (cat === "STICKER_VISA") return "STICKER";
  return cat;
}

export function HomeLanding({ countries }: Props) {
  const allPackages = useMemo(
    () => countries.flatMap((c) => c.packages),
    [countries]
  );

  const featured = useMemo(() => {
    const prefer = ["ARE", "SGP", "THA", "VNM", "SAU", "IDN", "OMN", "QAT", "BHR", "GEO"];
    const ranked = [...allPackages].sort((a, b) => {
      const ai = prefer.indexOf(a.isoCode);
      const bi = prefer.indexOf(b.isoCode);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return ranked.slice(0, Math.min(12, ranked.length));
  }, [allPackages]);

  const [heroIndex, setHeroIndex] = useState(0);
  const [destinationIso, setDestinationIso] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);

  const selectedCountry = countries.find((c) => c.isoCode === destinationIso);
  const selectedPkg = selectedCountry?.packages[0] ?? null;

  /** When a destination is picked, rotate that country’s tourist places; otherwise tour featured countries. */
  const heroSlides = useMemo(() => {
    if (destinationIso) {
      const places = placesForIso(destinationIso);
      const v = visualForIso(destinationIso);
      return places.map((p) => ({
        key: `${destinationIso}-${p.image}`,
        image: p.image,
        gradient: v.gradient,
        placeLabel: p.label,
        countryName: selectedCountry?.name ?? destinationIso,
        feeInr: selectedPkg?.feeInr,
        processingDays: selectedPkg?.processingDays,
      }));
    }
    return featured.map((pkg) => {
      const places = placesForIso(pkg.isoCode);
      const place = places[0];
      const v = visualForIso(pkg.isoCode);
      return {
        key: pkg.visaTypeId,
        image: place?.image ?? v.image,
        gradient: v.gradient,
        placeLabel: place?.label ?? pkg.countryName,
        countryName: pkg.countryName,
        feeInr: pkg.feeInr,
        processingDays: pkg.processingDays,
      };
    });
  }, [destinationIso, featured, selectedCountry?.name, selectedPkg]);

  const heroSlide = heroSlides[heroIndex % Math.max(heroSlides.length, 1)] ?? heroSlides[0];

  useEffect(() => {
    setHeroIndex(0);
  }, [destinationIso]);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const id = window.setInterval(() => {
      startTransition(() => {
        setHeroIndex((i) => (i + 1) % heroSlides.length);
      });
    }, 4200);
    return () => window.clearInterval(id);
  }, [heroSlides.length, destinationIso]);

  const visiblePackages = showAll ? allPackages : featured;

  return (
    <div className="marketing-root min-h-screen bg-[#0b0f0e] text-white">
      {/* —— Hero —— */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          {heroSlides.map((slide, i) => {
            const active = i === heroIndex % heroSlides.length;
            return (
              <div
                key={slide.key}
                className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt=""
                  className={`h-full w-full object-cover transition-transform duration-[8000ms] ease-out ${
                    active ? "scale-110" : "scale-100"
                  }`}
                />
                <div
                  className="absolute inset-0 opacity-40"
                  style={{ background: slide.gradient }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-[#0b0f0e]/90" />
              </div>
            );
          })}
        </div>

        <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <BrandLogo href="/" variant="transparent" size="lg" priority />
          <nav className="flex items-center gap-4 text-sm sm:gap-6">
            <a href="#destinations" className="hidden text-white/75 hover:text-white sm:inline">
              Destinations
            </a>
            <a href="#how" className="hidden text-white/75 hover:text-white sm:inline">
              How it works
            </a>
            <LoginDropdown />
            <Link
              href="/register-traveler"
              className="rounded-full bg-white px-4 py-2 font-semibold text-[#0b0f0e] transition hover:bg-white/90"
            >
              Apply now
            </Link>
          </nav>
        </header>

        <div className="relative z-20 mx-auto flex max-w-6xl flex-col px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
          <div className="mb-5 inline-flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagUrl("IND", 40)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
            Indian passports · {countries.length}+ destinations
          </div>

          <h1 className="font-display max-w-3xl text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Your visa.
            <br />
            On time.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Tell us your passport and destination. We show the exact visa, fee in INR, and when you
            can expect it — then guide you through apply, pay, and track.
          </p>

          {/* Passport + destination picker */}
          <div className="mt-8 max-w-2xl rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block rounded-xl bg-white/95 px-3 py-2.5 text-[#0b0f0e]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">
                  Passport
                </span>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flagUrl("IND", 40)} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                  India
                </div>
              </label>
              <label className="block rounded-xl bg-white/95 px-3 py-2.5 text-[#0b0f0e]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-black/45">
                  Traveling to
                </span>
                <select
                  className="mt-0.5 w-full bg-transparent text-sm font-semibold outline-none"
                  value={destinationIso}
                  onChange={(e) => setDestinationIso(e.target.value)}
                >
                  <option value="">Select a destination</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.isoCode}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                href={applyHref(selectedPkg)}
                className="flex items-center justify-center rounded-xl bg-[#0f4c42] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0c3e36]"
              >
                Check visa requirements
              </Link>
            </div>
            {heroSlide && (
              <p className="mt-3 text-xs text-white/70">
                {destinationIso ? (
                  <>
                    Exploring{" "}
                    <span className="font-semibold text-white">{heroSlide.countryName}</span>
                    {" — "}
                    <span className="text-white/90">{heroSlide.placeLabel}</span>
                    {heroSlide.feeInr != null && heroSlide.processingDays != null && (
                      <>
                        {" · "}
                        {formatInr(heroSlide.feeInr)} · expected by{" "}
                        {formatExpected(expectedByDate(heroSlide.processingDays))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Now featuring{" "}
                    <span className="font-semibold text-white">{heroSlide.countryName}</span>
                    {heroSlide.feeInr != null && heroSlide.processingDays != null && (
                      <>
                        {" · "}
                        {formatInr(heroSlide.feeInr)} · expected by{" "}
                        {formatExpected(expectedByDate(heroSlide.processingDays))}
                      </>
                    )}
                  </>
                )}
              </p>
            )}
          </div>

          <ul className="mt-6 flex flex-wrap gap-2">
            {TRUST_PILLS.map((p) => (
              <li
                key={p}
                className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/85"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* —— Stats strip —— */}
      <section className="border-y border-white/10 bg-[#0f1412]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-5 sm:px-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl font-semibold sm:text-3xl">{s.value}</div>
              <div className="mt-1 text-xs text-white/55">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* —— Destinations —— */}
      <section id="destinations" className="bg-[#0b0f0e] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Popular from India
              </h2>
              <p className="mt-2 max-w-xl text-white/60">
                Live packages and fees in INR for Indian passport holders. No hidden charges on the
                listed total.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold text-[#e1a73b] hover:underline"
            >
              {showAll ? "Show featured" : `See all ${allPackages.length} packages`}
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePackages.map((pkg, i) => (
              <DestinationCard
                key={pkg.visaTypeId}
                pkg={pkg}
                featured={!destinationIso && i === heroIndex && !showAll}
                onHover={() => {
                  if (!showAll && !destinationIso) {
                    const idx = featured.findIndex((p) => p.visaTypeId === pkg.visaTypeId);
                    if (idx >= 0) setHeroIndex(idx);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* —— Steps —— */}
      <section id="how" className="border-t border-white/10 bg-[#101614] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your visa in three steps
          </h2>
          <p className="mt-2 max-w-xl text-white/60">
            No embassy queues, no confusing forms. Visamile does the ops — you travel.
          </p>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <div className="font-display text-5xl font-semibold text-white/15">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/register-traveler"
            className="mt-10 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0f0e] hover:bg-white/90"
          >
            Start your application
          </Link>
        </div>
      </section>

      {/* —— Features —— */}
      <section className="bg-[#0b0f0e] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your visa comes with more
          </h2>
          <p className="mt-2 max-w-xl text-white/60">
            Clear timelines, live tracking, and human support — with transparent fees in INR.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* —— FAQ —— */}
      <section className="border-t border-white/10 bg-[#101614] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-2 text-white/60">
            Still unsure?{" "}
            <Link href="/register-traveler" className="font-semibold text-[#e1a73b] hover:underline">
              Start an application
            </Link>{" "}
            or log in to chat with support once your case is open.
          </p>
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <button
                  key={item.q}
                  type="button"
                  className="w-full py-5 text-left"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold">{item.q}</span>
                    <span className="text-white/40">{open ? "−" : "+"}</span>
                  </div>
                  <div
                    className={`grid transition-all duration-300 ${
                      open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <p className="overflow-hidden text-sm leading-relaxed text-white/60">{item.a}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* —— Reviews —— */}
      <section className="bg-[#0b0f0e] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Traveler stories
          </h2>
          <p className="mt-2 text-white/60">What Indian travelers say about applying with Visamile.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <blockquote
                key={r.name}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="flex-1 text-sm leading-relaxed text-white/80">“{r.quote}”</p>
                <footer className="mt-5 text-xs text-white/50">
                  <span className="font-semibold text-white/80">{r.name}</span> · {r.meta}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* —— Partner CTA —— */}
      <section className="border-t border-white/10 bg-[#0f4c42] px-5 py-14 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Travel agency or consultant?
            </h2>
            <p className="mt-2 max-w-lg text-white/80">
              Partner portal with wallet, bulk apply, and wholesale rates — same destinations your
              travelers see here.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0f4c42] hover:bg-white/90"
            >
              Become a partner
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Partner login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 text-xs text-white/40 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo href="/" variant="transparent" size="sm" />
          <p className="max-w-xl leading-relaxed">
            Visamile facilitates documentation and submission only. Visa decisions are made solely by
            the relevant embassy or consulate — approval is never guaranteed.
          </p>
        </div>
      </footer>
    </div>
  );
}

const LOGIN_OPTIONS = [
  {
    label: "Traveler",
    hint: "Apply & track your own visa",
    href: `/login?as=traveler&next=${encodeURIComponent("/consumer/dashboard")}`,
  },
  {
    label: "Partner agency",
    hint: "Wholesale portal & wallet",
    href: `/login?as=partner&next=${encodeURIComponent("/partner/dashboard")}`,
  },
  {
    label: "Agent",
    hint: "Agency staff / branch login",
    href: `/login?as=agent&next=${encodeURIComponent("/partner/dashboard")}`,
  },
  {
    label: "Verifier",
    hint: "Document review queue",
    href: `/login?as=verifier&next=${encodeURIComponent("/processor/dashboard")}`,
  },
  {
    label: "Admin",
    hint: "Ops & catalog control",
    href: `/login?as=admin&next=${encodeURIComponent("/admin/dashboard")}`,
  },
] as const;

function LoginDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-white/80 hover:text-white"
      >
        Log in
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-xl border border-white/15 bg-[#121816]/95 py-1 shadow-2xl backdrop-blur-xl"
        >
          {LOGIN_OPTIONS.map((opt) => (
            <Link
              key={opt.label}
              role="menuitem"
              href={opt.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 transition hover:bg-white/10"
            >
              <span className="block text-sm font-semibold text-white">{opt.label}</span>
              <span className="block text-xs text-white/50">{opt.hint}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DestinationCard({
  pkg,
  featured,
  onHover,
}: {
  pkg: MarketingPackage;
  featured?: boolean;
  onHover?: () => void;
}) {
  const v = visualForIso(pkg.isoCode);
  const place = placesForIso(pkg.isoCode)[0];
  const expected = expectedByDate(pkg.processingDays);

  return (
    <Link
      href={applyHref(pkg)}
      onMouseEnter={onHover}
      className={`group relative block overflow-hidden rounded-2xl border transition ${
        featured
          ? "border-[#e1a73b]/60 ring-1 ring-[#e1a73b]/30"
          : "border-white/10 hover:border-white/30"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={place?.image ?? v.image}
          alt=""
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
        />
        <div
          className="absolute inset-0 opacity-45 transition duration-500 group-hover:opacity-35"
          style={{ background: v.gradient }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flagUrl(pkg.isoCode, 40)}
            alt=""
            className="h-4 w-6 rounded-sm object-cover shadow"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-xl font-semibold tracking-tight">{pkg.countryName}</h3>
          <p className="mt-0.5 text-xs text-white/70">{pkg.visaName}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide text-white/55">
            <div>
              <dt>Type</dt>
              <dd className="mt-0.5 text-xs font-semibold text-white">
                {categoryLabel(pkg.visaCategory)}
              </dd>
            </div>
            <div>
              <dt>Valid</dt>
              <dd className="mt-0.5 text-xs font-semibold text-white">
                {formatValidity(pkg.validityDays)}
              </dd>
            </div>
            <div>
              <dt>Fees</dt>
              <dd className="mt-0.5 text-xs font-semibold text-white">{formatInr(pkg.feeInr)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-white/70">
            Expected by{" "}
            <span className="font-semibold text-white">{formatExpected(expected)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
