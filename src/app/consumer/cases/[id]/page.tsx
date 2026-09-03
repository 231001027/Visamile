import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { DocumentUploader } from "@/components/DocumentUploader";
import { CaseStatusActions } from "@/components/CaseStatusActions";
import { CaseEditForm } from "@/components/CaseEditForm";
import { ConsumerPayButton } from "@/components/ConsumerPayButton";
import { getAllowedTransitionsForRole, STATUS_LABELS } from "@/lib/caseStateMachine";
import { decryptCasePassport } from "@/lib/caseApplicant";
import { CaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const EDITABLE: CaseStatus[] = ["DRAFT", "PENDING_PAYMENT", "ADDITIONAL_DOCS_REQUESTED"];

export default async function ConsumerCaseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "CONSUMER") redirect("/login");

  const raw = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      visaType: { include: { country: true } },
      documents: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!raw || raw.consumerUserId !== session.sub) notFound();

  const kase = decryptCasePassport(raw);
  const totalCharge = Number(kase.govFeeSnapshot) + Number(kase.serviceFeeSnapshot);
  const options = getAllowedTransitionsForRole(kase.status, "CONSUMER");
  const checklist = raw.visaType.documentChecklist as { id: string; label: string; required: boolean }[] | null;
  const uploadedTypes = kase.documents.map((d) => d.type);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink">{kase.referenceNo}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {kase.applicantFirstName} {kase.applicantLastName} — {kase.visaType.country.name}, {kase.visaType.name}
          </p>
        </div>
        <StatusStamp status={kase.status} />
      </div>

      {kase.status === "PENDING_PAYMENT" && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-sm border border-stamp-500 bg-stamp-400/10 px-4 py-3 text-sm text-stamp-600">
          <span>
            Pay ₹{totalCharge.toFixed(2)} (gov ₹{Number(kase.govFeeSnapshot).toFixed(2)} + platform ₹
            {Number(kase.platformFeeSnapshot).toFixed(2)} + verification ₹
            {Number(kase.processorFeeSnapshot).toFixed(2)}) to start verification.
          </span>
          <ConsumerPayButton caseId={kase.id} />
        </div>
      )}

      <CaseStatusActions caseId={kase.id} options={options} />

      <section className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-line bg-white p-5 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/40">Total</div>
          <div className="mt-1">
            {kase.currency} {totalCharge.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/40">Traveler type</div>
          <div className="mt-1">{kase.travelerType}</div>
        </div>
      </section>

      <CaseEditForm
        caseId={kase.id}
        editable={EDITABLE.includes(kase.status)}
        initial={{
          applicantFirstName: kase.applicantFirstName,
          applicantLastName: kase.applicantLastName,
          applicantPassportNo: kase.applicantPassportNo,
          passportIssueDate: kase.passportIssueDate?.toISOString() ?? null,
          passportExpiryDate: kase.passportExpiryDate?.toISOString() ?? null,
          gender: kase.gender,
          dateOfBirth: kase.dateOfBirth?.toISOString() ?? null,
          placeOfBirth: kase.placeOfBirth,
          fatherName: kase.fatherName,
          motherName: kase.motherName,
          spouseName: kase.spouseName,
          bookingId: kase.bookingId,
          address: kase.address,
          applicantEmail: kase.applicantEmail,
          applicantPhone: kase.applicantPhone,
        }}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/50">Documents</h2>
        <DocumentUploader
          caseId={kase.id}
          checklist={checklist ?? undefined}
          uploadedTypes={uploadedTypes}
        />
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
