import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { WalletTopupForm } from "@/components/WalletTopupForm";

export const dynamic = "force-dynamic";

const TXN_LABELS: Record<string, string> = {
  TOPUP: "Top-up",
  DEBIT: "Case debit",
  REFUND: "Refund",
  PAYOUT: "Payout",
};

export default async function PartnerWalletPage() {
  const session = await getSession();
  const partnerId = session!.partnerId!;

  const transactions = await prisma.walletTransaction.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { case: { select: { referenceNo: true } } },
  });
  const balance = transactions[0]?.balanceAfter ?? 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-medium text-ink">Wallet</h1>
      <div className="mt-4 rounded-sm border border-line bg-white p-5">
        <div className="text-xs uppercase tracking-wide text-ink/40">Current balance</div>
        <div className="font-display mt-1 text-3xl text-teal-700">
          ₹{Number(balance).toLocaleString("en-IN")}
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <WalletTopupForm />
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink/50">
        Transaction history
      </h2>
      <div className="overflow-hidden rounded-sm border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink/60">{t.createdAt.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">{TXN_LABELS[t.type] ?? t.type}</td>
                <td className="px-4 py-3 text-ink/60">{t.case?.referenceNo ?? t.note ?? "—"}</td>
                <td
                  className={`px-4 py-3 text-right ${
                    t.type === "TOPUP" || t.type === "REFUND" ? "text-teal-600" : "text-danger"
                  }`}
                >
                  {t.type === "TOPUP" || t.type === "REFUND" ? "+" : "-"}
                  {Number(t.amount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right">{Number(t.balanceAfter).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
