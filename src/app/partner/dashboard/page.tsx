import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const session = await getSession();
  const partnerId = session!.partnerId!;

  const [partner, cases, lastTxn] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId } }),
    prisma.case.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      include: { visaType: { include: { country: true } } },
      take: 50,
    }),
    prisma.walletTransaction.findFirst({ where: { partnerId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">Cases</h1>
          <p className="mt-1 text-sm text-ink/60">{partner?.companyName}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-ink/40">Wallet balance</div>
          <div className="font-display text-xl text-teal-700">
            ₹{Number(lastTxn?.balanceAfter ?? 0).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {partner?.status !== "APPROVED" && (
        <div className="mb-6 rounded-sm border border-stamp-500 bg-stamp-400/10 px-4 py-3 text-sm text-stamp-600">
          {partner?.status === "PENDING"
            ? "Your account is pending approval. You can explore the dashboard, but case submission is disabled until an admin approves your account."
            : "Your account is suspended. Contact support to reactivate case submission."}
        </div>
      )}

      {cases.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-sm border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-teal-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/partner/cases/${c.id}`} className="font-medium text-teal-700">
                      {c.referenceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.applicantFirstName} {c.applicantLastName}</td>
                  <td className="px-4 py-3">
                    {c.visaType.country.name} — {c.visaType.name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusStamp status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {c.createdAt.toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-sm border border-dashed border-line bg-white px-6 py-16 text-center">
      <p className="text-ink/70">No cases yet.</p>
      <Link
        href="/partner/cases/new"
        className="mt-4 inline-block rounded-sm bg-teal-500 px-4 py-2 text-sm font-medium text-paper hover:bg-teal-600"
      >
        Create your first case
      </Link>
    </div>
  );
}
