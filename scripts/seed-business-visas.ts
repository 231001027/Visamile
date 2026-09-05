/**
 * Upserts Tourist/Business packages without running the full seed.
 * Usage: npx tsx scripts/seed-business-visas.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const STANDARD_CHECKLIST = [
  { id: "passport_front", label: "Passport front page", required: true },
  { id: "passport_back", label: "Passport back page", required: true },
  { id: "photograph", label: "Photograph", required: true },
  { id: "travel_history", label: "Travel history", required: true },
  { id: "invitation_docs", label: "Invitation documents", required: true },
  { id: "identity_proof", label: "Identity proof", required: true },
  { id: "personal_financial", label: "Personal financial documentation", required: true },
];

const PACKAGES = [
  { iso: "ARE", code: "UAE_BUSINESS_30", name: "Business visa — 30 days", entryType: "MULTIPLE" as const, visaCategory: "E_VISA" as const, validityDays: 30, durationDays: 30, processingDays: 5, adultGovFee: 550, adultServiceFee: 200, childGovFee: 550, childServiceFee: 200, commission: 80 },
  { iso: "AUS", code: "AUS_BUSINESS_600", name: "Business Visitor Visa (Subclass 600)", entryType: "MULTIPLE" as const, visaCategory: "E_VISA" as const, validityDays: 90, durationDays: 365, processingDays: 20, adultGovFee: 15887, adultServiceFee: 3500, childGovFee: 15887, childServiceFee: 3500, commission: 600 },
  { iso: "FRA", code: "SCHENGEN_BUSINESS", name: "Schengen business visa", entryType: "MULTIPLE" as const, visaCategory: "STICKER_VISA" as const, validityDays: 90, durationDays: 90, processingDays: 15, adultGovFee: 6400, adultServiceFee: 1100, childGovFee: 6400, childServiceFee: 1100, commission: 350 },
  { iso: "GBR", code: "UK_BUSINESS_VISITOR", name: "Business visitor visa", entryType: "MULTIPLE" as const, visaCategory: "STICKER_VISA" as const, validityDays: 180, durationDays: 180, processingDays: 15, adultGovFee: 11700, adultServiceFee: 1400, childGovFee: 11700, childServiceFee: 1400, commission: 450 },
  { iso: "THA", code: "THAILAND_BUSINESS", name: "Business visa", entryType: "SINGLE" as const, visaCategory: "E_VISA" as const, validityDays: 60, durationDays: 60, processingDays: 15, adultGovFee: 2500, adultServiceFee: 500, childGovFee: 2500, childServiceFee: 500, commission: 180 },
  { iso: "USA", code: "US_B1_BUSINESS", name: "B1 business visa", entryType: "MULTIPLE" as const, visaCategory: "STICKER_VISA" as const, validityDays: 3650, durationDays: 180, processingDays: 30, adultGovFee: 14000, adultServiceFee: 2800, childGovFee: 14000, childServiceFee: 2800, commission: 900 },
];

async function main() {
  for (const p of PACKAGES) {
    const country = await prisma.country.findFirst({ where: { isoCode: p.iso } });
    if (!country) {
      console.log(`skip ${p.code}: country ${p.iso} missing`);
      continue;
    }
    const visaType = await prisma.visaType.upsert({
      where: { countryId_code: { countryId: country.id, code: p.code } },
      update: { name: p.name, isBulkEligible: false },
      create: {
        countryId: country.id,
        code: p.code,
        name: p.name,
        entryType: p.entryType,
        visaCategory: p.visaCategory,
        validityDays: p.validityDays,
        durationDays: p.durationDays,
        processingDays: p.processingDays,
        documentChecklist: STANDARD_CHECKLIST,
        isBulkEligible: false,
      },
    });
    const existingRate = await prisma.visaTypeRate.findFirst({ where: { visaTypeId: visaType.id } });
    if (!existingRate) {
      await prisma.visaTypeRate.create({
        data: {
          visaTypeId: visaType.id,
          adultGovFee: p.adultGovFee,
          adultServiceFee: p.adultServiceFee,
          childGovFee: p.childGovFee,
          childServiceFee: p.childServiceFee,
          commission: p.commission,
          currency: "INR",
          effectiveFrom: new Date(),
        },
      });
    }
    console.log(`ok ${p.code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
