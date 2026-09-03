import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { bulkCreateCaseSchema } from "@/lib/validators";
import { createCase, IndemnityRequiredError, NoPricingError, UnknownVisaTypeError } from "@/lib/caseCreation";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Only partner users can create cases." }, { status: 403 });
  }
  const partner = await prisma.partner.findUnique({ where: { id: session.partnerId } });
  if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  if (partner.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Your partner account must be approved before you can submit cases." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkCreateCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { countryId, visaTypeId, travelerType, applicants } = parsed.data;

  // Bulk rows only capture the minimum (name + passport number) — the rest
  // of the passport/applicant fields can be filled in from the case detail
  // page before payment, same as a single Apply Visa case left partially
  // complete.
  const created: Awaited<ReturnType<typeof createCase>>[] = [];
  try {
    for (const applicant of applicants) {
      const kase = await createCase({
        partnerId: partner.id,
        createdByUserId: session.sub,
        countryId,
        visaTypeId,
        applicationGrouping: "GROUP",
        travelerType,
        applicant,
      });
      created.push(kase);
    }
  } catch (err) {
    // Partial-batch note: any cases already created above stay created —
    // bulk apply is "create N independent cases", not one atomic unit, so
    // a failure partway through (e.g. pricing removed mid-batch) doesn't
    // roll back the ones that already succeeded. They're visible in
    // Pending Payment either way.
    if (err instanceof IndemnityRequiredError) return NextResponse.json({ error: err.message, casesCreated: created.length }, { status: 422 });
    if (err instanceof NoPricingError) return NextResponse.json({ error: err.message, casesCreated: created.length }, { status: 422 });
    if (err instanceof UnknownVisaTypeError) return NextResponse.json({ error: err.message, casesCreated: created.length }, { status: 400 });
    throw err;
  }

  return NextResponse.json({ cases: created }, { status: 201 });
}
