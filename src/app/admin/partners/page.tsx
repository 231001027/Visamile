import { prisma } from "@/lib/prisma";
import { PartnerStatusActions } from "@/components/PartnerStatusActions";
import { CommissionPayoutButton } from "@/components/CommissionPayoutButton";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "text-stamp-600",
  APPROVED: "text-teal-600",
  SUSPENDED: "text-danger",
};

export default async function AdminPartnersPage() {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: true, users: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Partners</h1>
      <p className="mt-1 text-sm text-ink/60">
        New signups start Pending. Approve before they can submit paid cases.
      </p>

      <div className="mt-6 overflow-hidden rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Agent code</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">GST doc</th>
              <th className="px-4 py-3">Cases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
              <th className="px-4 py-3">Commission</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-ink/60">{p.agentCode ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{p.companyName}</td>
                <td className="px-4 py-3">{p.country}</td>
                <td className="px-4 py-3 text-ink/60">{p.contactEmail}</td>
                <td className="px-4 py-3 text-xs">
                  {p.gstDocumentKey ? p.gstDocumentStatus : <span className="text-ink/40">not uploaded</span>}
                </td>
                <td className="px-4 py-3">{p._count.cases}</td>
                <td className={`px-4 py-3 font-medium ${STATUS_STYLE[p.status]}`}>{p.status}</td>
                <td className="px-4 py-3">
                  <PartnerStatusActions partnerId={p.id} status={p.status} />
                </td>
                <td className="px-4 py-3">
                  {p.status === "APPROVED" && <CommissionPayoutButton partnerId={p.id} companyName={p.companyName} />}
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">
                  No partners have signed up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
