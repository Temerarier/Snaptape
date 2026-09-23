BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- A transaction-scoped lock serializes this exact migration even before its
-- audit tables exist. The table lock prevents a measurement insert/update from
-- appearing between the audit snapshot and cost update.
SELECT pg_advisory_xact_lock(
  hashtextextended('20260923_exact_model_cost_recalculation_v1', 0)
);

CREATE SCHEMA IF NOT EXISTS ai_cost_audit;

CREATE TABLE IF NOT EXISTS ai_cost_audit.migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  scanned_count integer NOT NULL,
  affected_count integer NOT NULL,
  skipped_null_token_count integer NOT NULL,
  first_run_at timestamptz,
  last_run_at timestamptz,
  old_total_usd double precision,
  new_total_usd double precision
);

CREATE TABLE IF NOT EXISTS ai_cost_audit.run_recalculations (
  migration_id text NOT NULL,
  measure_run_id uuid NOT NULL,
  model text NOT NULL,
  outcome text,
  run_created_at timestamptz NOT NULL,
  input_tokens integer,
  output_tokens integer,
  old_cost_usd double precision,
  new_cost_usd double precision,
  status text NOT NULL CHECK (status IN ('recalculated', 'skipped_null_tokens')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (migration_id, measure_run_id),
  FOREIGN KEY (migration_id)
    REFERENCES ai_cost_audit.migrations(migration_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE OR REPLACE FUNCTION ai_cost_audit.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AI cost recalculation audit rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS migrations_immutable
  ON ai_cost_audit.migrations;
CREATE TRIGGER migrations_immutable
BEFORE UPDATE OR DELETE ON ai_cost_audit.migrations
FOR EACH ROW EXECUTE FUNCTION ai_cost_audit.reject_audit_mutation();

DROP TRIGGER IF EXISTS run_recalculations_immutable
  ON ai_cost_audit.run_recalculations;
CREATE TRIGGER run_recalculations_immutable
BEFORE UPDATE OR DELETE ON ai_cost_audit.run_recalculations
FOR EACH ROW EXECUTE FUNCTION ai_cost_audit.reject_audit_mutation();

DO $migration$
DECLARE
  migration_key constant text :=
    '20260923_exact_model_cost_recalculation_v1';
BEGIN
  -- The marker check is inside the same advisory-locked transaction. A rerun
  -- is a no-op: it neither rewrites costs nor alters the original audit rows.
  IF NOT EXISTS (
    SELECT 1
    FROM ai_cost_audit.migrations
    WHERE migration_id = migration_key
  ) THEN
    LOCK TABLE measure_runs IN SHARE ROW EXCLUSIVE MODE;

    INSERT INTO ai_cost_audit.migrations (
      migration_id,
      scanned_count,
      affected_count,
      skipped_null_token_count,
      first_run_at,
      last_run_at,
      old_total_usd,
      new_total_usd
    )
    SELECT
      migration_key,
      count(*)::integer,
      count(*) FILTER (
        WHERE input_tokens IS NOT NULL AND output_tokens IS NOT NULL
      )::integer,
      count(*) FILTER (
        WHERE input_tokens IS NULL OR output_tokens IS NULL
      )::integer,
      min(created_at),
      max(created_at),
      sum(cost_usd) FILTER (
        WHERE input_tokens IS NOT NULL AND output_tokens IS NOT NULL
      ),
      sum(
        (
          input_tokens *
            CASE model
              WHEN 'claude-fable-5' THEN 10.0
              WHEN 'kimi-k3' THEN 3.0
            END
          + output_tokens *
            CASE model
              WHEN 'claude-fable-5' THEN 50.0
              WHEN 'kimi-k3' THEN 15.0
            END
        ) / 1000000.0
      ) FILTER (
        WHERE input_tokens IS NOT NULL AND output_tokens IS NOT NULL
      )
    FROM measure_runs
    WHERE model IN ('claude-fable-5', 'kimi-k3');

    INSERT INTO ai_cost_audit.run_recalculations (
      migration_id,
      measure_run_id,
      model,
      outcome,
      run_created_at,
      input_tokens,
      output_tokens,
      old_cost_usd,
      new_cost_usd,
      status
    )
    SELECT
      migration_key,
      id,
      model,
      outcome::text,
      created_at,
      input_tokens,
      output_tokens,
      cost_usd,
      CASE
        WHEN input_tokens IS NULL OR output_tokens IS NULL THEN NULL
        ELSE (
          input_tokens *
            CASE model
              WHEN 'claude-fable-5' THEN 10.0
              WHEN 'kimi-k3' THEN 3.0
            END
          + output_tokens *
            CASE model
              WHEN 'claude-fable-5' THEN 50.0
              WHEN 'kimi-k3' THEN 15.0
            END
        ) / 1000000.0
      END,
      CASE
        WHEN input_tokens IS NULL OR output_tokens IS NULL
          THEN 'skipped_null_tokens'
        ELSE 'recalculated'
      END
    FROM measure_runs
    WHERE model IN ('claude-fable-5', 'kimi-k3');

    UPDATE measure_runs AS run
    SET cost_usd = audit.new_cost_usd
    FROM ai_cost_audit.run_recalculations AS audit
    WHERE audit.migration_id = migration_key
      AND audit.measure_run_id = run.id
      AND audit.status = 'recalculated';
  END IF;
END;
$migration$;

COMMIT;

SELECT
  migration_id,
  applied_at,
  scanned_count,
  affected_count,
  skipped_null_token_count,
  first_run_at,
  last_run_at,
  old_total_usd,
  new_total_usd
FROM ai_cost_audit.migrations
WHERE migration_id = '20260923_exact_model_cost_recalculation_v1';