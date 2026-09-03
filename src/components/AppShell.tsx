import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

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
    <div className="flex min-h-screen">
      <aside className="relative z-20 flex w-60 shrink-0 flex-col border-r border-line bg-white px-5 py-6">
        <div>
          <div className="font-display text-lg text-teal-700">Visamile</div>
          <div className="mt-0.5 text-xs uppercase tracking-wide text-ink/40">{areaLabel}</div>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-sm px-3 py-2 text-sm text-ink/70 hover:bg-teal-50 hover:text-teal-700"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="truncate text-sm text-ink/70">{userName}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="relative isolate min-h-screen flex-1 overflow-hidden px-8 py-8">
        {atmosphere && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <img
              src="/images/passport-takeoff.jpg"
              alt=""
              className="gate-atmosphere h-full w-full object-cover object-[center_55%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-paper/90 via-paper/50 to-paper/15" />
          </div>
        )}
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
