import { pool } from "@workspace/db";

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO billing_provider_state
         (provider, auth_rejected_at, auth_rejected_detail, last_attempt_at, updated_at)
       VALUES ('anthropic', now(), $1, now(), now())
       ON CONFLICT (provider) DO UPDATE SET auth_rejected_at = now(),
         auth_rejected_detail = EXCLUDED.auth_rejected_detail,
         last_attempt_at = now(), updated_at = now()`,
      ["Initial admin probe returned HTTP 403; automatic retry disabled."],
    );
    await client.query(
      `INSERT INTO billing_reconciliations
         (provider, utc_day, model, account_scope, status, detail, updated_at)
       SELECT 'anthropic', day::date, '__account__', 'anthropic-organization',
         'not_reconciled_key_rejected',
         'Admin key rejected (HTTP 403); automatic retry disabled.', now()
       FROM generate_series(
         (now() AT TIME ZONE 'UTC')::date - 7,
         (now() AT TIME ZONE 'UTC')::date - 1,
         interval '1 day'
       ) AS day
       ON CONFLICT (provider, utc_day, model, account_scope)
       DO UPDATE SET actual_cost_usd = NULL,
         status = EXCLUDED.status, detail = EXCLUDED.detail,
         provider_payload = NULL, fetched_at = NULL, updated_at = now()`,
    );
    await client.query("COMMIT");
    console.log(
      "Stored Anthropic HTTP 403 circuit state for seven completed UTC days.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
