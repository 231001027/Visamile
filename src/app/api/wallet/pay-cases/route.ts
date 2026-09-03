import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { payCasesFromWallet, InsufficientBalanceError } from "@/lib/ledger";
import { payCasesSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "PARTNER" || !session.partnerId) {
    return NextResponse.json({ error: "Only partner users can pay cases." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payCasesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await payCasesFromWallet({
      partnerId: session.partnerId,
      caseIds: parsed.data.caseIds,
      actorUserId: session.sub,
    });
    await notify({
      partnerId: session.partnerId,
      channel: "INAPP",
      subject: `${result.casesPaid} case(s) paid`,
      body: `₹${result.total.toFixed(2)} debited from your wallet. New balance ₹${result.balanceAfter.toFixed(2)}.`,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
