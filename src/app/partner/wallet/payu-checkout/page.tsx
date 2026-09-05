import { redirect } from "next/navigation";

/** Legacy partner path — shared PayU checkout lives at /pay/payu-checkout. */
export default function PartnerPayUCheckoutRedirect({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const q = searchParams.orderId ? `?orderId=${encodeURIComponent(searchParams.orderId)}` : "";
  redirect(`/pay/payu-checkout${q}`);
}
