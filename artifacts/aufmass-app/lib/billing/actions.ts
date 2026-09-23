"use server";

import { requireStaff } from "@/lib/auth/staff";
import { runDailyBilling, recordTopup, correctTopup } from "./service";
import { getBillingDashboard } from "./service";
import type { BillingDashboardFilter } from "./types";

export async function adminGetBillingDashboard(filter: BillingDashboardFilter) {
  await requireStaff();
  return getBillingDashboard(filter);
}

export async function adminRunDailyBilling(retryAnthropicAuth?: boolean) {
  await requireStaff();
  return runDailyBilling({ retryAnthropicAuth });
}

export async function adminRecordTopup(input: {
  amountUsd: number;
  effectiveAt: string;
  note: string;
  accountScope: string;
}) {
  const staff = await requireStaff();
  return recordTopup({
    ...input,
    effectiveAt: new Date(input.effectiveAt),
    staffActor: staff.email || staff.id,
  });
}

export async function adminCorrectTopup(input: {
  topupId: string;
  amountUsd: number;
  effectiveAt: string;
  note: string;
}) {
  const staff = await requireStaff();
  return correctTopup({
    ...input,
    effectiveAt: new Date(input.effectiveAt),
    staffActor: staff.email || staff.id,
  });
}
