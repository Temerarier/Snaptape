# Billing reconciliation contract

Backend exports are in `artifacts/aufmass-app/lib/billing/service.ts`.

- `getBillingDashboard({ from, to, provider?, model? })` accepts inclusive UTC
  dates (`YYYY-MM-DD`). It returns daily rows with provider, nullable model
  (Moonshot is account-level), account scope, estimated/actual USD,
  signed percentage difference, `flagged` when absolute difference exceeds
  10%, status, and explanatory detail. Difference is
  `(estimated - actual) / actual × 100`; when actual is zero and estimate is
  nonzero, percentage is `null` but the row is flagged (never Infinity).
  `estimatedRunCount`, `missingCostRunCount`, and `estimateIncomplete` prevent
  null run costs from silently disappearing.
- `runDailyBilling({ retryAnthropicAuth? })` is the scheduled entry point.
  `retryAnthropicAuth` must only be set by an explicit staff retry after the
  organization credential is corrected. Normal runs honor the durable 401/403
  circuit and make no Anthropic request.
- `recordTopup(...)` records a positive Moonshot account top-up and requires
  `staffActor` (the authenticated staff email or stable user ID).
- `correctTopup(...)` appends a correction revision with `staffActor`; prior
  revisions remain immutable for audit. A correction may set amount to zero to
  void a mistaken top-up, but may not be negative.

Statuses are explicit: `reconciled`, `not_reconciled_key_rejected`, `missing`,
`partial`, `provisional`, and `no_data`. Anthropic Cost Report rows remain
`provisional`: the provider publishes no finality watermark and excludes
Priority Tier. A failed or incomplete pagination never publishes monetary
rows. Moonshot spend remains account-level and is only available between
consecutive balance snapshots; it is not fabricated per model. All three
documented Moonshot balances (available, voucher, and cash) are retained.
Economic spend uses `cash + voucher`, not `available_balance` (which Moonshot
can clamp when cash is negative). Dashboard Moonshot rows expose
`periodStartAt`/`periodEndAt`; gaps over 36 hours are marked missing and do not
show a misleading daily actual or estimate. Calendar days before the first
snapshot explicitly show `no_data`. Provider/missing-key failures are persisted
as visible status rows.

These functions are backend primitives, not unauthenticated server actions.
Any admin action wrapper must call the existing staff gate before invoking
them.

## Scheduling

Run the additive migration once:

```sh
pnpm --filter @workspace/aufmass-app billing:migrate
```

The daily one-shot command is:

```sh
pnpm --filter @workspace/aufmass-app billing:daily
```

Configure that command as a separate Scheduled Deployment in Replit (not as an
in-process timer and not as a replacement for the web deployment). In
**Publishing**, create a **separate Scheduled artifact/deployment**, use the
command above, choose the UTC cron schedule `15 2 * * *` (daily at 02:15 UTC),
set a 5-minute timeout, authorize the same database and provider secrets,
publish it, and confirm the schedule is enabled. Never replace or convert the
existing web deployment. Activation is a publishing/infrastructure boundary:
repository code only provides the idempotent command; a staff member must
create, publish, and enable that separate schedule. Replit Scheduled
Deployments documentation:
https://docs.replit.com/cloud-services/deployments/scheduled-deployments

The job uses a PostgreSQL advisory lock, stores at most one Moonshot account
snapshot per UTC day, and safely reprocesses seven completed UTC days. Provider
failures do not affect measurement runs or the web process. The command exits
nonzero for missing credentials, provider failures, partial pagination, and an
open Anthropic authentication circuit so Scheduled Deployment retries and
alerts remain visible. Anthropic HTTP 429 and 5xx responses receive two bounded
retries (1 second, then 3 seconds); after that the window is persisted as
partial and the next scheduled run retries the trailing window. Authentication
rejections are never retried automatically.
