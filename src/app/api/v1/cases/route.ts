import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { createCase, IndemnityRequiredError, NoPricingError, UnknownVisaTypeError } from "@/lib/caseCreation";
import { createCaseSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid API key." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const partner = await prisma.partner.findUnique({ where: { id: auth.partnerId } });
  if (!partner || partner.status !== "APPROVED") {
    return NextResponse.json({ error: "Partner account is not approved." }, { status: 403 });
  }

  const user = await prisma.user.findFirst({ where: { partnerId: auth.partnerId } });
  if (!user) return NextResponse.json({ error: "No user linked to partner." }, { status: 500 });

  try {
    const kase = await createCase({
      partnerId: auth.partnerId,
      createdByUserId: user.id,
      countryId: parsed.data.countryId,
      visaTypeId: parsed.data.visaTypeId,
      applicationGrouping: parsed.data.applicationGrouping,
      travelerType: parsed.data.travelerType,
      departureDate: parsed.data.departureDate,
      returnDate: parsed.data.returnDate,
      applicant: parsed.data,
    });
    return NextResponse.json({ case: kase }, { status: 201 });
  } catch (err) {
    if (err instanceof IndemnityRequiredError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof NoPricingError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof UnknownVisaTypeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
