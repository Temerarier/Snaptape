import { and, eq, gte, lt, sql } from "drizzle-orm";
import { creditLedgerTable, db } from "@workspace/db";
import type { CreditTx } from "./service";

export function trialDailyLimit(value = process.env.TRIAL_DAILY_LIMIT): number {
  if (value === undefined) return 20;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("TRIAL_DAILY_LIMIT must be a non-negative integer");
  }
  return Number(value);
}

export function trialDayBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function trialStatus(conn: CreditTx | typeof db = db, now = new Date()) {
  const { start, end } = trialDayBounds(now);
  const [row] = await conn.select({ count: sql<number>`count(*)::int` })
    .from(creditLedgerTable).where(and(
      eq(creditLedgerTable.reason, "trial_grant"),
      gte(creditLedgerTable.createdAt, start),
      lt(creditLedgerTable.createdAt, end),
    ));
  return { granted: Number(row?.count ?? 0), limit: trialDailyLimit() };
}

// Called ONLY immediately after inserting a brand-new user, in that same transaction.
// Returning/reattached users must never enter this path, even if previously capped.
export async function grantNewUserTrial(tx: CreditTx, userId: string): Promise<void> {
  // A separate two-key advisory-lock namespace avoids the identity lock's namespace.
  // All instances serialize the count + booking until the user transaction commits.
  await tx.execute(sql`select pg_advisory_xact_lock(729104, 1)`);
  const now = new Date();
  const { granted, limit } = await trialStatus(tx, now);
  if (granted >= limit) return;
  await tx.insert(creditLedgerTable).values({
    userId, delta: 1, reason: "trial_grant", note: "free trial", createdAt: now,
  }).onConflictDoNothing();
}
