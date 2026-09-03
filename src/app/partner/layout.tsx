import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/partner/dashboard", label: "Cases" },
  { href: "/partner/cases/new", label: "New case" },
  { href: "/partner/bulk-apply", label: "Bulk apply" },
  { href: "/partner/pending-payment", label: "Pending payment" },
  { href: "/partner/wallet", label: "Wallet" },
  { href: "/partner/profile", label: "Profile" },
];

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Defense in depth — middleware already redirects unauthenticated/wrong-role
  // requests before they reach here, but a Server Component should never
  // assume a request came through middleware unmodified.
  if (!session || session.role !== "PARTNER") redirect("/login");

  return (
    <AppShell areaLabel="Partner portal" userName={session.name} links={LINKS} atmosphere>
      {children}
    </AppShell>
  );
}
