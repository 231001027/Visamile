import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { commissionPayoutSchema } from "@/lib/validators";
import { processCommissionPayout } from "@/lib/caseApplicant";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = commissionPayoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const payout = await processCommissionPayout({
      partnerId: parsed.data.partnerId,
      adminUserId: session.sub,
      note: parsed.data.note,
    });

    await notify({
      partnerId: parsed.data.partnerId,
      channel: "EMAIL",
      subject: "Commission credited to your wallet",
      body: `₹${Number(payout.amount).toFixed(2)} commission for ${payout.caseCount} case(s) has been credited to your wallet.`,
    });

    return NextResponse.json({ payout }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payout failed." },
      { status: 422 }
    );
  }
}
