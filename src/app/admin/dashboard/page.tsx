import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { CaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; status?: CaseStatus }[] = [
  { label: "Needs delivery" },
  { label: "Under verification", status: "UNDER_VERIFICATION" },
  { label: "With embassy", status: "SUBMITTED" },
  { label: "Approved", status: "APPROVED" },
  { label: "Awaiting more docs", status: "ADDITIONAL_DOCS_REQUESTED" },
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status as CaseStatus | undefined;

  const cases = await prisma.case.findMany({
    where: status
      ? { status }
      : {
          status: {
            in: ["UNDER_VERIFICATION", "SUBMITTED", "ADDITIONAL_DOCS_REQUESTED", "APPROVED"],
          },
        },
    orderBy: { createdAt: "asc" },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true } },
      consumer: { select: { name: true } },
      assignedProcessor: { select: { name: true } },
    },
    take: 100,
  });

  const earnings = await prisma.case.aggregate({
    where: { status: { in: ["APPROVED", "DELIVERED"] } },
    _sum: { platformFeeSnapshot: true, processorFeeSnapshot: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Platform case queue</h1>
      <p className="mt-1 text-sm text-ink/60">
        Final delivery is yours. Verification &amp; embassy handoff is done by processors.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-line bg-white px-4 py-3 text-sm">
          <div className="text-xs uppercase text-ink/40">Platform fees (approved+)</div>
          <div className="mt-1 text-lg font-medium">
            ₹{Number(earnings._sum.platformFeeSnapshot ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-sm border border-line bg-white px-4 py-3 text-sm">
          <div className="text-xs uppercase text-ink/40">Processor fees (approved+)</div>
          <div className="mt-1 text-lg font-medium">
            ₹{Number(earnings._sum.processorFeeSnapshot ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.status ? `/admin/dashboard?status=${f.status}` : "/admin/dashboard"}
            className={`rounded-sm border px-3 py-1.5 text-sm ${
              status === f.status
                ? "border-teal-500 bg-teal-50 text-teal-700"
                : "border-line bg-white text-ink/70 hover:bg-ink/[0.03]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Processor</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0 hover:bg-teal-50/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/cases/${c.id}`} className="font-medium text-teal-700">
                    {c.referenceNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.partner?.companyName ?? c.consumer?.name ?? "—"}</td>
                <td className="px-4 py-3">{c.assignedProcessor?.name ?? "Unassigned"}</td>
                <td className="px-4 py-3">
                  {c.applicantFirstName} {c.applicantLastName}
                </td>
                <td className="px-4 py-3">
                  {c.visaType.country.name} — {c.visaType.name}
                </td>
                <td className="px-4 py-3">
                  <StatusStamp status={c.status} />
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  No cases in this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
