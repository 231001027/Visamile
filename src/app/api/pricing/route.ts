import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Three modes, matching the three real screens:
//  - no params: full country list (for the nationality/destination selects)
//  - ?visaTypeId=...: the active rate for one specific visa package (Apply Visa)
//  - ?countryId=...&bulk=true: every bulk-eligible visa package for that
//    country, grouped by bulkCategoryLabel (Bulk Apply Visa)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const visaTypeId = searchParams.get("visaTypeId");
  const countryId = searchParams.get("countryId");
  const bulk = searchParams.get("bulk") === "true";

  if (bulk && countryId) {
    const visaTypes = await prisma.visaType.findMany({
      where: { countryId, isBulkEligible: true },
      include: { rates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
      orderBy: { bulkCategoryLabel: "asc" },
    });
    return NextResponse.json({ visaTypes });
  }

  if (!visaTypeId) {
    const countries = await prisma.country.findMany({
      include: { visaTypes: { where: { isBulkEligible: false } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ countries });
  }

  const visaType = await prisma.visaType.findUnique({
    where: { id: visaTypeId },
    include: { rates: { orderBy: { effectiveFrom: "desc" }, take: 1 }, country: true },
  });
  if (!visaType) return NextResponse.json({ error: "Unknown visa type." }, { status: 404 });

  return NextResponse.json({
    visaType,
    rate: visaType.rates[0] ?? null,
    indemnityRequired: visaType.country.indemnityRequired,
  });
}
