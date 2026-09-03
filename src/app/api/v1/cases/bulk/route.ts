import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/apiAuth";
import { createCase, IndemnityRequiredError, NoPricingError, UnknownVisaTypeError } from "@/lib/caseCreation";
import { bulkCreateCaseSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Invalid API key." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bulkCreateCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const partner = await prisma.partner.findUnique({ where: { id: auth.partnerId } });
  if (!partner || partner.status !== "APPROVED") {
    return NextResponse.json({ error: "Partner account is not approved." }, { status: 403 });
  }

  const user = await prisma.user.findFirst({ where: { partnerId: auth.partnerId } });
  if (!user) return NextResponse.json({ error: "No user linked to partner." }, { status: 500 });

  const created = [];
  for (const applicant of parsed.data.applicants) {
    try {
      const kase = await createCase({
        partnerId: auth.partnerId,
        createdByUserId: user.id,
        countryId: parsed.data.countryId,
        visaTypeId: parsed.data.visaTypeId,
        applicationGrouping: "GROUP",
        travelerType: parsed.data.travelerType,
        applicant,
      });
      created.push(kase);
    } catch (err) {
      if (err instanceof IndemnityRequiredError || err instanceof NoPricingError || err instanceof UnknownVisaTypeError) {
        return NextResponse.json(
          { error: err.message, partialCases: created },
          { status: created.length > 0 ? 207 : 422 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ cases: created }, { status: 201 });
}
