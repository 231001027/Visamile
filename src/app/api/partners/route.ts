import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateAgentCode } from "@/lib/agentCode";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: true, users: true } } },
  });
  return NextResponse.json({ partners });
}

const patchSchema = z.object({
  partnerId: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.partner.findUnique({ where: { id: parsed.data.partnerId } });
  if (!target) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

  const needsAgentCode = parsed.data.status === "APPROVED" && !target.agentCode;
  const partner = await prisma.partner.update({
    where: { id: parsed.data.partnerId },
    data: {
      status: parsed.data.status,
      ...(needsAgentCode ? { agentCode: await generateAgentCode() } : {}),
    },
  });
  return NextResponse.json({ partner });
}
