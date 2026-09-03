import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { StatusStamp } from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function ProcessorDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "PROCESSOR") redirect("/login");

  const cases = await prisma.case.findMany({
    where: {
      status: { in: ["UNDER_VERIFICATION", "SUBMITTED", "ADDITIONAL_DOCS_REQUESTED"] },
      OR: [{ assignedProcessorId: session.sub }, { assignedProcessorId: null }],
    },
    orderBy: { updatedAt: "asc" },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true } },
      consumer: { select: { name: true, email: true } },
    },
    take: 100,
  });

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Verification queue</h1>
      <p className="mt-1 text-sm text-ink/60">
        Verify documents, request extras, mark sent to embassy, then record the embassy outcome.
      </p>

      <div className="mt-8 overflow-hidden rounded-sm border border-line bg-white/90">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper/80 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-line/70 hover:bg-teal-50/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/processor/cases/${c.id}`}
                    className="font-medium text-teal-700 hover:underline"
                  >
                    {c.referenceNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {c.partner?.companyName ?? c.consumer?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {c.visaType.country.name}
                </td>
                <td className="px-4 py-3">
                  {c.applicantFirstName} {c.applicantLastName}
                </td>
                <td className="px-4 py-3">
                  <StatusStamp status={c.status} />
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  No cases in the verification queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
