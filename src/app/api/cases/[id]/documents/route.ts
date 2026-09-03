import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";
import { documentTypeSchema } from "@/lib/validators";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const kase = await prisma.case.findUnique({ where: { id: params.id } });
  if (!kase) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  if (session.role === "PARTNER" && kase.partnerId !== session.partnerId) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const typeRaw = form?.get("type");
  if (!(file instanceof File) || typeof typeRaw !== "string") {
    return NextResponse.json({ error: "file and type are required." }, { status: 400 });
  }
  const typeParsed = documentTypeSchema.safeParse(typeRaw);
  if (!typeParsed.success) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only PDF, PNG, or JPEG files are accepted." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10 MB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { scanDocument } = await import("@/lib/scan");
    await scanDocument(buffer, file.type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Document scan failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const storageKey = buildStorageKey(`cases/${kase.id}`, file.name);
  await storage.put(storageKey, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      caseId: kase.id,
      type: typeParsed.data,
      fileName: file.name,
      storageKey,
      uploadedByUserId: session.sub,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
