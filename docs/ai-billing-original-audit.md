# AI billing original-value audit — 20–22 September 2026 UTC

Audit performed on 23 September 2026 for task 93. This was a read-only
database audit. No database rows were inserted, updated, deleted, exported, or
copied, and no Anthropic endpoint was called.

## Environment determination

`getDeploymentInfo()` returned successfully with:

- `isDeployed: false`
- `hasSuccessfulBuild: false`
- no production URL and no deployment type

The database skill then confirmed that this Repl has no production database:
the production read-only query failed with `PRODUCTION_DATABASE_ERROR` and the
message that the app must be deployed before a production database exists.
Therefore there is no active production environment to audit. The active data
environment is development, which was queried separately. The figures below
are development figures and must not be represented as production totals.

## Query and method

The database skill's `executeSql` callback was used, first with
`environment: "production"` and then with `environment: "development"`.
Both calls were parameterized `SELECT` statements. UTC half-open boundaries
were:

```text
[2026-09-20T00:00:00Z, 2026-09-23T00:00:00Z)
```

The audit joined `measure_runs.project_id` to `projects.id`, grouped
`created_at AT TIME ZONE 'UTC'` by date, and filtered model-specific aggregates
with `model = 'claude-fable-5'`. It calculated:

```sql
count(*) FILTER (WHERE model = 'claude-fable-5')
sum(input_tokens) FILTER (WHERE model = 'claude-fable-5')
sum(output_tokens) FILTER (WHERE model = 'claude-fable-5')
sum(coalesce(input_tokens, 0) + coalesce(output_tokens, 0))
  FILTER (WHERE model = 'claude-fable-5')
sum(cost_usd) FILTER (WHERE model = 'claude-fable-5')
count(*) FILTER (WHERE model = 'claude-fable-5' AND cost_usd IS NULL)
count(*) FILTER (WHERE model = 'claude-fable-5' AND cost_usd = 0)
```

`sum(cost_usd)` is the **original stored `cost_usd`**, not a value recomputed
from tokens. A generated three-day date series preserves zero-run days. For
such a day PostgreSQL's raw sum is `NULL`; the report displays `$0` because
there are no rows, while keeping missing-cost-row count distinct from that
display convention.

Outcomes were checked both in the daily query and in a separate grouped
`SELECT outcome, count(*)`. Test classification used the repository's explicit
project naming conventions:

- `scripts/regression.ts` creates `regression <case>` and states that regression
  runs are identifiable by that project name.
- `scripts/test-extraktion.ts` and the development-only extraction route create
  `extraktion-test <route>/<quality>`.
- The ordinary project creation action generates names such as
  `New project – Sep 22` when the user supplies no name.

Accordingly, names beginning `regression ` were classified as regression,
names beginning `extraktion-test ` as extraction tests, and no broader
substring heuristic was used.

## Development results

| UTC day | All runs | `claude-fable-5` runs | Input tokens | Output tokens | Total tokens | Original `cost_usd` sum | Missing cost | Exactly-zero cost | Regression | Extraction test | Outcomes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-09-20 | 0 | 0 | 0 | 0 | 0 | $0 | 0 | 0 | 0 | 0 | none |
| 2026-09-21 | 1 | 1 | 36,450 | 39,601 | 76,051 | $0.703365 | 0 | 0 | 0 | 0 | `model_ready` (1) |
| 2026-09-22 | 3 | 3 | 141,669 | 174,700 | 316,369 | $3.045507 | 0 | 0 | 0 | 0 | `model_ready` (3) |
| **Total** | **4** | **4** | **178,119** | **214,301** | **392,420** | **$3.748872** | **0** | **0** | **0** | **0** | **`model_ready` (4)** |

All runs in the interval were `claude-fable-5`; there were no other-model
runs and no other outcomes. The daily project names were `New project – Sep
21` and `New project – Sep 22`, matching the ordinary auto-name format rather
than either script's explicit test naming format. Thus the evidence supports
zero script-identifiable regression/test runs. It does not prove what a human
intended when creating an ordinarily named project.

## 22 September comparison with $10.15

- Console amount supplied for comparison: **$10.15**
- Original stored development `cost_usd` total: **$3.045507**
- Logged minus Console: **-$7.104493**
- Console amount unexplained by these development rows: **$7.104493**
- Logged total is **30.005%** of $10.15; the shortfall is **69.995%**

This is not a production reconciliation: no production deployment/database
exists for this Repl. The discrepancy can therefore reflect a different
environment/database, Anthropic organization-wide usage not represented by
`measure_runs`, calls outside the measurement pipeline, or differences in the
Console figure's scope. The read-only evidence cannot choose among those
causes. No provider call was made, so the supplied $10.15 was not independently
verified.

## Limitations

1. There was no production database, so production totals could not be
   obtained and development is not a substitute for production.
2. Classification is intentionally limited to repository-backed project naming
   evidence. Renamed test projects or manually created tests with ordinary
   names would not be detected.
3. The audit used current stored rows and original current `cost_usd` values.
   It cannot determine whether those values were changed before the audit.
4. The audit did not contact Anthropic, inspect organization cost APIs, or
   validate the Console amount.
5. Token totals treat a missing input or output token component as zero for the
   combined-token expression. In the four matching rows, both token components
   were present.