import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase")
    ? { rejectUnauthorized: false }
    : undefined,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  console.log("Seeding demo catalog, accounts, and pricing…");

  // ---------- Sales persons (Profile Update "Sales Person Name" dropdown) ----------
  const salesPersonNames = ["Varghese TC", "Kishore NK", "Anita Rao"];
  const salesPersons: Record<string, string> = {};
  for (const name of salesPersonNames) {
    const existing = await prisma.salesPerson.findFirst({ where: { name } });
    const rec = existing ?? (await prisma.salesPerson.create({ data: { name } }));
    salesPersons[name] = rec.id;
  }

  // ---------- Countries ----------
  const countries = [
    { name: "Australia", isoCode: "AUS", indemnityRequired: false },
    { name: "United Arab Emirates", isoCode: "ARE", indemnityRequired: true, indemnityText: "In case of applying for UAE visa, please check Indemnity Terms & Conditions." },
    { name: "France (Schengen)", isoCode: "FRA", indemnityRequired: false },
    { name: "United Kingdom", isoCode: "GBR", indemnityRequired: false },
    { name: "Thailand", isoCode: "THA", indemnityRequired: false },
    { name: "United States", isoCode: "USA", indemnityRequired: false },
    { name: "Austria", isoCode: "AUT", indemnityRequired: false }, // for the Bulk Apply demo data
  ];
  const countryIds: Record<string, string> = {};
  for (const c of countries) {
    const rec = await prisma.country.upsert({
      where: { isoCode: c.isoCode },
      update: { indemnityRequired: c.indemnityRequired, indemnityText: (c as any).indemnityText },
      create: c,
    });
    countryIds[c.isoCode] = rec.id;
  }

  // ---------- Visa types (single-applicant "Apply Visa" catalog) ----------
  // Matches image 3: one package per country, entry type + visa category +
  // validity/duration/processing time + adult/child rate.
  type VisaTypeSeed = {
    countryIso: string;
    code: string;
    name: string;
    entryType: "SINGLE" | "MULTIPLE";
    visaCategory: "E_VISA" | "STICKER_VISA";
    validityDays: number;
    durationDays: number;
    processingDays: number;
    adultGovFee: number;
    adultServiceFee: number;
    childGovFee: number;
    childServiceFee: number;
    commission: number;
    checklist: { id: string; label: string; required: boolean }[];
    bulkCategoryLabel?: string;
    isBulkEligible?: boolean;
  };

  const STANDARD_CHECKLIST = [
    { id: "passport_front", label: "Passport front page", required: true },
    { id: "passport_back", label: "Passport back page", required: true },
    { id: "photograph", label: "Photograph", required: true },
    { id: "pan_card", label: "PAN card", required: true },
    { id: "travel_history", label: "Travel history", required: true },
    { id: "invitation_docs", label: "Invitation documents", required: true },
    { id: "identity_proof", label: "Identity proof", required: true },
    { id: "legal_document", label: "Legal document", required: false },
    { id: "personal_financial", label: "Personal financial documentation", required: true },
  ];

  const visaTypeDefs: VisaTypeSeed[] = [
    {
      countryIso: "AUS",
      code: "AUS_TOURIST_600",
      name: "Tourist Visa (Subclass 600)",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 1095,
      processingDays: 20,
      adultGovFee: 15887,
      adultServiceFee: 3000,
      childGovFee: 15887,
      childServiceFee: 3000,
      commission: 500,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "ARE",
      code: "UAE_TOURIST_30",
      name: "Tourist visa — 30 days",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 3,
      adultGovFee: 350,
      adultServiceFee: 150,
      childGovFee: 350,
      childServiceFee: 150,
      commission: 60,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "FRA",
      code: "SCHENGEN_TOURIST",
      name: "Schengen tourist visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 90,
      durationDays: 90,
      processingDays: 15,
      adultGovFee: 6400,
      adultServiceFee: 900,
      childGovFee: 6400,
      childServiceFee: 900,
      commission: 300,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "GBR",
      code: "UK_STANDARD_VISITOR",
      name: "Standard visitor visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 180,
      durationDays: 180,
      processingDays: 15,
      adultGovFee: 11700,
      adultServiceFee: 1200,
      childGovFee: 11700,
      childServiceFee: 1200,
      commission: 400,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "THA",
      code: "THAILAND_TOURIST",
      name: "Tourist visa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 60,
      durationDays: 60,
      processingDays: 15,
      adultGovFee: 2000,
      adultServiceFee: 400,
      childGovFee: 2000,
      childServiceFee: 400,
      commission: 150,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "USA",
      code: "US_B1_B2",
      name: "B1/B2 visitor visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 3650,
      durationDays: 180,
      processingDays: 30,
      adultGovFee: 14000,
      adultServiceFee: 2500,
      childGovFee: 14000,
      childServiceFee: 2500,
      commission: 800,
      checklist: STANDARD_CHECKLIST,
    },
    // ---- Bulk-only rows for Austria, matching image 5 ----
    {
      countryIso: "AUT",
      code: "AUT_BULK_ADULT_TOURIST",
      name: "Adult Tourist",
      entryType: "SINGLE",
      visaCategory: "STICKER_VISA",
      validityDays: 15,
      durationDays: 15,
      processingDays: 15,
      adultGovFee: 12279,
      adultServiceFee: 2000,
      childGovFee: 12279,
      childServiceFee: 2000,
      commission: 250,
      checklist: STANDARD_CHECKLIST,
      bulkCategoryLabel: "Adult Tourist",
      isBulkEligible: true,
    },
    {
      countryIso: "AUT",
      code: "AUT_BULK_CHILD_BELOW_6",
      name: "Child below 6 yrs",
      entryType: "SINGLE",
      visaCategory: "STICKER_VISA",
      validityDays: 15,
      durationDays: 15,
      processingDays: 15,
      adultGovFee: 4649,
      adultServiceFee: 0,
      childGovFee: 4649,
      childServiceFee: 0,
      commission: 100,
      checklist: STANDARD_CHECKLIST,
      bulkCategoryLabel: "Child below 6 yrs",
      isBulkEligible: true,
    },
    {
      countryIso: "AUT",
      code: "AUT_BULK_CHILDREN_6_12",
      name: "Children 6-12 yrs",
      entryType: "SINGLE",
      visaCategory: "STICKER_VISA",
      validityDays: 15,
      durationDays: 15,
      processingDays: 15,
      adultGovFee: 7464,
      adultServiceFee: 2000,
      childGovFee: 7464,
      childServiceFee: 2000,
      commission: 150,
      checklist: STANDARD_CHECKLIST,
      bulkCategoryLabel: "Children 6-12 yrs",
      isBulkEligible: true,
    },
    {
      countryIso: "AUT",
      code: "AUT_BULK_TOURIST_30",
      name: "Tourist — 30 days",
      entryType: "SINGLE",
      visaCategory: "STICKER_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 15,
      adultGovFee: 1704,
      adultServiceFee: 2000,
      childGovFee: 1704,
      childServiceFee: 2000,
      commission: 100,
      checklist: STANDARD_CHECKLIST,
      bulkCategoryLabel: "Tourist",
      isBulkEligible: true,
    },
  ];

  for (const v of visaTypeDefs) {
    const visaType = await prisma.visaType.upsert({
      where: { countryId_code: { countryId: countryIds[v.countryIso], code: v.code } },
      update: {},
      create: {
        countryId: countryIds[v.countryIso],
        code: v.code,
        name: v.name,
        entryType: v.entryType,
        visaCategory: v.visaCategory,
        validityDays: v.validityDays,
        durationDays: v.durationDays,
        processingDays: v.processingDays,
        documentChecklist: v.checklist,
        bulkCategoryLabel: v.bulkCategoryLabel,
        isBulkEligible: v.isBulkEligible ?? false,
      },
    });

    const existingRate = await prisma.visaTypeRate.findFirst({ where: { visaTypeId: visaType.id } });
    if (!existingRate) {
      const adultPlatform = Math.round(v.adultServiceFee / 2);
      const childPlatform = Math.round(v.childServiceFee / 2);
      await prisma.visaTypeRate.create({
        data: {
          visaTypeId: visaType.id,
          adultGovFee: v.adultGovFee,
          adultServiceFee: v.adultServiceFee,
          childGovFee: v.childGovFee,
          childServiceFee: v.childServiceFee,
          adultPlatformFee: adultPlatform,
          adultProcessorFee: v.adultServiceFee - adultPlatform,
          childPlatformFee: childPlatform,
          childProcessorFee: v.childServiceFee - childPlatform,
          commission: v.commission,
          currency: "INR",
        },
      });
    }
  }

  // ---------- Demo accounts ----------
  const adminEmail = "ops@visamile.test";
  const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExists) {
    await prisma.user.create({
      data: { email: adminEmail, passwordHash: await hash("Passw0rd!"), name: "Ops Admin", role: "ADMIN" },
    });
  }

  const demoPartnerEmail = "agent@vacationer.test";
  let demoUser = await prisma.user.findUnique({ where: { email: demoPartnerEmail } });
  if (!demoUser) {
    // Modeled directly on the real "Profile Update For Agent" screenshot.
    const partner = await prisma.partner.create({
      data: {
        agentCode: "C002085",
        companyName: "Vacationer",
        country: "India",
        contactEmail: demoPartnerEmail,
        contactPhone: "06362276177",
        status: "APPROVED", // pre-approved so the demo login can submit cases immediately
        tier: "SILVER",
        invoiceFrequency: "DAILY",
        contactPersonName: "Kishore NK",
        contactPersonEmail: demoPartnerEmail,
        contactPersonMobile: "6362276177",
        salesPersonId: salesPersons["Varghese TC"],
        financePersonEmail: demoPartnerEmail,
        gstRegistered: true,
        gstNo: "29ACKPT4497Q2Z7",
        panNo: "ACKPT4497Q",
        gstCountry: "India",
        gstState: "Karnataka",
        gstCity: "Bengaluru Urban",
        gstPin: "560071",
        gstAddress: "A2/24, BDA Flats, 1st Floor, II Phase, II Stage, Bengaluru, Bengaluru Urban, Karnataka, 560071",
        gstDocumentStatus: "APPROVED",
        msme: false,
        walletTermsAcceptedAt: new Date(),
      },
    });
    demoUser = await prisma.user.create({
      data: {
        email: demoPartnerEmail,
        passwordHash: await hash("Passw0rd!"),
        name: "Demo Agent",
        role: "PARTNER",
        partnerId: partner.id,
      },
    });
    // Opening wallet balance so the demo account can pay cases immediately.
    await prisma.walletTransaction.create({
      data: { partnerId: partner.id, type: "TOPUP", amount: 100000, balanceAfter: 100000, note: "Seed opening balance" },
    });
    // Pre-accept the UAE indemnity so the demo can apply for UAE visas too.
    await prisma.partnerIndemnityAcceptance.create({
      data: { partnerId: partner.id, countryId: countryIds["ARE"] },
    });
  }

  const consumerEmail = "traveler@visamile.test";
  if (!(await prisma.user.findUnique({ where: { email: consumerEmail } }))) {
    await prisma.user.create({
      data: {
        email: consumerEmail,
        passwordHash: await hash("Passw0rd!"),
        name: "Demo Traveler",
        role: "CONSUMER",
        active: true,
      },
    });
  }

  const processorEmail = "verifier@visamile.test";
  if (!(await prisma.user.findUnique({ where: { email: processorEmail } }))) {
    await prisma.user.create({
      data: {
        email: processorEmail,
        passwordHash: await hash("Passw0rd!"),
        name: "Demo Verifier",
        role: "PROCESSOR",
        active: true,
      },
    });
  }

  console.log("Seed complete.");
  console.log("  Admin (platform):    ops@visamile.test / Passw0rd!");
  console.log("  Partner (agency):    agent@vacationer.test / Passw0rd!");
  console.log("  Consumer (traveler): traveler@visamile.test / Passw0rd!");
  console.log("  Processor (verify):  verifier@visamile.test / Passw0rd!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
