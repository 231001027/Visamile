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

/**
 * Creates one Case in PENDING_PAYMENT — the shared core of both the
 * single-applicant Apply Visa flow and the Bulk Apply flow, so the
 * indemnity check, rate lookup, and fee-snapshot logic can't drift apart
 * between the two entry points.
 */
export async function createCase(params: {
  partnerId: string;
  createdByUserId: string;
  countryId: string;
  visaTypeId: string;
  applicationGrouping: ApplicationGrouping;
  travelerType: TravelerType;
  departureDate?: string;
  returnDate?: string;
  applicant: ApplicantInput;
}) {
  const { partnerId, createdByUserId, countryId, visaTypeId, applicant } = params;

  const visaType = await prisma.visaType.findUnique({ where: { id: visaTypeId } });
  if (!visaType || visaType.countryId !== countryId) {
    throw new UnknownVisaTypeError("Unknown country/visa type combination.");
  }

  const country = await prisma.country.findUnique({ where: { id: countryId } });
  if (country?.indemnityRequired) {
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
  const serviceFee = isChild ? rate.childServiceFee : rate.adultServiceFee;
  const referenceNo = await generateReferenceNo();

  const created = await prisma.$transaction(async (tx) => {
    const newCase = await tx.case.create({
      data: {
        referenceNo,
        partnerId,
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
        passportIssueDate: applicant.passportIssueDate ? new Date(applicant.passportIssueDate) : null,
        passportExpiryDate: applicant.passportExpiryDate ? new Date(applicant.passportExpiryDate) : null,
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

  await notify({
    partnerId,
    channel: "INAPP",
    subject: `Case ${referenceNo} awaiting payment`,
    body: `${applicant.applicantFirstName} ${applicant.applicantLastName}'s case is in Pending Payment.`,
  });

  return created;
}
