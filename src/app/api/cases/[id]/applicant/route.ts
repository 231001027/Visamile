import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateCaseApplicantSchema } from "@/lib/validators";
import { updateCaseApplicant, decryptCasePassport } from "@/lib/caseApplicant";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateCaseApplicantSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await updateCaseApplicant({
      caseId: params.id,
      partnerId: session.partnerId,
      applicant: parsed.data,
    });
    return NextResponse.json({ case: decryptCasePassport(updated) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 409 }
    );
  }
}
