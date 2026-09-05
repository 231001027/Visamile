import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TravelerDemoCheckout } from "@/components/TravelerDemoCheckout";

export const dynamic = "force-dynamic";

export default async function TravelerDemoCheckoutPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") redirect("/login");

  const orderId = searchParams.orderId;
  if (!orderId) notFound();

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order || order.consumerUserId !== session.sub || order.purpose !== "CASE_PAYMENT") {
    notFound();
  }

  if (order.status === "SUCCESS") {
    const caseIds = (order.caseIds as string[] | null) ?? [];
    redirect(caseIds.length === 1 ? `/consumer/cases/${caseIds[0]}` : "/consumer/dashboard");
  }

  const caseIds = (order.caseIds as string[] | null) ?? [];
  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds }, consumerUserId: session.sub },
    select: { id: true, referenceNo: true, currency: true },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e8f2ef] to-[#f7f7f3] px-6 py-12">
      <TravelerDemoCheckout
        orderId={order.id}
        amount={Number(order.amount)}
        currency={cases[0]?.currency ?? "INR"}
        referenceNos={cases.map((c) => c.referenceNo)}
        caseIds={cases.map((c) => c.id)}
      />
    </main>
  );
}
