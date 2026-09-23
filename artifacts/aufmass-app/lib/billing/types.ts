export type BillingProvider = "anthropic" | "moonshot";
export type BillingStatus =
  | "reconciled"
  | "not_reconciled_key_rejected"
  | "missing"
  | "partial"
  | "provisional"
  | "no_data";

export interface BillingDashboardFilter {
  from: string;
  to: string;
  provider?: BillingProvider;
  model?: string;
}

export interface BillingDashboardRow {
  utcDay: string;
  provider: BillingProvider;
  model: string | null;
  accountScope: string;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  estimatedRunCount: number;
  missingCostRunCount: number;
  estimateIncomplete: boolean;
  differencePercent: number | null;
  flagged: boolean;
  periodStartAt: string | null;
  periodEndAt: string | null;
  status: BillingStatus;
  detail: string | null;
}

export interface RunDailyBillingResult {
  locked: boolean;
  anthropic: { attempted: boolean; status: string; rows: number };
  moonshot: { attempted: boolean; status: string; inserted: boolean };
}
