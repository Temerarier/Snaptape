import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "artifacts/aufmass-app/scripts/sql/20260923_recalculate_exact_model_costs.sql",
  ),
  "utf8",
);

describe("historical cost recalculation migration", () => {
  it("is transactionally locked and idempotent", () => {
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("LOCK TABLE measure_runs");
    expect(sql).toContain("20260923_exact_model_cost_recalculation_v1");
    expect(sql).toContain("IF NOT EXISTS");
    expect(sql).toContain("COMMIT;");
  });

  it("audits every exact-model outcome and preserves UTC instants", () => {
    expect(sql).toContain("outcome::text");
    expect(sql).toContain("run_created_at timestamptz");
    expect(sql).toContain("first_run_at timestamptz");
    expect(sql).toContain("last_run_at timestamptz");
    expect(sql).toContain("WHERE model IN ('claude-fable-5', 'kimi-k3')");
  });

  it("reports and skips runs with either token count missing", () => {
    expect(sql).toContain("skipped_null_token_count");
    expect(sql).toContain("input_tokens IS NULL OR output_tokens IS NULL");
    expect(sql).toContain("audit.status = 'recalculated'");
  });

  it("makes both batch and per-run audit records immutable", () => {
    expect(sql).toContain("AI cost recalculation audit rows are immutable");
    expect(sql).toContain("migrations_immutable");
    expect(sql).toContain("run_recalculations_immutable");
  });
});