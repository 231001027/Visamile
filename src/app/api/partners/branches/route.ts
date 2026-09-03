import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { addBranchSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const branches = await prisma.partnerBranch.findMany({
    where: { partnerId: session.partnerId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = addBranchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const branch = await prisma.partnerBranch.create({
    data: { partnerId: session.partnerId, ...parsed.data },
  });
  return NextResponse.json({ branch }, { status: 201 });
}
