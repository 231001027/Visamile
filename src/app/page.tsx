import { HomeLanding } from "@/components/marketing/HomeLanding";
import { FALLBACK_CATALOG } from "@/lib/marketingCatalog";
import { getMarketingCatalog } from "@/lib/publicCatalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let countries = FALLBACK_CATALOG;
  try {
    const live = await getMarketingCatalog();
    if (live.length > 0) countries = live;
  } catch {
    /* keep fallback */
  }

  return <HomeLanding countries={countries} />;
}
