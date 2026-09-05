import { prisma } from "./prisma";
import { appendWalletTransaction } from "./ledger";
import { encryptField, decryptField } from "./encryption";
import { ApplicantInput } from "./caseCreation";
import { CaseStatus } from "@prisma/client";

const EDITABLE_STATUSES: CaseStatus[] = ["DRAFT", "PENDING_PAYMENT", "ADDITIONAL_DOCS_REQUESTED"];

export function decryptCasePassport<T extends { applicantPassportNo: string }>(kase: T): T {
  try {
    return { ...kase, applicantPassportNo: decryptField(kase.applicantPassportNo) };
  } catch {
    return kase;
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
  return prisma.case.update({
    where: { id: params.caseId },
    data: {
      applicantFirstName: a.applicantFirstName,
      applicantLastName: a.applicantLastName,
      applicantPassportNo: encryptField(a.applicantPassportNo),
      passportIssueDate: a.passportIssueDate ? new Date(a.passportIssueDate) : null,
      passportExpiryDate: a.passportExpiryDate ? new Date(a.passportExpiryDate) : null,
      gender: a.gender,
      dateOfBirth: a.dateOfBirth ? new Date(a.dateOfBirth) : null,
      placeOfBirth: a.placeOfBirth,
      fatherName: a.fatherName,
      motherName: a.motherName,
      spouseName: a.spouseName,
      bookingId: a.bookingId,
      address: a.address,
      applicantEmail: a.applicantEmail || null,
      applicantPhone: a.applicantPhone || null,
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
