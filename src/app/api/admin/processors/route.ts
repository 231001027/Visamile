import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { createProcessorSchema } from "@/lib/validators";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const processors = await prisma.user.findMany({
    where: { role: "PROCESSOR" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      _count: {
        select: {
          assignedProcessorCases: {
            where: {
              status: { in: ["UNDER_VERIFICATION", "SUBMITTED", "ADDITIONAL_DOCS_REQUESTED"] },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    processors: processors.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      active: p.active,
      createdAt: p.createdAt,
      openCases: p._count.assignedProcessorCases,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createProcessorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "PROCESSOR",
      active: true,
    },
    select: { id: true, name: true, email: true, active: true, createdAt: true },
  });

  return NextResponse.json({ processor: user }, { status: 201 });
}
