import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/processor/dashboard", label: "Verification queue" },
];

export default async function ProcessorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "PROCESSOR") redirect("/login");

  return (
    <AppShell areaLabel="Processor portal" userName={session.name} links={LINKS} atmosphere>
      {children}
    </AppShell>
  );
}
