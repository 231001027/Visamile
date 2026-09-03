import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isUsingRealGateway } from "@/lib/payment";
import crypto from "crypto";
import { calculateTopupFee, PaymentMethod } from "@/lib/paymentFees";

export const dynamic = "force-dynamic";

const PAYU_BASE_URL =
  process.env.PAYU_SANDBOX === "true"
    ? "https://sandboxsecure.payu.in/_payment"
    : "https://secure.payu.in/_payment";

export default async function PayUCheckoutPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  if (!isUsingRealGateway) redirect("/pay/dev-checkout?orderId=" + (searchParams.orderId ?? ""));

  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) redirect("/login");

  const orderId = searchParams.orderId;
  if (!orderId) notFound();

  const order = await prisma.walletTopupOrder.findUnique({
    where: { id: orderId },
    include: { partner: true },
  });
  if (!order || order.partnerId !== session.partnerId || order.status !== "PENDING" || !order.partner) {
    notFound();
  }

  const method = (order.paymentMethod ?? "UPI") as PaymentMethod;
  const fee = calculateTopupFee(Number(order.amount), method);
  const key = process.env.PAYMENT_GATEWAY_KEY!;
  const salt = process.env.PAYMENT_GATEWAY_SECRET!;
  const productinfo = order.purpose === "CASE_PAYMENT" ? "Visa case payment" : "Wallet top-up";
  const firstname = order.partner.companyName;
  const email = order.partner.contactEmail;
  const hashString = [
    key,
    orderId,
    fee.totalPayable.toFixed(2),
    productinfo,
    firstname,
    email,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    salt,
  ].join("|");
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");
  const surl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/payments/callback`;
  const furl = surl;

  const fields: Record<string, string> = {
    key,
    txnid: orderId,
    amount: fee.totalPayable.toFixed(2),
    productinfo,
    firstname,
    email,
    phone: order.partner.contactPhone ?? "9999999999",
    surl,
    furl,
    hash,
  };

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-medium">Redirecting to PayU…</h1>
      <p className="mt-2 text-sm text-ink/60">
        Amount payable: ₹{fee.totalPayable.toFixed(2)} (incl. gateway fee + GST)
      </p>
      <form id="payu-form" action={PAYU_BASE_URL} method="POST" className="mt-6">
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button
          type="submit"
          className="rounded-sm bg-teal-500 px-6 py-3 font-medium text-paper hover:bg-teal-600"
        >
          Continue to PayU
        </button>
      </form>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('payu-form')?.requestSubmit();`,
        }}
      />
    </main>
  );
}
