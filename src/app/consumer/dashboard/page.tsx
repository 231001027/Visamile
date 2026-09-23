import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Dashboard aliases the cases list. */
export default function ConsumerDashboardPage() {
  redirect("/consumer/cases");
}
