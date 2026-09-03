import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { registerConsumerSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`register-consumer:${clientIp(req)}`, { limit: 10, windowMs: 300_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = registerConsumerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid name, email, and password (min 8 characters)." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: "CONSUMER",
        active: true,
      },
    });

    let token: string;
    try {
      token = await signSession({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: "CONSUMER",
        partnerId: null,
      });
    } catch (err) {
      console.error("[register-consumer] session sign failed:", err);
      return NextResponse.json(
        {
          error:
            "Account was created but login session failed. Check AUTH_SECRET in Vercel env vars, then log in.",
        },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ role: "CONSUMER", ok: true }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    console.error("[register-consumer] failed:", err);
    const message = err instanceof Error ? err.message : "Registration failed.";
    // Surface common misconfig without leaking stack traces
    if (message.includes("DATABASE_URL") || message.includes("Can't reach database")) {
      return NextResponse.json(
        { error: "Database connection failed. Check DATABASE_URL on Vercel." },
        { status: 500 }
      );
    }
    if (message.includes("AUTH_SECRET")) {
      return NextResponse.json(
        { error: "AUTH_SECRET is missing or too short in Vercel environment variables." },
        { status: 500 }
      );
    }
    if (message.includes("CONSUMER") || message.includes("invalid input value for enum")) {
      return NextResponse.json(
        { error: "Database schema is outdated. Run prisma migrate deploy against production." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
