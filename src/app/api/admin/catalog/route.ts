import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createVisaTypeRateSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const countries = await prisma.country.findMany({
    orderBy: { name: "asc" },
    include: {
      visaTypes: {
        include: {
          rates: { orderBy: { effectiveFrom: "desc" }, take: 1 },
        },
      },
    },
  });

  return NextResponse.json({ countries });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createVisaTypeRateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rate = await prisma.visaTypeRate.create({
    data: {
      visaTypeId: parsed.data.visaTypeId,
      adultGovFee: parsed.data.adultGovFee,
      adultServiceFee: parsed.data.adultServiceFee,
      childGovFee: parsed.data.childGovFee,
      childServiceFee: parsed.data.childServiceFee,
      adultPlatformFee:
        parsed.data.adultPlatformFee ?? Math.round((parsed.data.adultServiceFee / 2) * 100) / 100,
      adultProcessorFee:
        parsed.data.adultProcessorFee ??
        parsed.data.adultServiceFee -
          (parsed.data.adultPlatformFee ?? Math.round((parsed.data.adultServiceFee / 2) * 100) / 100),
      childPlatformFee:
        parsed.data.childPlatformFee ?? Math.round((parsed.data.childServiceFee / 2) * 100) / 100,
      childProcessorFee:
        parsed.data.childProcessorFee ??
        parsed.data.childServiceFee -
          (parsed.data.childPlatformFee ?? Math.round((parsed.data.childServiceFee / 2) * 100) / 100),
      commission: parsed.data.commission,
    },
  });

  return NextResponse.json({ rate }, { status: 201 });
}
