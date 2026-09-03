import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { CaseStatusActions } from "@/components/CaseStatusActions";
import { getAllowedTransitionsForRole, STATUS_LABELS } from "@/lib/caseStateMachine";
import { decryptCasePassport } from "@/lib/caseApplicant";

export const dynamic = "force-dynamic";

export default async function ProcessorCaseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "PROCESSOR") redirect("/login");

  const raw = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true } },
      consumer: { select: { name: true, email: true } },
      documents: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!raw) notFound();
  if (raw.assignedProcessorId && raw.assignedProcessorId !== session.sub) notFound();

  const kase = decryptCasePassport(raw);
  const options = getAllowedTransitionsForRole(kase.status, "PROCESSOR");

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">{kase.referenceNo}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {kase.applicantFirstName} {kase.applicantLastName} — passport {kase.applicantPassportNo}
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Source: {raw.partner?.companyName ?? raw.consumer?.name ?? "—"} · Processor fee ₹
            {Number(kase.processorFeeSnapshot).toFixed(2)}
          </p>
        </div>
        <StatusStamp status={kase.status} />
      </div>

      <p className="mb-4 text-sm text-ink/60">
        Embassy has no login — use these actions to mark submission and record the embassy decision.
      </p>

      <CaseStatusActions caseId={kase.id} options={options} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Documents ({kase.documents.length})
        </h2>
        <div className="space-y-2">
          {kase.documents.map((d) => (
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

      <section className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-line bg-white p-5 text-sm">
        <div>
          <div className="text-xs uppercase text-ink/40">Destination</div>
          <div className="mt-1">
            {kase.visaType.country.name} — {kase.visaType.name}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-ink/40">Fees</div>
          <div className="mt-1">
            Gov ₹{Number(kase.govFeeSnapshot).toFixed(2)} · Platform ₹
            {Number(kase.platformFeeSnapshot).toFixed(2)} · Processor ₹
            {Number(kase.processorFeeSnapshot).toFixed(2)}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">Status history</h2>
        <ol className="space-y-3 border-l border-line pl-4">
          {kase.statusHistory.map((ev) => (
            <li key={ev.id} className="text-sm">
              <div className="text-ink/80">
                {STATUS_LABELS[ev.toStatus]}{" "}
                <span className="text-ink/40">
                  — {ev.createdAt.toLocaleString("en-IN")} by {ev.actor.name}
                </span>
              </div>
              {ev.note && <div className="text-ink/50">{ev.note}</div>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
