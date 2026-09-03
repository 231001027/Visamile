import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createApiKeySchema } from "@/lib/validators";
import { generateApiKey } from "@/lib/apiAuth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const keys = await prisma.partnerApiKey.findMany({
    where: { partnerId: session.partnerId, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { raw, prefix, hash } = generateApiKey();
  const key = await prisma.partnerApiKey.create({
    data: {
      partnerId: session.partnerId,
      name: parsed.data.name,
      keyPrefix: prefix,
      keyHash: hash,
    },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  });

  return NextResponse.json({ key, rawKey: raw }, { status: 201 });
}
