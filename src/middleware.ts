import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPartnerArea = pathname.startsWith("/partner");
  const isAdminArea = pathname.startsWith("/admin");
  if (!isPartnerArea && !isAdminArea) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPartnerArea && session.role !== "PARTNER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAdminArea && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/partner/:path*", "/admin/:path*"],
};
