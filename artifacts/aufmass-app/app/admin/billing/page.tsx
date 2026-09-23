import { requireStaff } from "@/lib/auth/staff";
import { getDictionary, toLocale } from "@/i18n";
import { adminGetBillingDashboard } from "@/lib/billing/actions";
import { BillingDashboardClient } from "./BillingDashboardClient";
import type { BillingDashboardFilter, BillingProvider } from "@/lib/billing/types";
import { utcDay } from "@/lib/billing/time";
import { db, billingTopupRevisionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireStaff();
  const dict = getDictionary(toLocale(user.locale));
  const searchParams = await props.searchParams;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  let from = typeof searchParams.from === "string" ? searchParams.from : utcDay(sevenDaysAgo);
  let to = typeof searchParams.to === "string" ? searchParams.to : utcDay(now);

  // Validate dates: valid format, from <= to, max 366 days
  const fromMs = Date.parse(from + "T00:00:00Z");
  const toMs = Date.parse(to + "T00:00:00Z");
  if (isNaN(fromMs) || isNaN(toMs) || fromMs > toMs || toMs - fromMs > 366 * 86400000) {
    from = utcDay(sevenDaysAgo);
    to = utcDay(now);
  }

  const providerParam = searchParams.provider;
  const provider: BillingProvider | undefined = 
    providerParam === "anthropic" || providerParam === "moonshot" ? providerParam : undefined;

  const modelParam = searchParams.model;
  const model = typeof modelParam === "string" && modelParam !== "all" ? modelParam : undefined;

  const filter: BillingDashboardFilter = {
    from,
    to,
    provider,
    model,
  };

  const rows = await adminGetBillingDashboard(filter);

  const topupRevisions = await db
    .select()
    .from(billingTopupRevisionsTable)
    .orderBy(desc(billingTopupRevisionsTable.createdAt))
    .limit(100);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <BillingDashboardClient 
        dict={dict} 
        initialRows={rows} 
        initialFilter={filter} 
        topupRevisions={topupRevisions}
      />
    </main>
  );
}
