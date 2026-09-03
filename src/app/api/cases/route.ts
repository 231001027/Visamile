import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createCaseSchema } from "@/lib/validators";
import { createCase, IndemnityRequiredError, NoPricingError, UnknownVisaTypeError } from "@/lib/caseCreation";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const where =
    session.role === "PARTNER"
      ? { partnerId: session.partnerId ?? "__none__", ...(status ? { status: status as any } : {}) }
      : { ...(status ? { status: status as any } : {}) };

  const cases = await prisma.case.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true } },
    },
    take: 100,
  });

  return NextResponse.json({ cases });
}

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
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  try {
    const created = await createCase({
      partnerId: partner.id,
      createdByUserId: session.sub,
      countryId: data.countryId,
      visaTypeId: data.visaTypeId,
      applicationGrouping: data.applicationGrouping,
      travelerType: data.travelerType,
      departureDate: data.departureDate,
      returnDate: data.returnDate,
      applicant: data,
    });
    return NextResponse.json({ case: created }, { status: 201 });
  } catch (err) {
    if (err instanceof IndemnityRequiredError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof NoPricingError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof UnknownVisaTypeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
