import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin/dashboard", label: "Case queue" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/processors", label: "Processors" },
  { href: "/admin/catalog", label: "Catalog & pricing" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <AppShell areaLabel="Ops console" userName={session.name} links={LINKS}>
      {children}
    </AppShell>
  );
}
