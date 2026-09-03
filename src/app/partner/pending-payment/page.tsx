import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PendingPaymentTable } from "@/components/PendingPaymentTable";

export const dynamic = "force-dynamic";

export default async function PendingPaymentPage() {
  const session = await getSession();
  const partnerId = session!.partnerId!;

  const [cases, lastTxn] = await Promise.all([
    prisma.case.findMany({
      where: { partnerId, status: "PENDING_PAYMENT" },
      orderBy: { createdAt: "asc" },
      include: { visaType: { include: { country: true } } },
    }),
    prisma.walletTransaction.findFirst({ where: { partnerId }, orderBy: { createdAt: "desc" } }),
  ]);

  const walletBalance = Number(lastTxn?.balanceAfter ?? 0);

  const serializable = cases.map((c) => ({
    id: c.id,
    referenceNo: c.referenceNo,
    applicantFirstName: c.applicantFirstName,
    applicantLastName: c.applicantLastName,
    visaType: { name: c.visaType.name, country: { name: c.visaType.country.name } },
    departureDate: c.departureDate ? c.departureDate.toISOString() : null,
    returnDate: c.returnDate ? c.returnDate.toISOString() : null,
    govFeeSnapshot: c.govFeeSnapshot.toString(),
    serviceFeeSnapshot: c.serviceFeeSnapshot.toString(),
    currency: c.currency,
  }));

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Pending payment</h1>
      <p className="mt-1 text-sm text-ink/60">
        Select the cases you want to pay for and settle them from your wallet in one go. Nothing is
        submitted for embassy processing until it's paid.
      </p>
      <div className="mt-6">
        <PendingPaymentTable cases={serializable} walletBalance={walletBalance} />
      </div>
    </div>
  );
}
