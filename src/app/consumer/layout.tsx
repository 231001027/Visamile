import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/consumer/dashboard", label: "My applications" },
  { href: "/consumer/cases/new", label: "New application" },
];

export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") redirect("/login");

  return (
    <AppShell areaLabel="Traveler portal" userName={session.name} links={LINKS} atmosphere>
      {children}
    </AppShell>
  );
}
