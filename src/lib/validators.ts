import { z } from "zod";

export const registerPartnerSchema = z.object({
  companyName: z.string().min(2).max(200),
  country: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(6).max(30).optional(),
  adminName: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------- Partner profile update ("Profile Update For Agent") ----------

export const updateProfileSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(30).optional(),
  invoiceFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  contactPersonName: z.string().max(150).optional(),
  contactPersonEmail: z.string().email().optional().or(z.literal("")),
  contactPersonMobile: z.string().max(30).optional(),
  salesPersonId: z.string().optional(),
  financePersonEmail: z.string().email().optional().or(z.literal("")),

  gstRegistered: z.boolean().optional(),
  gstNo: z.string().max(20).optional(),
  panNo: z.string().max(20).optional(),
  tanNo: z.string().max(20).optional(),
  gstCountry: z.string().max(100).optional(),
  gstState: z.string().max(100).optional(),
  gstCity: z.string().max(100).optional(),
  gstPin: z.string().max(12).optional(),
  gstAddress: z.string().max(500).optional(),

  msme: z.boolean().optional(),

  bankBeneficiaryName: z.string().max(150).optional(),
  bankAccountNo: z.string().max(40).optional(),
  bankType: z.string().max(40).optional(),
  bankName: z.string().max(150).optional(),
  bankIfsc: z.string().max(20).optional(),

  walletTermsAccepted: z.boolean().optional(),
});

export const addBranchSchema = z.object({
  label: z.string().min(2).max(150),
  gstNo: z.string().max(20).optional(),
  panNo: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  bankBeneficiaryName: z.string().max(150).optional(),
  bankAccountNo: z.string().max(40).optional(),
  bankIfsc: z.string().max(20).optional(),
});

export const acceptIndemnitySchema = z.object({
  countryId: z.string().min(1),
});

// ---------- Case creation ("Apply Visa") ----------

const optionalCalendarDate = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const y = d.getUTCFullYear();
      return y >= 1900 && y <= 2100;
    },
    { message: "Enter a valid date between 1900 and 2100." }
  );

export const createCaseSchema = z.object({
  countryId: z.string().min(1),
  visaTypeId: z.string().min(1),
  applicationGrouping: z.enum(["INDIVIDUAL", "GROUP", "FAMILY"]).default("INDIVIDUAL"),
  travelerType: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  departureDate: optionalCalendarDate,
  returnDate: optionalCalendarDate,

  applicantFirstName: z.string().min(1).max(100),
  applicantLastName: z.string().min(1).max(100),
  applicantPassportNo: z.string().min(4).max(30),
  passportIssueDate: optionalCalendarDate,
  passportExpiryDate: optionalCalendarDate,
  gender: z.string().max(20).optional(),
  dateOfBirth: optionalCalendarDate,
  placeOfBirth: z.string().max(150).optional(),
  fatherName: z.string().max(150).optional(),
  motherName: z.string().max(150).optional(),
  spouseName: z.string().max(150).optional(),
  bookingId: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  applicantEmail: z.string().email().optional().or(z.literal("")),
  applicantPhone: z.string().max(30).optional().or(z.literal("")),
});

export const bulkCreateCaseSchema = z.object({
  countryId: z.string().min(1),
  visaTypeId: z.string().min(1),
  travelerType: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  applicants: z
    .array(
      z.object({
        applicantFirstName: z.string().min(1).max(100),
        applicantLastName: z.string().min(1).max(100),
        applicantPassportNo: z.string().min(4).max(30),
      })
    )
    .min(1)
    .max(50),
});

export const updateCaseStatusSchema = z.object({
  toStatus: z.enum([
    "DRAFT",
    "PENDING_PAYMENT",
    "PAID",
    "UNDER_VERIFICATION",
    "SUBMITTED",
    "ADDITIONAL_DOCS_REQUESTED",
    "APPROVED",
    "REJECTED",
    "DELIVERED",
    "CANCELLED",
  ]),
  note: z.string().max(1000).optional(),
});

// ---------- Wallet ----------

export const payCasesSchema = z.object({
  caseIds: z.array(z.string().min(1)).min(1).max(200),
});

export const payCasesOnlineSchema = z.object({
  caseIds: z.array(z.string().min(1)).min(1).max(200),
  method: z.enum(["UPI", "NETBANKING", "CARD"]),
});

export const walletTopupSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  method: z.enum(["UPI", "NETBANKING", "CARD"]),
});

export const documentTypeSchema = z.enum([
  "PASSPORT_FRONT_PAGE",
  "PASSPORT_BACK_PAGE",
  "PHOTOGRAPH",
  "PAN_CARD",
  "GOVERNMENT_EMPLOYEE_DOCS",
  "RETIRED_SENIOR_CITIZEN_DOCS",
  "TRAVEL_HISTORY",
  "SALARIED_EMPLOYEE_DOCS",
  "BUSINESS_OWNER_DOCS",
  "PROFESSIONAL_DOCS",
  "STUDENT_WITH_PARENTS_DOCS",
  "STUDENT_WITHOUT_PARENTS_DOCS",
  "INVITATION_DOCS",
  "COVERING_LETTER",
  "IDENTITY_PROOF",
  "PERSONAL_FINANCIAL_DOCS",
  "LEGAL_DOCUMENT",
  "OTHER_DOCUMENT",
]);

export const updateCaseApplicantSchema = createCaseSchema.pick({
  applicantFirstName: true,
  applicantLastName: true,
  applicantPassportNo: true,
  passportIssueDate: true,
  passportExpiryDate: true,
  gender: true,
  dateOfBirth: true,
  placeOfBirth: true,
  fatherName: true,
  motherName: true,
  spouseName: true,
  bookingId: true,
  address: true,
  applicantEmail: true,
  applicantPhone: true,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(100),
});

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(100),
});

export const commissionPayoutSchema = z.object({
  partnerId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export const createVisaTypeRateSchema = z.object({
  visaTypeId: z.string().min(1),
  adultGovFee: z.number().nonnegative(),
  adultServiceFee: z.number().nonnegative(),
  childGovFee: z.number().nonnegative(),
  childServiceFee: z.number().nonnegative(),
  adultPlatformFee: z.number().nonnegative().optional(),
  adultProcessorFee: z.number().nonnegative().optional(),
  childPlatformFee: z.number().nonnegative().optional(),
  childProcessorFee: z.number().nonnegative().optional(),
  commission: z.number().nonnegative().default(0),
});

export const registerConsumerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().max(30).optional(),
});

export const createProcessorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const assignProcessorSchema = z.object({
  caseId: z.string().min(1),
  processorUserId: z.string().min(1),
});
