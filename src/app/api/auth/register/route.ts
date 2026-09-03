import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { registerPartnerSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerPartnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { companyName, country, contactEmail, contactPhone, adminName, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: contactEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  // New partner companies start PENDING — an ops/admin user has to approve
  // them before they can transact. This is the KYB gate called out in
  // section 2 of the architecture doc.
  const { partner, user } = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: { companyName, country, contactEmail, contactPhone, status: "PENDING" },
    });
    const user = await tx.user.create({
      data: {
        email: contactEmail,
        passwordHash,
        name: adminName,
        role: "PARTNER",
        partnerId: partner.id,
      },
    });
    return { partner, user };
  });

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: "PARTNER",
    partnerId: partner.id,
  });

  const res = NextResponse.json({
    message: "Account created. Your partner account is pending approval before you can submit cases.",
  });
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}
