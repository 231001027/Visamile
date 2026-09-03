import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 300_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always return success to avoid email enumeration
  if (!user) {
    return NextResponse.json({ ok: true, message: "If that email exists, a reset link has been sent." });
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  await notify({
    partnerId: user.partnerId,
    channel: "EMAIL",
    subject: "Reset your Visamile password",
    body: `Use this link to reset your password (valid for 1 hour):\n\n${resetUrl}`,
  });

  return NextResponse.json({ ok: true, message: "If that email exists, a reset link has been sent." });
}
