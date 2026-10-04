import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assignProcessorSchema } from "@/lib/validators";

const TERMINAL = new Set(["CANCELLED", "DELIVERED", "REJECTED"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = assignProcessorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const processor = await prisma.user.findFirst({
    where: { id: parsed.data.processorUserId, role: "PROCESSOR", active: true },
  });
  if (!processor) {
    return NextResponse.json({ error: "Processor not found." }, { status: 404 });
  }

  const existing = await prisma.case.findUnique({ where: { id: parsed.data.caseId } });
  if (!existing) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  if (TERMINAL.has(existing.status)) {
    return NextResponse.json(
      { error: `Cannot assign a processor to a ${existing.status.toLowerCase()} case.` },
      { status: 409 }
    );
  }

  const kase = await prisma.case.update({
    where: { id: existing.id },
    data: { assignedProcessorId: processor.id },
  });

  await prisma.caseStatusEvent.create({
    data: {
      caseId: kase.id,
      fromStatus: kase.status,
      toStatus: kase.status,
      note: `Assigned to processor ${processor.name}`,
      actorUserId: session.sub,
    },
  });

  return NextResponse.json({ case: kase });
}
