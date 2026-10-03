import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { BrandLogo } from "./BrandLogo";
import { AnimatedCountryBackdrop } from "./marketing/AnimatedCountryBackdrop";

const TRAVELER_ATMOSPHERE = ["ARE", "THA", "SGP", "VNM", "IDN", "QAT", "GEO", "OMN", "SAU", "BHR"];

export function AppShell({
  areaLabel,
  userName,
  links,
  children,
  atmosphere,
}: {
  areaLabel: string;
  userName: string;
  links: { href: string; label: string }[];
  children: React.ReactNode;
  atmosphere?: boolean;
}) {
  return (
    <div className="relative isolate flex min-h-screen">
      {atmosphere && (
        <AnimatedCountryBackdrop
          countries={TRAVELER_ATMOSPHERE}
          overlayClassName="bg-gradient-to-br from-paper/80 via-paper/45 to-paper/20"
        />
      )}

      <aside
        className={[
          "relative z-20 flex w-60 shrink-0 flex-col px-5 py-6",
          atmosphere
            ? "border-r border-white/30 bg-white/55 backdrop-blur-xl"
            : "border-r border-line bg-white",
        ].join(" ")}
      >
        <div>
          <BrandLogo href="/" variant="icon" size="sm" />
          <div
            className={[
              "mt-1.5 text-xs uppercase tracking-wide",
              atmosphere ? "text-ink/55" : "text-ink/40",
            ].join(" ")}
          >
            {areaLabel}
          </div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={[
                "rounded-sm px-3 py-2 text-sm transition",
                atmosphere
                  ? "text-ink/80 hover:bg-white/50 hover:text-teal-800"
                  : "text-ink/70 hover:bg-teal-50 hover:text-teal-700",
              ].join(" ")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div
          className={[
            "mt-6 flex items-center justify-between pt-4",
            atmosphere ? "border-t border-white/35" : "border-t border-line",
          ].join(" ")}
        >
          <span className="truncate text-sm text-ink/70">{userName}</span>
          <LogoutButton />
        </div>
      </aside>

      <main className="relative z-10 min-h-screen flex-1 overflow-auto px-8 py-8">
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
