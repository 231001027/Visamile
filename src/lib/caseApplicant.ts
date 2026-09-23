import { prisma } from "./prisma";
import { appendWalletTransaction } from "./ledger";
import { encryptField, decryptField } from "./encryption";
import { ApplicantInput } from "./caseCreation";
import { CaseStatus } from "@prisma/client";
import { travelerTypeFromDob } from "./travelerType";

const EDITABLE_STATUSES: CaseStatus[] = ["DRAFT", "PENDING_PAYMENT", "ADDITIONAL_DOCS_REQUESTED"];

export function decryptCasePassport<T extends { applicantPassportNo: string }>(kase: T): T {
  try {
    return { ...kase, applicantPassportNo: decryptField(kase.applicantPassportNo) };
  } catch {
    return kase;
  }
}

/** Safe ISO string for form props — invalid DB dates must not crash RSC render. */
export function safeDateIso(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}

export async function updateCaseApplicant(params: {
  caseId: string;
  partnerId?: string | null;
  consumerUserId?: string | null;
  applicant: ApplicantInput;
}) {
  const existing = await prisma.case.findUnique({ where: { id: params.caseId } });
  if (!existing) throw new Error("Case not found.");
  if (params.partnerId && existing.partnerId !== params.partnerId) {
    throw new Error("Case not found.");
  }
  if (params.consumerUserId && existing.consumerUserId !== params.consumerUserId) {
    throw new Error("Case not found.");
  }
  if (!params.partnerId && !params.consumerUserId) {
    throw new Error("Case not found.");
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new Error(`Applicant details cannot be edited while case is ${existing.status}.`);
  }

  const a = params.applicant;
  const departureIso = existing.departureDate
    ? existing.departureDate.toISOString().slice(0, 10)
    : undefined;
  const derivedType =
    a.dateOfBirth != null && a.dateOfBirth !== ""
      ? travelerTypeFromDob(a.dateOfBirth, departureIso)
      : null;

  let feePatch: {
    travelerType?: "ADULT" | "CHILD";
    govFeeSnapshot?: number;
    platformFeeSnapshot?: number;
    processorFeeSnapshot?: number;
    serviceFeeSnapshot?: number;
  } = {};

  if (derivedType && derivedType !== existing.travelerType) {
    feePatch.travelerType = derivedType;
    if (existing.status === "DRAFT" || existing.status === "PENDING_PAYMENT") {
      const rate = await prisma.visaTypeRate.findFirst({
        where: { visaTypeId: existing.visaTypeId, effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: "desc" },
      });
      if (rate) {
        const isChild = derivedType === "CHILD";
        let platformFee = Number(isChild ? rate.childPlatformFee : rate.adultPlatformFee);
        let processorFee = Number(isChild ? rate.childProcessorFee : rate.adultProcessorFee);
        const legacyService = Number(isChild ? rate.childServiceFee : rate.adultServiceFee);
        if (platformFee === 0 && processorFee === 0 && legacyService > 0) {
          platformFee = legacyService / 2;
          processorFee = legacyService - platformFee;
        }
        feePatch.govFeeSnapshot = Number(isChild ? rate.childGovFee : rate.adultGovFee);
        feePatch.platformFeeSnapshot = platformFee;
        feePatch.processorFeeSnapshot = processorFee;
        feePatch.serviceFeeSnapshot = platformFee + processorFee || legacyService;
      }
    }
  }

  return prisma.case.update({
    where: { id: params.caseId },
    data: {
      applicantFirstName: a.applicantFirstName,
      applicantMiddleName: a.applicantMiddleName?.trim() || null,
      applicantLastName: a.applicantLastName,
      applicantPassportNo: encryptField(a.applicantPassportNo),
      applicantTitle: a.applicantTitle || null,
      passportIssueDate: a.passportIssueDate ? new Date(a.passportIssueDate) : null,
      passportExpiryDate: a.passportExpiryDate ? new Date(a.passportExpiryDate) : null,
      gender: a.gender,
      dateOfBirth: a.dateOfBirth ? new Date(a.dateOfBirth) : null,
      placeOfBirth: a.placeOfBirth,
      fatherName: a.fatherName,
      motherName: a.motherName,
      spouseName: a.spouseName?.trim() || null,
      address: a.address,
      applicantEmail: a.applicantEmail || null,
      applicantPhone: a.applicantPhone || null,
      ...feePatch,
    },
  });
}

export async function processCommissionPayout(params: {
  partnerId: string;
  adminUserId: string;
  note?: string;
}) {
  const unpaidCases = await prisma.case.findMany({
    where: {
      partnerId: params.partnerId,
      status: { in: ["DELIVERED", "APPROVED"] },
      commissionSnapshot: { gt: 0 },
    },
    select: { id: true, commissionSnapshot: true, referenceNo: true },
  });

  if (unpaidCases.length === 0) {
    throw new Error("No commission-eligible cases found for this partner.");
  }

  const total = unpaidCases.reduce((sum, c) => sum + Number(c.commissionSnapshot), 0);

  const payout = await prisma.commissionPayout.create({
    data: {
      partnerId: params.partnerId,
      amount: total,
      caseCount: unpaidCases.length,
      note: params.note,
      processedBy: params.adminUserId,
    },
  });

  await appendWalletTransaction({
    partnerId: params.partnerId,
    type: "TOPUP",
    amount: total,
    note: `Commission payout for ${unpaidCases.length} case(s) — batch ${payout.id}`,
  });

  await prisma.case.updateMany({
    where: { id: { in: unpaidCases.map((c) => c.id) } },
    data: { commissionSnapshot: 0 },
  });

  return payout;
}
