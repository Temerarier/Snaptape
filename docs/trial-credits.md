# New-account trial credits

Only insertion of a new local user grants a single ledger credit (`trial_grant`,
note `free trial`). Returning accounts and existing email rows attached to Clerk
never receive it. An account created while the cap is exhausted is not retried.

`TRIAL_DAILY_LIMIT` is a server-only environment setting, default `20`. Set it to
a non-negative integer in the desired Replit environment; `0` disables grants.
Invalid values fail explicitly rather than silently disabling the cap.
Days are UTC calendar days. The admin counter uses the same bounds and configured
limit. Nothing about this global cap is exposed to customers.

The existing per-identity transaction lock prevents simultaneous first logins
from creating two accounts. A separate global transaction lock serializes the
daily count and trial booking across processes. Only the transaction that creates
the user books the trial credit. The user and credit commit together.

## Publishing

The Drizzle schema adds the `trial_grant` enum value without an index that uses it.
Apply it to development with `pnpm --filter @workspace/db run push`.
Replit's normal Publish flow compares the managed development and production
schemas and applies this additive schema change to production when publishing.
Review the schema changes in Publish; do not select an overwrite-data option.
There is no backfill, production SQL script, build hook, or startup migration.
Existing users receive no credits as part of publishing.

## Verification

- `pnpm test`
- `RUN_TRIAL_DB_TESTS=1 pnpm exec vitest run artifacts/aufmass-app/lib/credits/trial.integration.test.ts`
- `pnpm run typecheck`

The opt-in database test uses only unique disposable users in development and
removes its own users/projects/ledger afterward. It verifies concurrent first
logins, existing/attached exclusions, concurrent cap enforcement, no delayed grant,
and normal measurement debits without invoking an AI model. It is not a substitute
for the authenticated browser upload-to-measurement acceptance flow.
