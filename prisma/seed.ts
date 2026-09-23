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
    {
      name: "United Arab Emirates",
      isoCode: "ARE",
      indemnityRequired: true,
      indemnityText: "In case of applying for UAE visa, please check Indemnity Terms & Conditions.",
    },
    { name: "France (Schengen)", isoCode: "FRA", indemnityRequired: false },
    { name: "United Kingdom", isoCode: "GBR", indemnityRequired: false },
    { name: "Thailand", isoCode: "THA", indemnityRequired: false },
    { name: "United States", isoCode: "USA", indemnityRequired: false },
    { name: "Austria", isoCode: "AUT", indemnityRequired: false },
    // B2B eVisa destinations
    { name: "Oman", isoCode: "OMN", indemnityRequired: false },
    { name: "Saudi Arabia", isoCode: "SAU", indemnityRequired: false },
    { name: "Russia", isoCode: "RUS", indemnityRequired: false },
    { name: "Singapore", isoCode: "SGP", indemnityRequired: false },
    { name: "Vietnam", isoCode: "VNM", indemnityRequired: false },
    { name: "Cambodia", isoCode: "KHM", indemnityRequired: false },
    { name: "Indonesia", isoCode: "IDN", indemnityRequired: false },
    { name: "Uzbekistan", isoCode: "UZB", indemnityRequired: false },
    { name: "Armenia", isoCode: "ARM", indemnityRequired: false },
    { name: "Georgia", isoCode: "GEO", indemnityRequired: false },
    { name: "Tajikistan", isoCode: "TJK", indemnityRequired: false },
    { name: "Qatar", isoCode: "QAT", indemnityRequired: false },
    { name: "Bahrain", isoCode: "BHR", indemnityRequired: false },
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
      name: "eVisa — Tourist",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 3,
      adultGovFee: 8000,
      adultServiceFee: 0,
      childGovFee: 8000,
      childServiceFee: 0,
      commission: 400,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "ARE",
      code: "UAE_BUSINESS_30",
      name: "Business visa — 30 days",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 550,
      adultServiceFee: 200,
      childGovFee: 550,
      childServiceFee: 200,
      commission: 80,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "AUS",
      code: "AUS_BUSINESS_600",
      name: "Business Visitor Visa (Subclass 600)",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 365,
      processingDays: 20,
      adultGovFee: 15887,
      adultServiceFee: 3500,
      childGovFee: 15887,
      childServiceFee: 3500,
      commission: 600,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "FRA",
      code: "SCHENGEN_BUSINESS",
      name: "Schengen business visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 90,
      durationDays: 90,
      processingDays: 15,
      adultGovFee: 6400,
      adultServiceFee: 1100,
      childGovFee: 6400,
      childServiceFee: 1100,
      commission: 350,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "GBR",
      code: "UK_BUSINESS_VISITOR",
      name: "Business visitor visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 180,
      durationDays: 180,
      processingDays: 15,
      adultGovFee: 11700,
      adultServiceFee: 1400,
      childGovFee: 11700,
      childServiceFee: 1400,
      commission: 450,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "THA",
      code: "THAILAND_BUSINESS",
      name: "Business visa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 60,
      durationDays: 60,
      processingDays: 15,
      adultGovFee: 2500,
      adultServiceFee: 500,
      childGovFee: 2500,
      childServiceFee: 500,
      commission: 180,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "USA",
      code: "US_B1_BUSINESS",
      name: "B1 business visa",
      entryType: "MULTIPLE",
      visaCategory: "STICKER_VISA",
      validityDays: 3650,
      durationDays: 180,
      processingDays: 30,
      adultGovFee: 14000,
      adultServiceFee: 2800,
      childGovFee: 14000,
      childServiceFee: 2800,
      commission: 900,
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
    // ---- B2B eVisa packages (gov fee = listed package price; service = extras e.g. courier) ----
    {
      countryIso: "OMN",
      code: "OMN_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 2600,
      adultServiceFee: 0,
      childGovFee: 2600,
      childServiceFee: 0,
      commission: 150,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "SAU",
      code: "SAU_EVISA",
      name: "eVisa",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 365,
      durationDays: 90,
      processingDays: 5,
      adultGovFee: 13000,
      adultServiceFee: 0,
      childGovFee: 13000,
      childServiceFee: 0,
      commission: 600,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "RUS",
      code: "RUS_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 60,
      durationDays: 16,
      processingDays: 7,
      adultGovFee: 6800,
      adultServiceFee: 0,
      childGovFee: 6800,
      childServiceFee: 0,
      commission: 300,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "SGP",
      code: "SGP_EVISA",
      name: "eVisa (+ courier)",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 4200,
      adultServiceFee: 800,
      childGovFee: 4200,
      childServiceFee: 800,
      commission: 250,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "VNM",
      code: "VNM_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 4000,
      adultServiceFee: 0,
      childGovFee: 4000,
      childServiceFee: 0,
      commission: 200,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "KHM",
      code: "KHM_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 4000,
      adultServiceFee: 0,
      childGovFee: 4000,
      childServiceFee: 0,
      commission: 200,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "IDN",
      code: "IDN_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 4000,
      adultServiceFee: 0,
      childGovFee: 4000,
      childServiceFee: 0,
      commission: 200,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "UZB",
      code: "UZB_EVISA_SINGLE",
      name: "eVisa — Single entry",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 2300,
      adultServiceFee: 0,
      childGovFee: 2300,
      childServiceFee: 0,
      commission: 120,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "UZB",
      code: "UZB_EVISA_DOUBLE",
      name: "eVisa — Double entry",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 3500,
      adultServiceFee: 0,
      childGovFee: 3500,
      childServiceFee: 0,
      commission: 150,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "UZB",
      code: "UZB_EVISA_MULTIPLE",
      name: "eVisa — Multiple entry",
      entryType: "MULTIPLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 4800,
      adultServiceFee: 0,
      childGovFee: 4800,
      childServiceFee: 0,
      commission: 200,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "ARM",
      code: "ARM_EVISA_SHORT",
      name: "eVisa — Short-term visitor",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 120,
      durationDays: 120,
      processingDays: 5,
      adultGovFee: 1100,
      adultServiceFee: 0,
      childGovFee: 1100,
      childServiceFee: 0,
      commission: 80,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "ARM",
      code: "ARM_EVISA_LONG",
      name: "eVisa — Long-term visitor",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 365,
      durationDays: 180,
      processingDays: 7,
      adultGovFee: 4000,
      adultServiceFee: 0,
      childGovFee: 4000,
      childServiceFee: 0,
      commission: 200,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "GEO",
      code: "GEO_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 30,
      processingDays: 5,
      adultGovFee: 8000,
      adultServiceFee: 0,
      childGovFee: 8000,
      childServiceFee: 0,
      commission: 350,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "TJK",
      code: "TJK_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 90,
      durationDays: 45,
      processingDays: 5,
      adultGovFee: 5500,
      adultServiceFee: 0,
      childGovFee: 5500,
      childServiceFee: 0,
      commission: 250,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "QAT",
      code: "QAT_EVISA",
      name: "eVisa",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 30,
      durationDays: 30,
      processingDays: 3,
      adultGovFee: 3200,
      adultServiceFee: 0,
      childGovFee: 3200,
      childServiceFee: 0,
      commission: 150,
      checklist: STANDARD_CHECKLIST,
    },
    {
      countryIso: "BHR",
      code: "BHR_EVISA_14",
      name: "eVisa — Single entry (14 days)",
      entryType: "SINGLE",
      visaCategory: "E_VISA",
      validityDays: 14,
      durationDays: 14,
      processingDays: 3,
      adultGovFee: 3900,
      adultServiceFee: 0,
      childGovFee: 3900,
      childServiceFee: 0,
      commission: 180,
      checklist: STANDARD_CHECKLIST,
    },
  ];

  for (const v of visaTypeDefs) {
    const visaType = await prisma.visaType.upsert({
      where: { countryId_code: { countryId: countryIds[v.countryIso], code: v.code } },
      update: {
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

    const adultPlatform = Math.round(v.adultServiceFee / 2);
    const childPlatform = Math.round(v.childServiceFee / 2);
    const existingRate = await prisma.visaTypeRate.findFirst({
      where: { visaTypeId: visaType.id },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!existingRate) {
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
    } else {
      await prisma.visaTypeRate.update({
        where: { id: existingRate.id },
        data: {
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
