import { bookingIdFromReference } from "@/lib/reference";

/** Statuses where payment has succeeded (and processing may have started). */
const POST_PAYMENT_STATUSES = new Set([
  "PAID",
  "UNDER_VERIFICATION",
  "SUBMITTED",
  "ADDITIONAL_DOCS_REQUESTED",
  "APPROVED",
  "REJECTED",
  "DELIVERED",
]);

export function isPaymentComplete(input: {
  status: string;
  paidAt?: Date | string | null;
  statusHistory?: { toStatus: string }[];
}): boolean {
  if (input.paidAt) return true;
  if (POST_PAYMENT_STATUSES.has(input.status)) return true;
  return Boolean(input.statusHistory?.some((e) => e.toStatus === "PAID"));
}

export function PaymentSuccessBar({
  amountLabel,
  bookingId,
  paidAt,
  referenceNo,
  countryIsoCode,
}: {
  amountLabel: string;
  bookingId?: string | null;
  paidAt?: Date | string | null;
  referenceNo: string;
  countryIsoCode?: string | null;
}) {
  const when =
    paidAt != null
      ? new Date(paidAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
  const shownBooking =
    bookingId || bookingIdFromReference(referenceNo, countryIsoCode);

  return (
    <div className="mb-4 rounded-sm border border-teal-600/30 bg-teal-50 px-4 py-3 text-sm text-teal-900">
      <p className="font-medium text-teal-800">Payment successful</p>
      <p className="mt-1 text-teal-800/80">
        {amountLabel} received
        {when ? ` on ${when}` : ""}. This application is with Visamile for processing.
      </p>
      <p className="mt-1 font-mono text-xs text-teal-700">
        Booking ID: {shownBooking}
      </p>
    </div>
  );
}
