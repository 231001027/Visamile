import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { loginSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`login:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately identical error for "no such user" and "wrong password" —
  // don't leak which emails are registered.
  const invalid = () => NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });

  if (!user) return invalid();
  if (!user.active) {
    return NextResponse.json({ error: "This account is inactive. Contact support." }, { status: 403 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  if (user.role === "PARTNER" && user.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: user.partnerId } });
    if (partner?.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "This partner account is suspended. Contact support." },
        { status: 403 }
      );
    }
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "PARTNER" | "ADMIN" | "CONSUMER" | "PROCESSOR",
    partnerId: user.partnerId,
  });

  const res = NextResponse.json({ role: user.role });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}
