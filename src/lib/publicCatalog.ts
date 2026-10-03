import { prisma } from "@/lib/prisma";
import type { MarketingCountry, MarketingPackage } from "@/lib/marketingCatalog";

function num(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

/** Public marketing catalog — no auth. One card per non-bulk package. */
export async function getMarketingCatalog(): Promise<MarketingCountry[]> {
  const countries = await prisma.country.findMany({
    include: {
      visaTypes: {
        where: { isBulkEligible: false },
        include: { rates: { orderBy: { effectiveFrom: "desc" }, take: 1 } },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return countries
    .map((c) => {
      const packages: MarketingPackage[] = c.visaTypes.map((vt) => {
        const rate = vt.rates[0];
        const feeInr = num(rate?.adultGovFee) + num(rate?.adultServiceFee);
        return {
          countryId: c.id,
          countryName: c.name,
          isoCode: c.isoCode,
          visaTypeId: vt.id,
          visaName: vt.name,
          visaCategory: vt.visaCategory,
          validityDays: vt.validityDays,
          processingDays: vt.processingDays,
          feeInr,
        };
      });
      return {
        id: c.id,
        name: c.name,
        isoCode: c.isoCode,
        packages,
      };
    })
    .filter((c) => c.packages.length > 0);
}
