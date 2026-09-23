# Anthropic Cost Report activation check — 2026-09-23 UTC

The configured `ANTHROPIC_ADMIN_KEY` was present and its prefix matched
`sk-ant-admin01-`. The credential itself was neither printed nor retained.
One initial GET to `/v1/organizations/cost_report` for
`[2026-09-20T00:00:00Z, 2026-09-24T00:00:00Z)` using
`anthropic-version: 2023-06-01` returned **HTTP 200**.

The explicit retry of the existing seven-completed-UTC-day reconciliation
completed in the **development** database with status `provisional` and nine
stored day/model or empty-day rows. It cleared the previous rejection circuit.
The independent Moonshot poll was already captured that day and did not insert
another snapshot. `getDeploymentInfo()` reported no deployment, so none of
these records are production records.

The dashboard returned the following after the backfill. Estimates come only
from surviving measurement runs; provider actuals have organization scope.
Percentage = `(estimate - actual) / actual × 100`. No percentage is computed
when an estimate is missing or actual is zero.

| UTC day | Reported model | Run estimate USD | Cost Report USD | Difference | Status |
| --- | --- | ---: | ---: | ---: | --- |
| 2026-09-16 | No model charge (official empty bucket) | no runs | 0 | n/a | provisional |
| 2026-09-17 | No model charge (official empty bucket) | no runs | 0 | n/a | provisional |
| 2026-09-18 | No model charge (official empty bucket) | no runs | 0 | n/a | provisional |
| 2026-09-19 | No model charge (official empty bucket) | no runs | 0 | n/a | provisional |
| 2026-09-20 | No model charge (official empty bucket) | no runs | 0 | n/a | provisional |
| 2026-09-21 | claude-fable-5 | 2.344550 | 5.072680 | -53.7808% (flagged) | provisional |
| 2026-09-21 | claude-sonnet-4-5-20250929 | missing (0 matching runs) | 0.106254 | n/a | provisional |
| 2026-09-22 | claude-fable-5 | 10.151690 | 10.151690 | approximately 0% | provisional |
| 2026-09-22 | claude-sonnet-4-5-20250929 | missing (0 matching runs) | 0.358653 | n/a | provisional |

The September 22 Fable total rounds to the independently supplied Console
figure of $10.15. September 21 is materially different: the organization
reported $2.728130 more Fable spend than the one surviving measurement run's
estimate. This **does not demonstrate a wrong price**: the estimate uses the
corrected base token prices and a single run's counts, while the Cost Report
has organization scope. Unlogged retries or incomplete calls, usage from
other workflows, or deleted project-linked run logs are possible causes; none
is proven by the available rows. Sonnet is separately billed, including
classification calls, and is not allocated to Fable. Anthropic does not
provide a documented finality watermark, and the Cost Report excludes
Priority Tier.

## Production scheduling boundary

At the time of this check, `getDeploymentInfo()` returned `isDeployed: false`
and no production URL. Consequently, the web app and an independent scheduled
deployment could **not be verified as published or active**. The existing
one-shot command is `pnpm --filter @workspace/aufmass-app billing:daily`.
Publishing requires the project owner to configure a **separate Scheduled
Deployment** (not convert the web app), UTC cron `15 2 * * *`, a five-minute
timeout, and the production database/provider secrets, then publish and
enable it through the Publishing tool. Its first run is the next 02:15 UTC
after activation (2026-09-24 02:15 UTC if activated before that time).
Verify the Scheduled Deployment is enabled and check its run history/logs
after the first run, then check `/admin/billing` against production data.
Do not infer production activity from this development backfill.