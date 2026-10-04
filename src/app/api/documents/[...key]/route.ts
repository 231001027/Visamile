import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";

function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[ext] || "application/octet-stream";
}

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
  if (session.role === "CONSUMER" && document.case.consumerUserId !== session.sub) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (session.role === "PROCESSOR") {
    const isAssigned = document.case.assignedProcessorId === session.sub;
    const isOpenQueue =
      !document.case.assignedProcessorId && document.case.status === "UNDER_VERIFICATION";
    if (!isAssigned && !isOpenQueue) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const buffer = await storage.get(storageKey);
  const safeName = document.fileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeFor(document.fileName),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
