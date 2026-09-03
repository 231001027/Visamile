import { prisma } from "./prisma";
import { generateReferenceNo } from "./reference";
import { encryptField } from "./encryption";
import { notify } from "./notify";
import { ApplicationGrouping, TravelerType } from "@prisma/client";

export class IndemnityRequiredError extends Error {}
export class NoPricingError extends Error {}
export class UnknownVisaTypeError extends Error {}

export interface ApplicantInput {
  applicantFirstName: string;
  applicantLastName: string;
  applicantPassportNo: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  bookingId?: string;
  address?: string;
  applicantEmail?: string;
  applicantPhone?: string;
}

/** Pick least-loaded active processor for auto-assignment. */
export async function pickProcessorId(): Promise<string | null> {
  const processors = await prisma.user.findMany({
    where: { role: "PROCESSOR", active: true },
    select: { id: true },
  });
  if (processors.length === 0) return null;

  const counts = await Promise.all(
    processors.map(async (p) => {
      const open = await prisma.case.count({
        where: {
          assignedProcessorId: p.id,
          status: { in: ["UNDER_VERIFICATION", "SUBMITTED", "ADDITIONAL_DOCS_REQUESTED"] },
        },
      });
      return { id: p.id, open };
    })
  );
  counts.sort((a, b) => a.open - b.open);
  return counts[0]?.id ?? null;
}

/**
 * Creates one Case in PENDING_PAYMENT — partner or consumer entry points.
 */
export async function createCase(params: {
  partnerId?: string | null;
  consumerUserId?: string | null;
  createdByUserId: string;
  countryId: string;
  visaTypeId: string;
  applicationGrouping: ApplicationGrouping;
  travelerType: TravelerType;
  departureDate?: string;
  returnDate?: string;
  applicant: ApplicantInput;
  skipIndemnityCheck?: boolean;
}) {
  const {
    partnerId,
    consumerUserId,
    createdByUserId,
    countryId,
    visaTypeId,
    applicant,
    skipIndemnityCheck,
  } = params;

  if (!partnerId && !consumerUserId) {
    throw new Error("Case must belong to a partner or a consumer.");
  }

  const visaType = await prisma.visaType.findUnique({ where: { id: visaTypeId } });
  if (!visaType || visaType.countryId !== countryId) {
    throw new UnknownVisaTypeError("Unknown country/visa type combination.");
  }

  const country = await prisma.country.findUnique({ where: { id: countryId } });
  if (country?.indemnityRequired && partnerId && !skipIndemnityCheck) {
    const accepted = await prisma.partnerIndemnityAcceptance.findUnique({
      where: { partnerId_countryId: { partnerId, countryId } },
    });
    if (!accepted) {
      throw new IndemnityRequiredError(
        `Accept the ${country.name} indemnity terms on your profile before applying.`
      );
    }
  }

  const rate = await prisma.visaTypeRate.findFirst({
    where: { visaTypeId, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) throw new NoPricingError("No active pricing for this visa type yet.");

  const isChild = params.travelerType === "CHILD";
  const govFee = isChild ? rate.childGovFee : rate.adultGovFee;
  let platformFee = isChild ? rate.childPlatformFee : rate.adultPlatformFee;
  let processorFee = isChild ? rate.childProcessorFee : rate.adultProcessorFee;
  const legacyService = isChild ? rate.childServiceFee : rate.adultServiceFee;

  // If split fees not configured, fall back to 50/50 of legacy service fee
  if (Number(platformFee) === 0 && Number(processorFee) === 0 && Number(legacyService) > 0) {
    const half = Number(legacyService) / 2;
    platformFee = half as unknown as typeof platformFee;
    processorFee = (Number(legacyService) - half) as unknown as typeof processorFee;
  }

  const serviceFee = Number(platformFee) + Number(processorFee) || Number(legacyService);
  const referenceNo = await generateReferenceNo();

  const created = await prisma.$transaction(async (tx) => {
    const newCase = await tx.case.create({
      data: {
        referenceNo,
        partnerId: partnerId ?? null,
        consumerUserId: consumerUserId ?? null,
        createdByUserId,
        countryId,
        visaTypeId,
        applicationGrouping: params.applicationGrouping,
        travelerType: params.travelerType,
        departureDate: params.departureDate ? new Date(params.departureDate) : null,
        returnDate: params.returnDate ? new Date(params.returnDate) : null,
        applicantFirstName: applicant.applicantFirstName,
        applicantLastName: applicant.applicantLastName,
        applicantPassportNo: encryptField(applicant.applicantPassportNo),
        passportIssueDate: applicant.passportIssueDate
          ? new Date(applicant.passportIssueDate)
          : null,
        passportExpiryDate: applicant.passportExpiryDate
          ? new Date(applicant.passportExpiryDate)
          : null,
        gender: applicant.gender,
        dateOfBirth: applicant.dateOfBirth ? new Date(applicant.dateOfBirth) : null,
        placeOfBirth: applicant.placeOfBirth,
        fatherName: applicant.fatherName,
        motherName: applicant.motherName,
        spouseName: applicant.spouseName,
        bookingId: applicant.bookingId,
        address: applicant.address,
        applicantEmail: applicant.applicantEmail || null,
        applicantPhone: applicant.applicantPhone || null,
        status: "PENDING_PAYMENT",
        govFeeSnapshot: govFee,
        serviceFeeSnapshot: serviceFee,
        platformFeeSnapshot: platformFee,
        processorFeeSnapshot: processorFee,
        commissionSnapshot: rate.commission,
        currency: rate.currency,
      },
    });
    await tx.caseStatusEvent.create({
      data: {
        caseId: newCase.id,
        fromStatus: "DRAFT",
        toStatus: "PENDING_PAYMENT",
        note: "Case created and ready for payment.",
        actorUserId: createdByUserId,
      },
    });
    return newCase;
  });

  if (partnerId) {
    await notify({
      partnerId,
      channel: "INAPP",
      subject: `Case ${referenceNo} awaiting payment`,
      body: `${applicant.applicantFirstName} ${applicant.applicantLastName}'s case is in Pending Payment.`,
    });
  }

  return created;
}
