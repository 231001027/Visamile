import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { acceptIndemnitySchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const accepted = await prisma.partnerIndemnityAcceptance.findMany({
    where: { partnerId: session.partnerId },
    include: { country: { select: { name: true, isoCode: true } } },
  });
  return NextResponse.json({ accepted });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = acceptIndemnitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "countryId is required." }, { status: 400 });

  const acceptance = await prisma.partnerIndemnityAcceptance.upsert({
    where: { partnerId_countryId: { partnerId: session.partnerId, countryId: parsed.data.countryId } },
    update: {},
    create: { partnerId: session.partnerId, countryId: parsed.data.countryId },
  });
  return NextResponse.json({ acceptance });
}
