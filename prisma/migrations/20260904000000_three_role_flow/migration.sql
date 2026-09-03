-- AlterEnum UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONSUMER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PROCESSOR';

-- AlterEnum CaseStatus
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'UNDER_VERIFICATION';

-- AlterEnum DocumentType
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PAN_CARD';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'LEGAL_DOCUMENT';

-- User.active
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- VisaTypeRate fee split
ALTER TABLE "VisaTypeRate" ADD COLUMN IF NOT EXISTS "adultPlatformFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "VisaTypeRate" ADD COLUMN IF NOT EXISTS "adultProcessorFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "VisaTypeRate" ADD COLUMN IF NOT EXISTS "childPlatformFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "VisaTypeRate" ADD COLUMN IF NOT EXISTS "childProcessorFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill split from existing service fees (50/50)
UPDATE "VisaTypeRate"
SET
  "adultPlatformFee" = ROUND("adultServiceFee" / 2, 2),
  "adultProcessorFee" = "adultServiceFee" - ROUND("adultServiceFee" / 2, 2),
  "childPlatformFee" = ROUND("childServiceFee" / 2, 2),
  "childProcessorFee" = "childServiceFee" - ROUND("childServiceFee" / 2, 2)
WHERE "adultPlatformFee" = 0 AND "adultProcessorFee" = 0;

-- Case: nullable partner, consumer, processor, fee snapshots
ALTER TABLE "Case" ALTER COLUMN "partnerId" DROP NOT NULL;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "consumerUserId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "assignedProcessorId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "platformFeeSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "processorFeeSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Case"
SET
  "platformFeeSnapshot" = ROUND("serviceFeeSnapshot" / 2, 2),
  "processorFeeSnapshot" = "serviceFeeSnapshot" - ROUND("serviceFeeSnapshot" / 2, 2)
WHERE "platformFeeSnapshot" = 0 AND "processorFeeSnapshot" = 0;

CREATE INDEX IF NOT EXISTS "Case_consumerUserId_status_idx" ON "Case"("consumerUserId", "status");
CREATE INDEX IF NOT EXISTS "Case_assignedProcessorId_status_idx" ON "Case"("assignedProcessorId", "status");

DO $$ BEGIN
  ALTER TABLE "Case" ADD CONSTRAINT "Case_consumerUserId_fkey"
    FOREIGN KEY ("consumerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedProcessorId_fkey"
    FOREIGN KEY ("assignedProcessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- WalletTopupOrder: optional partner + consumer
ALTER TABLE "WalletTopupOrder" ALTER COLUMN "partnerId" DROP NOT NULL;
ALTER TABLE "WalletTopupOrder" ADD COLUMN IF NOT EXISTS "consumerUserId" TEXT;
CREATE INDEX IF NOT EXISTS "WalletTopupOrder_consumerUserId_status_idx"
  ON "WalletTopupOrder"("consumerUserId", "status");

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
