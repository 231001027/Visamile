import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const key = await prisma.partnerApiKey.findUnique({ where: { id: params.id } });
  if (!key || key.partnerId !== session.partnerId) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }

  await prisma.partnerApiKey.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
