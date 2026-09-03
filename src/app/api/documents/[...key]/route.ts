import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const storageKey = params.key.join("/");
  const document = await prisma.document.findFirst({
    where: { storageKey },
    include: { case: true },
  });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.role === "PARTNER" && document.case.partnerId !== session.partnerId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const buffer = await storage.get(storageKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `inline; filename="${document.fileName}"`,
    },
  });
}
