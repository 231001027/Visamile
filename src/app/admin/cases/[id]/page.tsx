import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { CaseStatusActions } from "@/components/CaseStatusActions";
import { AssignProcessorForm } from "@/components/AssignProcessorForm";
import { getAllowedTransitionsForRole, STATUS_LABELS } from "@/lib/caseStateMachine";
import { CaseStatus } from "@prisma/client";
import { formatApplicantName } from "@/lib/applicantName";
import { paymentMethodLabel } from "@/lib/paymentMethods";
import { CaseDocumentsSplit } from "@/components/CaseDocumentsSplit";

export const dynamic = "force-dynamic";

const UNPAID_STATUSES: CaseStatus[] = ["DRAFT", "PENDING_PAYMENT"];

function paymentState(status: CaseStatus, historyHasPaid: boolean) {
  if (historyHasPaid || !UNPAID_STATUSES.includes(status)) {
    if (status === "CANCELLED" && !historyHasPaid) {
      return { paid: false as const, label: "Payment not completed", detail: "Case cancelled before payment." };
    }
    return { paid: true as const, label: "Payment completed", detail: "Traveler has paid for this application." };
  }
  if (status === "DRAFT") {
    return { paid: false as const, label: "Payment not started", detail: "Application is still a draft." };
  }
  return { paid: false as const, label: "Awaiting payment", detail: "Traveler has not completed payment yet." };
}

export default async function AdminCaseDetailPage({ params }: { params: { id: string } }) {
  const kase = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true, contactEmail: true } },
      consumer: { select: { name: true, email: true } },
      assignedProcessor: { select: { id: true, name: true, email: true } },
      documents: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!kase) notFound();

  const processors = await prisma.user.findMany({
    where: { role: "PROCESSOR", active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const historyHasPaid = kase.statusHistory.some((ev) => ev.toStatus === "PAID");
  const payment = paymentState(kase.status, historyHasPaid);
  const paidEvent = [...kase.statusHistory].reverse().find((ev) => ev.toStatus === "PAID");

  const paymentOrders = await prisma.walletTopupOrder.findMany({
    where: {
      purpose: "CASE_PAYMENT",
      OR: [{ consumerUserId: kase.consumerUserId ?? undefined }, { partnerId: kase.partnerId ?? undefined }],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const matchingOrder = paymentOrders.find((o) => {
    const ids = (o.caseIds as string[] | null) ?? [];
    return ids.includes(kase.id);
  });

  const options = getAllowedTransitionsForRole(kase.status, "ADMIN");
  const source = kase.partner
    ? `Partner: ${kase.partner.companyName} (${kase.partner.contactEmail})`
    : kase.consumer
      ? `Traveler: ${kase.consumer.name} (${kase.consumer.email})`
      : "Unknown source";

  const totalDue =
    Number(kase.govFeeSnapshot) + Number(kase.serviceFeeSnapshot);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">{kase.referenceNo}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {formatApplicantName(kase)} — {kase.visaType.country.name}, {kase.visaType.name}
          </p>
          <p className="mt-1 text-sm text-ink/40">{source}</p>
          <p className="mt-1 text-sm text-ink/40">
            Processor: {kase.assignedProcessor?.name ?? "Unassigned"}
          </p>
        </div>
        <StatusStamp status={kase.status} />
      </div>

      <section
        className={`mb-6 rounded-sm border px-4 py-3 ${
          payment.paid
            ? "border-teal-500/40 bg-teal-50/60"
            : "border-stamp-500/50 bg-stamp-400/10"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Payment status</p>
            <p className={`mt-1 text-sm font-medium ${payment.paid ? "text-teal-800" : "text-stamp-700"}`}>
              {payment.label}
            </p>
            <p className="mt-0.5 text-xs text-ink/55">{payment.detail}</p>
          </div>
          <span
            className={`shrink-0 rounded-sm border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              payment.paid
                ? "border-teal-600 text-teal-700"
                : "border-stamp-600 text-stamp-700"
            }`}
          >
            {payment.paid ? "Paid" : "Unpaid"}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-all ${payment.paid ? "w-full bg-teal-500" : "w-1/3 bg-stamp-500"}`}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
          <span>
            Amount: {kase.currency} {totalDue.toFixed(2)}
          </span>
          {matchingOrder?.paymentMethod && (
            <span>Method: {paymentMethodLabel(matchingOrder.paymentMethod)}</span>
          )}
          {matchingOrder && (
            <span>
              Order: {matchingOrder.status}
              {matchingOrder.id ? ` · ${matchingOrder.id.slice(0, 10)}…` : ""}
            </span>
          )}
          {paidEvent && (
            <span>
              Paid at {paidEvent.createdAt.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </section>

      <CaseStatusActions caseId={kase.id} options={options} />

      <section className="mt-6">
        <AssignProcessorForm
          caseId={kase.id}
          currentProcessorId={kase.assignedProcessorId}
          processors={processors}
        />
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-line bg-white p-5 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/40">Passport number</div>
          <div className="mt-1">{kase.applicantPassportNo}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/40">Fee split</div>
          <div className="mt-1">
            Gov ₹{Number(kase.govFeeSnapshot).toFixed(2)} · Platform ₹
            {Number(kase.platformFeeSnapshot).toFixed(2)} · Processor ₹
            {Number(kase.processorFeeSnapshot).toFixed(2)}
          </div>
        </div>
      </section>

      <CaseDocumentsSplit documents={kase.documents} statusHistory={kase.statusHistory} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">Status history</h2>
        <ol className="space-y-3 border-l border-line pl-4">
          {kase.statusHistory.map(
            (ev: {
              id: string;
              toStatus: CaseStatus;
              createdAt: Date;
              actor: { name: string };
              note: string | null;
            }) => (
              <li key={ev.id} className="text-sm">
                <div className="text-ink/80">
                  {STATUS_LABELS[ev.toStatus]}{" "}
                  <span className="text-ink/40">
                    — {ev.createdAt.toLocaleString("en-IN")} by {ev.actor.name}
                  </span>
                </div>
                {ev.note && <div className="text-ink/50">{ev.note}</div>}
              </li>
            )
          )}
        </ol>
      </section>
    </div>
  );
}
