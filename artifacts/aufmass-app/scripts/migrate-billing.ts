import { pool } from "@workspace/db";

// Additive, idempotent migration. It intentionally does not use drizzle push:
// billing history must never require dropping measurement data.
const statements = [
  `CREATE TABLE IF NOT EXISTS billing_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    utc_day date NOT NULL,
    model text NOT NULL,
    account_scope text NOT NULL,
    actual_cost_usd double precision,
    status text NOT NULL,
    detail text,
    provider_payload jsonb,
    fetched_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_reconciliation_provider_day_model_scope_unique
      UNIQUE (provider, utc_day, model, account_scope)
  )`,
  `CREATE TABLE IF NOT EXISTS billing_balance_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    account_scope text NOT NULL,
    utc_day date NOT NULL,
    balance_usd double precision NOT NULL,
    voucher_balance_usd double precision,
    cash_balance_usd double precision,
    currency text NOT NULL,
    captured_at timestamptz NOT NULL,
    provider_payload jsonb NOT NULL,
    CONSTRAINT billing_balance_provider_scope_day_unique
      UNIQUE (provider, account_scope, utc_day)
  )`,
  `ALTER TABLE billing_balance_snapshots
    ADD COLUMN IF NOT EXISTS voucher_balance_usd double precision`,
  `ALTER TABLE billing_balance_snapshots
    ADD COLUMN IF NOT EXISTS cash_balance_usd double precision`,
  `UPDATE billing_balance_snapshots
    SET voucher_balance_usd =
      (provider_payload->'data'->>'voucher_balance')::double precision,
      cash_balance_usd =
      (provider_payload->'data'->>'cash_balance')::double precision
    WHERE voucher_balance_usd IS NULL OR cash_balance_usd IS NULL`,
  `ALTER TABLE billing_balance_snapshots
    ALTER COLUMN voucher_balance_usd SET NOT NULL`,
  `ALTER TABLE billing_balance_snapshots
    ALTER COLUMN cash_balance_usd SET NOT NULL`,
  `CREATE TABLE IF NOT EXISTS billing_topup_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topup_id uuid NOT NULL,
    revision integer NOT NULL,
    provider text NOT NULL,
    account_scope text NOT NULL,
    amount_usd double precision NOT NULL,
    effective_at timestamptz NOT NULL,
    note text NOT NULL,
    staff_actor text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_topup_id_revision_unique UNIQUE (topup_id, revision)
  )`,
  `ALTER TABLE billing_topup_revisions
    ADD COLUMN IF NOT EXISTS staff_actor text`,
  `UPDATE billing_topup_revisions SET staff_actor = 'legacy-unknown'
    WHERE staff_actor IS NULL`,
  `ALTER TABLE billing_topup_revisions
    ALTER COLUMN staff_actor SET NOT NULL`,
  `CREATE TABLE IF NOT EXISTS billing_provider_state (
    provider text PRIMARY KEY,
    auth_rejected_at timestamptz,
    auth_rejected_detail text,
    last_attempt_at timestamptz,
    last_success_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS billing_reconciliations_day_idx
    ON billing_reconciliations (utc_day, provider)`,
  `CREATE INDEX IF NOT EXISTS billing_snapshots_captured_idx
    ON billing_balance_snapshots (provider, account_scope, captured_at)`,
];

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
    console.log("Billing schema is up to date.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
