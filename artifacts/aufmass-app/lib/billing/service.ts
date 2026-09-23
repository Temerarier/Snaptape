import { pool } from "@workspace/db";
import {
  anthropicRange,
  fetchAnthropicCosts,
  fetchMoonshotBalance,
  ProviderHttpError,
  type AnthropicCost,
} from "./providers";
import { assertUtcDay, completedUtcDays, utcDay } from "./time";
import type {
  BillingDashboardFilter,
  BillingDashboardRow,
  BillingProvider,
  RunDailyBillingResult,
} from "./types";

const LOCK_KEY = 930_093;
const ACCOUNT_MODEL = "__account__";
const ANTHROPIC_SCOPE = "anthropic-organization";

type Queryable = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: any[]; rowCount: number | null }>;
};

async function setDayStatuses(
  db: Queryable,
  provider: BillingProvider,
  days: string[],
  status: string,
  detail: string,
): Promise<void> {
  for (const day of days) {
    // Invalidate every previously successful model row for the day first.
    // Otherwise a provider failure could leave stale money looking current.
    await db.query(
      `UPDATE billing_reconciliations
       SET actual_cost_usd = NULL, status = $3, detail = $4,
         provider_payload = NULL, fetched_at = NULL, updated_at = now()
       WHERE provider = $1 AND utc_day = $2`,
      [provider, day, status, detail],
    );
    // A day is represented either by its existing model rows or by one
    // account sentinel when no model evidence exists. Never retain both:
    // the dashboard intentionally fans an account sentinel out to estimates,
    // so both forms would duplicate a model row after success -> failure.
    await db.query(
      `DELETE FROM billing_reconciliations account_row
       WHERE account_row.provider = $1 AND account_row.utc_day = $2
         AND account_row.model = $3
         AND EXISTS (
           SELECT 1 FROM billing_reconciliations model_row
           WHERE model_row.provider = account_row.provider
             AND model_row.utc_day = account_row.utc_day
             AND model_row.model <> $3
         )`,
      [provider, day, ACCOUNT_MODEL],
    );
    await db.query(
      `INSERT INTO billing_reconciliations
         (provider, utc_day, model, account_scope, status, detail, updated_at)
       SELECT $1, $2, $3, $4, $5, $6, now()
       WHERE NOT EXISTS (
         SELECT 1 FROM billing_reconciliations
         WHERE provider = $1 AND utc_day = $2
       )
       ON CONFLICT (provider, utc_day, model, account_scope)
       DO UPDATE SET actual_cost_usd = NULL, status = EXCLUDED.status,
         detail = EXCLUDED.detail, provider_payload = NULL,
         fetched_at = NULL, updated_at = now()`,
      [
        provider,
        day,
        ACCOUNT_MODEL,
        provider === "anthropic" ? ANTHROPIC_SCOPE : "moonshot-account",
        status,
        detail,
      ],
    );
  }
}

async function reconcileAnthropic(
  db: Queryable,
  days: string[],
  options: {
    retryAuth: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<{ attempted: boolean; status: string; rows: number }> {
  const state = await db.query(
    "SELECT auth_rejected_at FROM billing_provider_state WHERE provider = 'anthropic'",
  );
  if (state.rows[0]?.auth_rejected_at && !options.retryAuth) {
    await db.query("BEGIN");
    try {
      await setDayStatuses(
        db,
        "anthropic",
        days,
        "not_reconciled_key_rejected",
        "Admin key was previously rejected; automatic retry disabled.",
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
    return { attempted: false, status: "auth_rejected_circuit_open", rows: 0 };
  }
  if (options.retryAuth) {
    await db.query(
      `INSERT INTO billing_provider_state (provider, updated_at)
       VALUES ('anthropic', now())
       ON CONFLICT (provider) DO UPDATE SET auth_rejected_at = NULL,
         auth_rejected_detail = NULL, updated_at = now()`,
    );
  }
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) {
    await setDayStatuses(
      db,
      "anthropic",
      days,
      "missing",
      "ANTHROPIC_ADMIN_KEY is not configured.",
    );
    return { attempted: false, status: "missing_key", rows: 0 };
  }

  await db.query(
    `INSERT INTO billing_provider_state (provider, last_attempt_at, updated_at)
     VALUES ('anthropic', now(), now())
     ON CONFLICT (provider) DO UPDATE SET last_attempt_at = now(), updated_at = now()`,
  );
  let report: { rows: AnthropicCost[]; coveredDays: string[] };
  try {
    const range = anthropicRange(days);
    report = await fetchAnthropicCosts({
      ...range,
      apiKey: key,
      fetchImpl: options.fetchImpl,
    });
  } catch (error) {
    if (
      error instanceof ProviderHttpError &&
      (error.status === 401 || error.status === 403)
    ) {
      await db.query("BEGIN");
      try {
        await db.query(
          `INSERT INTO billing_provider_state
             (provider, auth_rejected_at, auth_rejected_detail, last_attempt_at, updated_at)
           VALUES ('anthropic', now(), $1, now(), now())
           ON CONFLICT (provider) DO UPDATE SET auth_rejected_at = now(),
             auth_rejected_detail = EXCLUDED.auth_rejected_detail,
             last_attempt_at = now(), updated_at = now()`,
          [error.message],
        );
        await setDayStatuses(
          db,
          "anthropic",
          days,
          "not_reconciled_key_rejected",
          `Admin key rejected (HTTP ${error.status}); automatic retry disabled.`,
        );
        await db.query("COMMIT");
      } catch (transactionError) {
        await db.query("ROLLBACK");
        throw transactionError;
      }
      return { attempted: true, status: "key_rejected", rows: 0 };
    }
    // Pagination/API failures never publish a partial monetary result.
    await setDayStatuses(
      db,
      "anthropic",
      days,
      "partial",
      error instanceof Error ? error.message : String(error),
    );
    return { attempted: true, status: "partial", rows: 0 };
  }

  let storedRows = 0;
  await db.query("BEGIN");
  try {
    await db.query(
      "DELETE FROM billing_reconciliations WHERE provider = 'anthropic' AND utc_day >= $1 AND utc_day <= $2",
      [days[0], days.at(-1)],
    );
    const grouped = new Map<string, AnthropicCost>();
    for (const cost of report.rows) {
      if (!days.includes(cost.utcDay)) continue;
      const key = `${cost.utcDay}\0${cost.model}`;
      const old = grouped.get(key);
      grouped.set(key, {
        ...cost,
        amountUsd: (old?.amountUsd ?? 0) + cost.amountUsd,
      });
    }
    for (const cost of grouped.values()) {
      await db.query(
        `INSERT INTO billing_reconciliations
           (provider, utc_day, model, account_scope, actual_cost_usd, status,
            detail, provider_payload, fetched_at, updated_at)
          VALUES ('anthropic', $1, $2, $3, $4, 'provisional', $5, $6, now(), now())`,
        [
          cost.utcDay,
          cost.model,
          ANTHROPIC_SCOPE,
          cost.amountUsd,
          "Cost Report has no finality guarantee and excludes Priority Tier costs.",
          cost.payload,
        ],
      );
      storedRows += 1;
    }
    for (const day of days) {
      const dayRows = report.rows.filter((row) => row.utcDay === day);
      if (!report.coveredDays.includes(day)) {
        await setDayStatuses(
          db,
          "anthropic",
          [day],
          "missing",
          "Provider returned no cost row for this completed UTC day.",
        );
      } else if (dayRows.length === 0) {
        await db.query(
          `INSERT INTO billing_reconciliations
             (provider, utc_day, model, account_scope, actual_cost_usd, status,
              detail, fetched_at, updated_at)
           VALUES ('anthropic', $1, $2, $3, 0, 'provisional', $4, now(), now())`,
          [
            day,
            ACCOUNT_MODEL,
            ANTHROPIC_SCOPE,
            "Provider returned an official empty daily bucket (zero cost); no finality guarantee.",
          ],
        );
        storedRows += 1;
      }
    }
    await db.query(
      `INSERT INTO billing_provider_state (provider, last_success_at, updated_at)
       VALUES ('anthropic', now(), now())
       ON CONFLICT (provider) DO UPDATE SET last_success_at = now(),
         auth_rejected_at = NULL, auth_rejected_detail = NULL, updated_at = now()`,
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  return { attempted: true, status: "provisional", rows: storedRows };
}

async function snapshotMoonshot(
  db: Queryable,
  now: Date,
  fetchImpl?: typeof fetch,
): Promise<{ attempted: boolean; status: string; inserted: boolean }> {
  const key = process.env.KIMI_API_KEY;
  const day = utcDay(now);
  if (!key) {
    await setDayStatuses(
      db,
      "moonshot",
      [day],
      "missing",
      "KIMI_API_KEY is not configured.",
    );
    return { attempted: false, status: "missing_key", inserted: false };
  }
  const existing = await db.query(
    "SELECT 1 FROM billing_balance_snapshots WHERE provider = 'moonshot' AND utc_day = $1 LIMIT 1",
    [day],
  );
  if (existing.rowCount)
    return { attempted: false, status: "already_captured", inserted: false };
  try {
    const balance = await fetchMoonshotBalance(key, fetchImpl);
    // Capture completion time, not job start time: a slow HTTP request can
    // cross a UTC boundary and period math must use the real observation.
    const capturedAt = new Date();
    const capturedDay = utcDay(capturedAt);
    const inserted = await db.query(
      `INSERT INTO billing_balance_snapshots
         (provider, account_scope, utc_day, balance_usd, voucher_balance_usd,
          cash_balance_usd, currency, captured_at, provider_payload)
       VALUES ('moonshot', $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (provider, account_scope, utc_day) DO NOTHING
       RETURNING id`,
      [
        balance.accountScope,
        capturedDay,
        balance.balanceUsd,
        balance.voucherBalanceUsd,
        balance.cashBalanceUsd,
        balance.currency,
        capturedAt,
        balance.payload,
      ],
    );
    if (inserted.rowCount) {
      await db.query(
        `DELETE FROM billing_reconciliations
         WHERE provider = 'moonshot' AND utc_day = $1 AND model = $2`,
        [capturedDay, ACCOUNT_MODEL],
      );
    }
    return {
      attempted: true,
      status: "captured",
      inserted: Boolean(inserted.rowCount),
    };
  } catch (error) {
    await setDayStatuses(
      db,
      "moonshot",
      [day],
      "partial",
      error instanceof Error ? error.message : String(error),
    );
    return {
      attempted: true,
      status: error instanceof Error ? error.message : String(error),
      inserted: false,
    };
  }
}

export async function runDailyBilling(
  options: {
    now?: Date;
    retryAnthropicAuth?: boolean;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RunDailyBillingResult> {
  const now = options.now ?? new Date();
  const days = completedUtcDays(now);
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) {
      return {
        locked: false,
        anthropic: { attempted: false, status: "job_already_running", rows: 0 },
        moonshot: {
          attempted: false,
          status: "job_already_running",
          inserted: false,
        },
      };
    }
    const anthropic = await reconcileAnthropic(client, days, {
      retryAuth: options.retryAnthropicAuth === true,
      fetchImpl: options.fetchImpl,
    });
    const moonshot = await snapshotMoonshot(client, now, options.fetchImpl);
    return { locked: true, anthropic, moonshot };
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [LOCK_KEY])
      .catch(() => undefined);
    client.release();
  }
}

export async function recordTopup(input: {
  amountUsd: number;
  effectiveAt: Date;
  note: string;
  accountScope: string;
  staffActor: string;
}): Promise<string> {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0)
    throw new Error("Top-up must be positive.");
  if (!input.note.trim()) throw new Error("Top-up audit note is required.");
  if (!input.staffActor.trim()) throw new Error("Staff actor is required.");
  const result = await pool.query<{ topup_id: string }>(
    `INSERT INTO billing_topup_revisions
       (topup_id, revision, provider, account_scope, amount_usd, effective_at, note, staff_actor)
     VALUES (gen_random_uuid(), 1, 'moonshot', $1, $2, $3, $4, $5)
     RETURNING topup_id`,
    [
      input.accountScope,
      input.amountUsd,
      input.effectiveAt,
      input.note.trim(),
      input.staffActor.trim(),
    ],
  );
  return result.rows[0].topup_id;
}

export async function correctTopup(input: {
  topupId: string;
  amountUsd: number;
  effectiveAt: Date;
  note: string;
  staffActor: string;
}): Promise<void> {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0)
    throw new Error("Corrected top-up cannot be negative.");
  if (!input.note.trim()) throw new Error("Correction audit note is required.");
  if (!input.staffActor.trim()) throw new Error("Staff actor is required.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize corrections for one logical top-up while retaining every
    // prior revision as an immutable audit row.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      input.topupId,
    ]);
    const inserted = await client.query(
      `INSERT INTO billing_topup_revisions
         (topup_id, revision, provider, account_scope, amount_usd, effective_at, note, staff_actor)
       SELECT topup_id, max(revision) + 1, provider, account_scope, $2, $3, $4, $5
       FROM billing_topup_revisions WHERE topup_id = $1
       GROUP BY topup_id, provider, account_scope
       RETURNING id`,
      [
        input.topupId,
        input.amountUsd,
        input.effectiveAt,
        input.note.trim(),
        input.staffActor.trim(),
      ],
    );
    if (!inserted.rowCount) throw new Error("Top-up was not found.");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBillingDashboard(
  filter: BillingDashboardFilter,
): Promise<BillingDashboardRow[]> {
  return getBillingDashboardWithDb(pool, filter);
}

async function getBillingDashboardWithDb(
  db: Queryable,
  filter: BillingDashboardFilter,
): Promise<BillingDashboardRow[]> {
  assertUtcDay(filter.from);
  assertUtcDay(filter.to);
  const result = await db.query(
    `WITH anthropic_estimates AS (
       SELECT (created_at AT TIME ZONE 'UTC')::date AS utc_day,
         model, sum(cost_usd) AS estimated_cost_usd,
         count(*) AS estimated_run_count,
         count(*) FILTER (WHERE cost_usd IS NULL) AS missing_cost_run_count
       FROM measure_runs
       WHERE (created_at AT TIME ZONE 'UTC') >= $1::date
         AND (created_at AT TIME ZONE 'UTC') < ($2::date + interval '1 day')
         AND model LIKE 'claude-%'
       GROUP BY 1, 2
     ), anthropic_actuals AS (
       SELECT utc_day, model, account_scope, actual_cost_usd, status, detail
       FROM billing_reconciliations WHERE provider = 'anthropic'
     ), anthropic_rows AS (
       SELECT coalesce(a.utc_day, e.utc_day) AS utc_day,
         'anthropic'::text AS provider,
         CASE WHEN a.model = '${ACCOUNT_MODEL}'
           THEN coalesce(e.model, a.model) ELSE coalesce(a.model, e.model) END AS model,
         coalesce(a.account_scope, 'unmatched-estimate') AS account_scope,
         e.estimated_cost_usd, a.actual_cost_usd,
         coalesce(e.estimated_run_count, 0) AS estimated_run_count,
         coalesce(e.missing_cost_run_count, 0) AS missing_cost_run_count,
         coalesce(a.status,
           CASE WHEN coalesce(a.utc_day, e.utc_day) >= (now() AT TIME ZONE 'UTC')::date
             THEN 'provisional' ELSE 'missing' END) AS status,
         a.detail, NULL::timestamptz AS period_start_at,
         NULL::timestamptz AS period_end_at
       FROM anthropic_actuals a FULL OUTER JOIN anthropic_estimates e
         ON a.utc_day = e.utc_day
           AND (a.model = e.model OR a.model = '${ACCOUNT_MODEL}')
     ), latest_topups AS (
       SELECT DISTINCT ON (topup_id) topup_id, account_scope, amount_usd, effective_at
       FROM billing_topup_revisions ORDER BY topup_id, revision DESC
     ), moonshot_snapshots AS (
       SELECT b.*,
         lag(cash_balance_usd + voucher_balance_usd) OVER
           (PARTITION BY account_scope ORDER BY captured_at) AS previous_balance_usd,
         lag(captured_at) OVER
           (PARTITION BY account_scope ORDER BY captured_at) AS period_start_at
       FROM billing_balance_snapshots b WHERE provider = 'moonshot'
     ), calendar AS (
       SELECT generate_series($1::date, $2::date, interval '1 day')::date AS utc_day
     ), moonshot_rows AS (
       SELECT c.utc_day, 'moonshot'::text AS provider,
         '${ACCOUNT_MODEL}'::text AS model,
         coalesce(s.account_scope, failure.account_scope, 'moonshot-account') AS account_scope,
         CASE WHEN s.period_start_at IS NOT NULL
                   AND s.captured_at - s.period_start_at <= interval '36 hours'
           THEN estimate.estimated_cost_usd ELSE NULL END AS estimated_cost_usd,
         CASE WHEN s.period_start_at IS NOT NULL
                   AND s.captured_at - s.period_start_at <= interval '36 hours'
           THEN s.previous_balance_usd
             + coalesce((SELECT sum(t.amount_usd) FROM latest_topups t
                 WHERE t.account_scope = s.account_scope
                   AND t.effective_at > s.period_start_at
                   AND t.effective_at <= s.captured_at), 0)
             - (s.cash_balance_usd + s.voucher_balance_usd)
           ELSE NULL END AS actual_cost_usd,
         CASE WHEN s.period_start_at IS NOT NULL
           THEN coalesce(estimate.estimated_run_count, 0) ELSE 0 END AS estimated_run_count,
         CASE WHEN s.period_start_at IS NOT NULL
           THEN coalesce(estimate.missing_cost_run_count, 0) ELSE 0 END AS missing_cost_run_count,
         CASE
           WHEN failure.status IS NOT NULL AND s.id IS NULL THEN failure.status
           WHEN s.id IS NULL AND c.utc_day < coalesce(first_snapshot.utc_day, 'infinity'::date)
             THEN 'no_data'
           WHEN s.id IS NULL THEN 'missing'
           WHEN s.period_start_at IS NULL THEN 'no_data'
           WHEN s.captured_at - s.period_start_at > interval '36 hours' THEN 'missing'
           ELSE 'reconciled'
         END AS status,
         CASE
           WHEN failure.status IS NOT NULL AND s.id IS NULL THEN failure.detail
           WHEN s.id IS NULL AND c.utc_day < coalesce(first_snapshot.utc_day, 'infinity'::date)
             THEN 'No balance snapshot exists before this day.'
           WHEN s.id IS NULL THEN 'No Moonshot balance snapshot was captured this UTC day.'
           WHEN s.period_start_at IS NULL THEN 'No prior balance snapshot; period spend is unavailable.'
           WHEN s.captured_at - s.period_start_at > interval '36 hours'
             THEN 'Snapshot gap exceeds 36 hours; period is not comparable as daily spend.'
           ELSE NULL
         END AS detail,
         s.period_start_at, s.captured_at AS period_end_at
       FROM calendar c
       LEFT JOIN moonshot_snapshots s ON s.utc_day = c.utc_day
       LEFT JOIN billing_reconciliations failure
         ON failure.provider = 'moonshot' AND failure.utc_day = c.utc_day
           AND failure.model = '${ACCOUNT_MODEL}'
       LEFT JOIN LATERAL (
         SELECT min(utc_day) AS utc_day FROM moonshot_snapshots
       ) first_snapshot ON true
       LEFT JOIN LATERAL (
         SELECT sum(m.cost_usd) AS estimated_cost_usd,
           count(*) AS estimated_run_count,
           count(*) FILTER (WHERE m.cost_usd IS NULL) AS missing_cost_run_count
         FROM measure_runs m
         WHERE s.period_start_at IS NOT NULL
           AND m.created_at > s.period_start_at
           AND m.created_at <= s.captured_at
           AND m.model IS NOT NULL AND m.model NOT LIKE 'claude-%'
       ) estimate ON true
     ), combined AS (
       SELECT * FROM anthropic_rows
       UNION ALL
       SELECT * FROM moonshot_rows
     )
     SELECT utc_day::text, provider, model, account_scope,
       estimated_cost_usd, actual_cost_usd, estimated_run_count,
       missing_cost_run_count, status, detail, period_start_at, period_end_at
     FROM combined
     WHERE utc_day BETWEEN $1::date AND $2::date
       AND ($3::text IS NULL OR provider = $3)
       AND ($4::text IS NULL OR model = $4)
     ORDER BY 1 DESC, 2, 3`,
    [filter.from, filter.to, filter.provider ?? null, filter.model ?? null],
  );
  return (
    result.rows as Array<{
      utc_day: string;
      provider: BillingProvider;
      model: string;
      account_scope: string;
      estimated_cost_usd: number | string | null;
      actual_cost_usd: number | string | null;
      estimated_run_count: number | string;
      missing_cost_run_count: number | string;
      status: BillingDashboardRow["status"];
      detail: string | null;
      period_start_at: Date | string | null;
      period_end_at: Date | string | null;
    }>
  ).map((row) => {
    const estimated =
      row.estimated_cost_usd === null ? null : Number(row.estimated_cost_usd);
    const actual =
      row.actual_cost_usd === null ? null : Number(row.actual_cost_usd);
    const difference = calculateDifferencePercent(estimated, actual);
    const missingCostRunCount = Number(row.missing_cost_run_count);
    return {
      utcDay: row.utc_day,
      provider: row.provider,
      model: row.model === ACCOUNT_MODEL ? null : row.model,
      accountScope: row.account_scope,
      estimatedCostUsd: estimated,
      actualCostUsd: actual,
      estimatedRunCount: Number(row.estimated_run_count),
      missingCostRunCount,
      estimateIncomplete: missingCostRunCount > 0,
      differencePercent: difference,
      flagged: isBillingDifferenceFlagged(
        estimated,
        actual,
        difference,
        missingCostRunCount,
      ),
      periodStartAt:
        row.period_start_at === null
          ? null
          : new Date(row.period_start_at).toISOString(),
      periodEndAt:
        row.period_end_at === null
          ? null
          : new Date(row.period_end_at).toISOString(),
      status: row.status,
      detail: row.detail,
    };
  });
}

export function calculateDifferencePercent(
  estimated: number | null,
  actual: number | null,
): number | null {
  if (estimated === null || actual === null) return null;
  if (actual === 0) return estimated === 0 ? 0 : null;
  return ((estimated - actual) / actual) * 100;
}

export function calculateSnapshotSpend(
  previousBalanceUsd: number,
  currentBalanceUsd: number,
  topupsUsd: number,
): number {
  return previousBalanceUsd + topupsUsd - currentBalanceUsd;
}

export function isBillingDifferenceFlagged(
  estimated: number | null,
  actual: number | null,
  differencePercent: number | null,
  missingCostRunCount: number,
): boolean {
  return (
    (estimated !== null && estimated !== 0 && actual === 0) ||
    (differencePercent !== null && Math.abs(differencePercent) > 10) ||
    missingCostRunCount > 0
  );
}

export const billingTestInternals = {
  reconcileAnthropic,
  snapshotMoonshot,
  setDayStatuses,
  getBillingDashboardWithDb,
};
