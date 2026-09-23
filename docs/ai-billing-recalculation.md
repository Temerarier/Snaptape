# Historical AI cost recalculation

## Scope and verified rates

This report covers the existing **development** database only. Production was
not mutated. No measurement, regression, or provider request was started.

The recalculation used the exact-model base rates established in
`docs/ai-billing-pricing-evidence.md`, in USD per 1,000,000 tokens:

| Exact model | Input | Output |
|---|---:|---:|
| `claude-fable-5` | $10.00 | $50.00 |
| `kimi-k3` | $3.00 | $15.00 |

Only the constants consumed by `schaetzeKostenUsd` were changed. Its formula
and extraction behavior were not changed.

## Migration design

The reviewed migration is
`artifacts/aufmass-app/scripts/sql/20260923_recalculate_exact_model_costs.sql`.
Its migration ID is
`20260923_exact_model_cost_recalculation_v1`.

The migration:

- runs in one transaction with a transaction-scoped advisory lock and a
  `SHARE ROW EXCLUSIVE` lock on `measure_runs`;
- selects only the two exact model IDs and uses each run's own input and output
  token counts, irrespective of outcome;
- records every selected run in
  `ai_cost_audit.run_recalculations`, including model, outcome, UTC instant,
  tokens, old cost, new cost, and status;
- reports a run with either token count `NULL` as `skipped_null_tokens` and
  does not update it;
- records immutable batch totals and the UTC range in
  `ai_cost_audit.migrations`;
- blocks updates and deletes on both audit tables with triggers; and
- checks the migration ID under the lock, making later executions data no-ops.

The audit schema is separate from the application billing-service schema.

## Development execution

The migration completed on **2026-09-23 09:51:44.914980 UTC**.

| Scanned exact-model runs | Recalculated | Skipped for null tokens | First run UTC | Last run UTC | Old total | New total |
|---:|---:|---:|---|---|---:|---:|
| 34 | 34 | 0 | 2026-07-29 10:34:47.888953 | 2026-09-23 07:50:00.414330 | $19.5471898 | $69.218894 |

Every stored outcome was included:

| Model | Outcome | Runs | Old total | New total |
|---|---|---:|---:|---:|
| `claude-fable-5` | `failed` | 5 | $3.646713 | $12.155710 |
| `claude-fable-5` | `model_ready` | 20 | $14.338479 | $47.794930 |
| `kimi-k3` | `failed` | 1 | $0.2279765 | $1.350210 |
| `kimi-k3` | `model_ready` | 8 | $1.3340213 | $7.918044 |

Post-commit verification found 34 per-run audit records, 34 recalculated
records, no skipped records, and no differences between current stored costs
and audited new costs.

The same migration was executed a second time to verify idempotence. It
returned the original application timestamp and unchanged counts and totals;
it did not create or alter per-run audit records.

## September 22 comparison

The three September 22 UTC `claude-fable-5` runs retain their original token
counts of 141,669 input and 174,700 output. At the verified base rates their
recalculated total is:

```text
(141,669 × $10 + 174,700 × $50) / 1,000,000 = $10.151690
```

Compared with the supplied Anthropic Console amount of **$10.15**, the
remaining unrounded difference is **+$0.001690** (stored estimate minus
Console), approximately **+0.01665%**. Both amounts display as $10.15 when
rounded to cents. This does not establish invoice equality: the stored value
is a token-based base-rate estimate, while the supplied Console value may
have different rounding, billing dimensions, scope, discounts, credits, or
tax treatment. No provider call was made to independently verify the Console
amount.

## Checks

Targeted tests cover the four corrected constants, fractional token
arithmetic, transactional locking, the migration marker/idempotence guard,
UTC timestamp columns, exact-model selection, null-token skipping, and audit
immutability. Six targeted tests passed.