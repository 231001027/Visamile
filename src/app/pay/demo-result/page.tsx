import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

export default async function TravelerDemoResultPage({
  searchParams,
}: {
  searchParams: { orderId?: string; status?: string };
}) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") redirect("/login");

  const orderId = searchParams.orderId;
  const statusParam = searchParams.status;
  if (!orderId || (statusParam !== "success" && statusParam !== "failed")) notFound();

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order || order.consumerUserId !== session.sub || order.purpose !== "CASE_PAYMENT") {
    notFound();
  }

  // Prefer the real order status if it already settled.
  const outcome =
    order.status === "SUCCESS" ? "success" : order.status === "FAILED" ? "failed" : statusParam;

  const caseIds = (order.caseIds as string[] | null) ?? [];
  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds }, consumerUserId: session.sub },
    select: { id: true, referenceNo: true, currency: true },
  });
  const currency = cases[0]?.currency ?? "INR";
  const caseHref = caseIds.length === 1 ? `/consumer/cases/${caseIds[0]}` : "/consumer/dashboard";
  const refs = cases.map((c) => c.referenceNo).join(", ") || "—";

  const success = outcome === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e8f2ef] to-[#f7f7f3] px-6 py-12">
      <div className="w-full max-w-md rounded-sm border border-line bg-white p-6 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandLogo href={null} variant="dark" size="md" />
        </div>
        <p className="mt-2 text-xs uppercase tracking-wide text-stamp-600">Demo payment portal</p>

        <div
          className={`mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            success ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"
          }`}
          aria-hidden
        >
          {success ? "✓" : "✕"}
        </div>

        <h1 className="mt-4 text-lg font-medium text-ink">
          {success ? "Payment successful" : "Payment failed"}
        </h1>
        <p className="mt-2 text-sm text-ink/60">
          {success
            ? "Your payment was recorded. Your application will move to the next step."
            : "The payment was declined or could not be completed. Your application is still awaiting payment."}
        </p>

        <div className="mt-5 rounded-sm border border-line bg-paper/80 px-4 py-3 text-left text-sm">
          <div className="flex justify-between text-ink/70">
            <span>Case{cases.length > 1 ? "s" : ""}</span>
            <span className="text-right font-medium text-ink">{refs}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <span className="text-ink/70">Amount</span>
            <span className="font-medium text-ink">
              {currency} {Number(order.amount).toFixed(2)}
            </span>
          </div>
          {order.paymentMethod && (
            <div className="mt-2 flex justify-between border-t border-line pt-2">
              <span className="text-ink/70">Method</span>
              <span className="font-medium text-ink">{order.paymentMethod}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={caseHref}
            className="rounded-sm bg-teal-500 px-4 py-3 text-sm font-medium text-paper hover:bg-teal-600"
          >
            {caseIds.length === 1 ? "Back to application" : "My applications"}
          </Link>
          {!success && caseIds.length === 1 && (
            <Link
              href={caseHref}
              className="rounded-sm border border-line px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/[0.03]"
            >
              Pay again from case
            </Link>
          )}
          {success && (
            <Link href="/consumer/dashboard" className="text-sm text-ink/50 underline hover:text-ink/70">
              Go to dashboard
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
