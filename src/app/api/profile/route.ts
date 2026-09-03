import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { updateProfileSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const [partner, salesPersons, branches] = await Promise.all([
    prisma.partner.findUnique({ where: { id: session.partnerId }, include: { salesPerson: true } }),
    prisma.salesPerson.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.partnerBranch.findMany({ where: { partnerId: session.partnerId }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ partner, salesPersons, branches });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { walletTermsAccepted, ...rest } = parsed.data;

  const partner = await prisma.partner.update({
    where: { id: session.partnerId },
    data: {
      ...rest,
      ...(walletTermsAccepted ? { walletTermsAcceptedAt: new Date() } : {}),
    },
  });
  return NextResponse.json({ partner });
}
