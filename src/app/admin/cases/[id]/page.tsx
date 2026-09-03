import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { CaseStatusActions } from "@/components/CaseStatusActions";
import { AssignProcessorForm } from "@/components/AssignProcessorForm";
import { getAllowedTransitionsForRole, STATUS_LABELS } from "@/lib/caseStateMachine";
import { CaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

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

  const options = getAllowedTransitionsForRole(kase.status, "ADMIN");
  const source = kase.partner
    ? `Partner: ${kase.partner.companyName} (${kase.partner.contactEmail})`
    : kase.consumer
      ? `Traveler: ${kase.consumer.name} (${kase.consumer.email})`
      : "Unknown source";

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">{kase.referenceNo}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {kase.applicantFirstName} {kase.applicantLastName} — {kase.visaType.country.name}, {kase.visaType.name}
          </p>
          <p className="mt-1 text-sm text-ink/40">{source}</p>
          <p className="mt-1 text-sm text-ink/40">
            Processor: {kase.assignedProcessor?.name ?? "Unassigned"}
          </p>
        </div>
        <StatusStamp status={kase.status} />
      </div>

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

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Documents ({kase.documents.length})
        </h2>
        <div className="space-y-2">
          {kase.documents.map((d: { id: string; storageKey: string; fileName: string; type: string }) => (
            <a
              key={d.id}
              href={`/api/documents/${d.storageKey}`}
              target="_blank"
              className="flex items-center justify-between rounded-sm border border-line bg-white px-4 py-2 text-sm hover:bg-teal-50/40"
            >
              <span>{d.fileName}</span>
              <span className="text-xs uppercase text-ink/40">{d.type.replaceAll("_", " ")}</span>
            </a>
          ))}
          {kase.documents.length === 0 && (
            <p className="text-sm text-ink/50">No documents uploaded yet.</p>
          )}
        </div>
      </section>

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
