import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { StatusStamp } from "@/components/StatusStamp";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConsumerDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") redirect("/login");

  const cases = await prisma.case.findMany({
    where: { consumerUserId: session.sub },
    orderBy: { createdAt: "desc" },
    include: { visaType: { include: { country: true } } },
    take: 50,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">My applications</h1>
          <p className="mt-1 text-sm text-ink/60">Track visa cases from payment through delivery.</p>
        </div>
        <Link
          href="/consumer/cases/new"
          className="rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600"
        >
          New application
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-sm border border-line bg-white/90">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-line/70 hover:bg-teal-50/40">
                <td className="px-4 py-3">
                  <Link href={`/consumer/cases/${c.id}`} className="font-medium text-teal-700 hover:underline">
                    {c.referenceNo}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {c.visaType.country.name} — {c.visaType.name}
                </td>
                <td className="px-4 py-3">
                  {c.applicantFirstName} {c.applicantLastName}
                </td>
                <td className="px-4 py-3">
                  <StatusStamp status={c.status} />
                </td>
                <td className="px-4 py-3">
                  ₹{(Number(c.govFeeSnapshot) + Number(c.serviceFeeSnapshot)).toFixed(2)}
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  No applications yet.{" "}
                  <Link href="/consumer/cases/new" className="text-teal-600 hover:underline">
                    Start one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
