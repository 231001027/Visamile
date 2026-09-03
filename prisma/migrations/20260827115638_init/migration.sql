-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('STANDARD', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "InvoiceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DocApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "VisaCategory" AS ENUM ('E_VISA', 'STICKER_VISA');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'SUBMITTED', 'ADDITIONAL_DOCS_REQUESTED', 'APPROVED', 'REJECTED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TravelerType" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "ApplicationGrouping" AS ENUM ('INDIVIDUAL', 'GROUP', 'FAMILY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT_FRONT_PAGE', 'PASSPORT_BACK_PAGE', 'PHOTOGRAPH', 'GOVERNMENT_EMPLOYEE_DOCS', 'RETIRED_SENIOR_CITIZEN_DOCS', 'TRAVEL_HISTORY', 'SALARIED_EMPLOYEE_DOCS', 'BUSINESS_OWNER_DOCS', 'PROFESSIONAL_DOCS', 'STUDENT_WITH_PARENTS_DOCS', 'STUDENT_WITHOUT_PARENTS_DOCS', 'INVITATION_DOCS', 'COVERING_LETTER', 'IDENTITY_PROOF', 'PERSONAL_FINANCIAL_DOCS', 'OTHER_DOCUMENT');

-- CreateEnum
CREATE TYPE "WalletTxnType" AS ENUM ('TOPUP', 'DEBIT', 'REFUND', 'PAYOUT');

-- CreateEnum
CREATE TYPE "WalletTopupStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('WALLET_TOPUP', 'CASE_PAYMENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'INAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "SalesPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "agentCode" TEXT,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "country" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "tier" "PartnerTier" NOT NULL DEFAULT 'STANDARD',
    "invoiceFrequency" "InvoiceFrequency" NOT NULL DEFAULT 'DAILY',
    "contactPersonName" TEXT,
    "contactPersonEmail" TEXT,
    "contactPersonMobile" TEXT,
    "salesPersonId" TEXT,
    "financePersonEmail" TEXT,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstNo" TEXT,
    "panNo" TEXT,
    "tanNo" TEXT,
    "gstCountry" TEXT,
    "gstState" TEXT,
    "gstCity" TEXT,
    "gstPin" TEXT,
    "gstAddress" TEXT,
    "gstDocumentKey" TEXT,
    "gstDocumentStatus" "DocApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "msme" BOOLEAN NOT NULL DEFAULT false,
    "bankBeneficiaryName" TEXT,
    "bankAccountNo" TEXT,
    "bankType" TEXT,
    "bankName" TEXT,
    "bankIfsc" TEXT,
    "cancelChequeKey" TEXT,
    "walletTermsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBranch" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gstNo" TEXT,
    "panNo" TEXT,
    "address" TEXT,
    "bankBeneficiaryName" TEXT,
    "bankAccountNo" TEXT,
    "bankIfsc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerIndemnityAcceptance" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerIndemnityAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isoCode" TEXT NOT NULL,
    "indemnityRequired" BOOLEAN NOT NULL DEFAULT false,
    "indemnityText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaType" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "visaCategory" "VisaCategory" NOT NULL,
    "validityDays" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "processingDays" INTEGER NOT NULL,
    "bulkCategoryLabel" TEXT,
    "isBulkEligible" BOOLEAN NOT NULL DEFAULT false,
    "documentChecklist" JSONB NOT NULL,
    "checklistFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisaTypeRate" (
    "id" TEXT NOT NULL,
    "visaTypeId" TEXT NOT NULL,
    "adultGovFee" DECIMAL(10,2) NOT NULL,
    "adultServiceFee" DECIMAL(10,2) NOT NULL,
    "childGovFee" DECIMAL(10,2) NOT NULL,
    "childServiceFee" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisaTypeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "groupId" TEXT,
    "partnerId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "visaTypeId" TEXT NOT NULL,
    "applicationGrouping" "ApplicationGrouping" NOT NULL DEFAULT 'INDIVIDUAL',
    "travelerType" "TravelerType" NOT NULL DEFAULT 'ADULT',
    "departureDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "applicantFirstName" TEXT NOT NULL,
    "applicantLastName" TEXT NOT NULL,
    "applicantPassportNo" TEXT NOT NULL,
    "passportIssueDate" TIMESTAMP(3),
    "passportExpiryDate" TIMESTAMP(3),
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "spouseName" TEXT,
    "bookingId" TEXT,
    "address" TEXT,
    "applicantEmail" TEXT,
    "applicantPhone" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "govFeeSnapshot" DECIMAL(10,2) NOT NULL,
    "serviceFeeSnapshot" DECIMAL(10,2) NOT NULL,
    "commissionSnapshot" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paidAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStatusEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus" NOT NULL,
    "toStatus" "CaseStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "referenceCaseId" TEXT,
    "batchId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTopupOrder" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'WALLET_TOPUP',
    "amount" DECIMAL(10,2) NOT NULL,
    "caseIds" JSONB,
    "paymentMethod" TEXT,
    "gatewayFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gatewayGst" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gatewayTxnId" TEXT,
    "status" "WalletTopupStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "walletTransactionId" TEXT,

    CONSTRAINT "WalletTopupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_agentCode_key" ON "Partner"("agentCode");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "PartnerBranch_partnerId_idx" ON "PartnerBranch"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerIndemnityAcceptance_partnerId_countryId_key" ON "PartnerIndemnityAcceptance"("partnerId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_partnerId_idx" ON "User"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_isoCode_key" ON "Country"("isoCode");

-- CreateIndex
CREATE UNIQUE INDEX "VisaType_countryId_code_key" ON "VisaType"("countryId", "code");

-- CreateIndex
CREATE INDEX "VisaTypeRate_visaTypeId_effectiveFrom_idx" ON "VisaTypeRate"("visaTypeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Case_referenceNo_key" ON "Case"("referenceNo");

-- CreateIndex
CREATE INDEX "Case_partnerId_status_idx" ON "Case"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Case_groupId_idx" ON "Case"("groupId");

-- CreateIndex
CREATE INDEX "CaseStatusEvent_caseId_idx" ON "CaseStatusEvent"("caseId");

-- CreateIndex
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");

-- CreateIndex
CREATE INDEX "WalletTransaction_partnerId_createdAt_idx" ON "WalletTransaction"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_batchId_idx" ON "WalletTransaction"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopupOrder_walletTransactionId_key" ON "WalletTopupOrder"("walletTransactionId");

-- CreateIndex
CREATE INDEX "WalletTopupOrder_partnerId_status_idx" ON "WalletTopupOrder"("partnerId", "status");

-- CreateIndex
CREATE INDEX "Notification_partnerId_createdAt_idx" ON "Notification"("partnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "SalesPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBranch" ADD CONSTRAINT "PartnerBranch_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerIndemnityAcceptance" ADD CONSTRAINT "PartnerIndemnityAcceptance_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerIndemnityAcceptance" ADD CONSTRAINT "PartnerIndemnityAcceptance_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaType" ADD CONSTRAINT "VisaType_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisaTypeRate" ADD CONSTRAINT "VisaTypeRate_visaTypeId_fkey" FOREIGN KEY ("visaTypeId") REFERENCES "VisaType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_visaTypeId_fkey" FOREIGN KEY ("visaTypeId") REFERENCES "VisaType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStatusEvent" ADD CONSTRAINT "CaseStatusEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStatusEvent" ADD CONSTRAINT "CaseStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_referenceCaseId_fkey" FOREIGN KEY ("referenceCaseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopupOrder" ADD CONSTRAINT "WalletTopupOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTopupOrder" ADD CONSTRAINT "WalletTopupOrder_walletTransactionId_fkey" FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
