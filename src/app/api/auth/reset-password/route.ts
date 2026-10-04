import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { resetPasswordSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rateLimit";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`reset:${clientIp(req)}`, { limit: 5, windowMs: 300_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);

  // Atomically claim the token so concurrent resets cannot both succeed.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gte: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
