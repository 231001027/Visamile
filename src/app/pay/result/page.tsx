import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { PaymentStatusPoller } from "@/components/PaymentStatusPoller";

/**
 * Browser return URL after Stripe Checkout. Payment is only applied by the
 * webhook — this page just reports order status (and polls while PENDING).
 */
export default async function PayResultPage({
  searchParams,
}: {
  searchParams: { orderId?: string; status?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orderId = searchParams.orderId;
  if (!orderId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-medium text-ink">Payment</h1>
        <p className="mt-2 text-sm text-ink/60">Missing order reference.</p>
        <HomeLink role={session.role} />
      </div>
    );
  }

  const order = await prisma.walletTopupOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-medium text-ink">Payment</h1>
        <p className="mt-2 text-sm text-danger">Order not found.</p>
        <HomeLink role={session.role} />
      </div>
    );
  }

  const ownsOrder =
    (session.role === "PARTNER" && order.partnerId === session.partnerId) ||
    (session.role === "CONSUMER" && order.consumerUserId === session.sub) ||
    session.role === "ADMIN";
  if (!ownsOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-medium text-ink">Payment</h1>
        <p className="mt-2 text-sm text-danger">You do not have access to this order.</p>
        <HomeLink role={session.role} />
      </div>
    );
  }

  const cancelled = searchParams.status === "cancelled";
  const amount = Number(order.totalPayable ?? order.amount);

  let title = "Payment pending";
  let detail = "Confirming with Stripe… this usually takes a few seconds.";
  let tone: "ok" | "warn" | "bad" = "warn";

  if (cancelled && order.status === "PENDING") {
    title = "Payment cancelled";
    detail = "You left Stripe Checkout before completing payment. No charge was made.";
    tone = "bad";
  } else if (order.status === "SUCCESS") {
    title = "Payment successful";
    detail =
      order.purpose === "WALLET_TOPUP"
        ? "Your wallet has been credited."
        : "Your case payment is confirmed.";
    tone = "ok";
  } else if (order.status === "FAILED") {
    title = "Payment failed";
    detail = "The payment did not go through. You can try again from your dashboard.";
    tone = "bad";
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      {order.status === "PENDING" && !cancelled && <PaymentStatusPoller />}
      <h1 className="text-2xl font-medium text-ink">{title}</h1>
      <p
        className={`mt-2 text-sm ${
          tone === "ok" ? "text-teal-700" : tone === "bad" ? "text-danger" : "text-ink/60"
        }`}
      >
        {detail}
      </p>
      <dl className="mt-6 space-y-2 rounded-sm border border-line bg-white p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/50">Amount</dt>
          <dd className="font-medium">₹{amount.toLocaleString("en-IN")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/50">Status</dt>
          <dd className="font-medium">{order.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/50">Order</dt>
          <dd className="font-mono text-xs">{order.id}</dd>
        </div>
      </dl>
      <HomeLink role={session.role} purpose={order.purpose} />
    </div>
  );
}

function HomeLink({
  role,
  purpose,
}: {
  role: string;
  purpose?: string | null;
}) {
  const href =
    role === "PARTNER"
      ? purpose === "WALLET_TOPUP"
        ? "/partner/wallet"
        : "/partner/pending-payment"
      : role === "CONSUMER"
        ? "/consumer/cases"
        : "/admin";
  return (
    <p className="mt-8">
      <Link href={href} className="text-sm font-medium text-teal-700 underline">
        Continue
      </Link>
    </p>
  );
}
