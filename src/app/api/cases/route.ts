import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createCaseSchema } from "@/lib/validators";
import { createCase, IndemnityRequiredError, NoPricingError, UnknownVisaTypeError } from "@/lib/caseCreation";
import { storage, buildStorageKey } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  let where: Record<string, unknown> = status ? { status } : {};
  if (session.role === "PARTNER") {
    where = { ...where, partnerId: session.partnerId ?? "__none__" };
  } else if (session.role === "CONSUMER") {
    where = { ...where, consumerUserId: session.sub };
  } else if (session.role === "PROCESSOR") {
    where = {
      ...where,
      OR: [
        { assignedProcessorId: session.sub },
        { assignedProcessorId: null, status: "UNDER_VERIFICATION" },
      ],
    };
  }

  const cases = await prisma.case.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      visaType: { include: { country: true } },
      partner: { select: { companyName: true } },
      consumer: { select: { name: true, email: true } },
      assignedProcessor: { select: { name: true } },
    },
    take: 100,
  });

  return NextResponse.json({ cases });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (session.role !== "PARTNER" && session.role !== "CONSUMER") {
    return NextResponse.json({ error: "Only partners or consumers can create cases." }, { status: 403 });
  }

  if (session.role === "PARTNER") {
    if (!session.partnerId) {
      return NextResponse.json({ error: "Partner not linked." }, { status: 403 });
    }
    const partner = await prisma.partner.findUnique({ where: { id: session.partnerId } });
    if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
    if (partner.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Your partner account must be approved before you can submit cases." },
        { status: 403 }
      );
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const fieldMsgs = Object.entries(flat.fieldErrors)
      .flatMap(([field, msgs]) => (msgs ?? []).map((m) => `${field}: ${m}`));
    const message =
      flat.formErrors[0] ||
      fieldMsgs[0] ||
      "Please check the form and try again.";
    return NextResponse.json(
      { error: message, details: flat },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const created = await createCase({
      partnerId: session.role === "PARTNER" ? session.partnerId : null,
      consumerUserId: session.role === "CONSUMER" ? session.sub : null,
      createdByUserId: session.sub,
      countryId: data.countryId,
      visaTypeId: data.visaTypeId,
      applicationGrouping: data.applicationGrouping,
      travelerType: data.travelerType,
      departureDate: data.departureDate,
      returnDate: data.returnDate,
      applicant: data,
      skipIndemnityCheck: session.role === "CONSUMER",
    });

    // Attach OCR passport scan as PASSPORT_FRONT_PAGE when a temp upload was provided.
    if (data.passportTempStorageKey) {
      const expectedPrefix = `ocr-temp/${session.sub}/`;
      if (!data.passportTempStorageKey.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: "Invalid passport upload reference.", case: created },
          { status: 400 }
        );
      }
      try {
        const bytes = await storage.get(data.passportTempStorageKey);
        const fileName = data.passportFileName || "passport-front.jpg";
        const destKey = buildStorageKey(`cases/${created.id}`, fileName);
        const contentType = fileName.toLowerCase().endsWith(".png")
          ? "image/png"
          : fileName.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "image/jpeg";
        const savedKey = await storage.put(destKey, bytes, contentType);
        await prisma.document.create({
          data: {
            caseId: created.id,
            type: "PASSPORT_FRONT_PAGE",
            fileName,
            storageKey: savedKey,
            uploadedByUserId: session.sub,
          },
        });
      } catch (attachErr) {
        console.error("[cases] passport attach failed:", attachErr);
        // Case already created — traveler can re-upload on the case page.
      }
    }

    return NextResponse.json({ case: created }, { status: 201 });
  } catch (err) {
    if (err instanceof IndemnityRequiredError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof NoPricingError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof UnknownVisaTypeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
