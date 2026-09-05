import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { storage, buildStorageKey } from "@/lib/storage";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB, matches "Max File Size - 5 MB" on the reference screens
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "GST" && kind !== "CANCEL_CHEQUE")) {
    return NextResponse.json({ error: "file and a valid kind (GST or CANCEL_CHEQUE) are required." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only PDF, PNG, or JPEG files are accepted." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 5 MB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = buildStorageKey(`partners/${session.partnerId}`, file.name);

  try {
    const savedKey = await storage.put(storageKey, buffer, file.type);

    const partner = await prisma.partner.update({
      where: { id: session.partnerId },
      data:
        kind === "GST"
          ? { gstDocumentKey: savedKey, gstDocumentStatus: "PENDING" } // re-upload resets approval
          : { cancelChequeKey: savedKey },
    });

    return NextResponse.json({ partner });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[profile/documents] upload failed:", err);
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
