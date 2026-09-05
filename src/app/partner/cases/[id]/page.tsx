import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/StatusStamp";
import { DocumentUploader } from "@/components/DocumentUploader";
import { CaseStatusActions } from "@/components/CaseStatusActions";
import { CaseEditForm } from "@/components/CaseEditForm";
import { getAllowedTransitionsForRole, STATUS_LABELS } from "@/lib/caseStateMachine";
import { decryptCasePassport, safeDateIso } from "@/lib/caseApplicant";
import { CaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const EDITABLE: CaseStatus[] = ["DRAFT", "PENDING_PAYMENT", "ADDITIONAL_DOCS_REQUESTED"];

export default async function PartnerCaseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const raw = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      visaType: { include: { country: true } },
      documents: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!raw || raw.partnerId !== session!.partnerId) notFound();

  const kase = decryptCasePassport(raw);
  const totalCharge = Number(kase.govFeeSnapshot) + Number(kase.serviceFeeSnapshot);
  const options = getAllowedTransitionsForRole(kase.status, "PARTNER");
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
        <div className="mb-4 flex items-center justify-between rounded-sm border border-stamp-500 bg-stamp-400/10 px-4 py-3 text-sm text-stamp-600">
          <span>This case is waiting to be paid before it moves to processing.</span>
          <Link href="/partner/pending-payment" className="font-medium underline">
            Go to Pending Payment
          </Link>
        </div>
      )}

      <CaseStatusActions caseId={kase.id} options={options} />

      <section className="mt-8 grid grid-cols-2 gap-4 rounded-sm border border-line bg-white p-5 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink/40">Total charged</div>
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
          passportIssueDate: safeDateIso(kase.passportIssueDate),
          passportExpiryDate: safeDateIso(kase.passportExpiryDate),
          gender: kase.gender,
          dateOfBirth: safeDateIso(kase.dateOfBirth),
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
          {kase.documents.length === 0 && <p className="text-sm text-ink/50">No documents uploaded yet.</p>}
        </div>
        <div className="mt-4">
          <DocumentUploader caseId={kase.id} checklist={checklist ?? undefined} uploadedTypes={uploadedTypes} />
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
