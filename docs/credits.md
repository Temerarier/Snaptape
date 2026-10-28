# Measurement credits

Each measurement costs one credit. Staff accounts follow the same rule.
The only source of balance is `SUM(credit_ledger.delta)`; there is no cached balance column.

## Starting a measurement

The server checks the balance before the paid classification gate. After the
gate succeeds, one PostgreSQL transaction locks the user's row, checks the
balance again, inserts a measurement debit and claims the project's current run.
If the balance or project guard fails, the whole transaction rolls back.
Parallel starts with one credit cannot both succeed.

New projects/runs retain the historical `premium` enum value, without a
customer-facing tier selector. This is not an exemption from credits.

## Refunds

Only the still-current run can finalize its project. Its guarded project update,
run record and failed-run refund are committed in the same transaction.
Successful runs never refund. Superseded runs do not refund; their debit is owned
by the current-run guard and may already have been refunded by timeout cleanup.

`current_credit_ledger_id` connects the in-flight project to its actual debit.
`refund_of` on the refund row references the charge UUID and has a unique index:
one debit can produce at most one refund. These two internal identifiers make
the refund durable across restarts without changing the human-readable note:
`measurement failed` or `timeout`.

No charge means no refund. Old projects predating the credit system therefore
cannot create free credits merely because they failed or have missing data.
Deleting a project preserves ledger entries with a null project link.

## Cleanup

Customer project lists/detail pages sweep only that user's projects. Staff
measurement/user pages sweep all users. Processing runs whose timestamp is
older than 60 minutes are failed with `Measurement timed out after 60 minutes`.
A terminal failure row and an actual-charge refund are written atomically.
A second sweep does nothing. Late pipeline results cannot change the failed
project or refund again.

Historical `model_ready` projects with null measurements become failed, without
inventing a debit/refund. Legacy processing rows with no `processing_since`
are not assigned a guessed start time.

## Staff adjustments

`/admin/users` requires a verified-email account listed in `STAFF_EMAILS`.
Every booking requires an integer from -100 through 100, excluding zero, and a
nonempty note of at most 500 characters. Positive entries are `staff_grant`;
negative entries are `adjustment`. The acting staff UUID is recorded.

Authentication and credit balances are always enforced on the server.
The UI does not expose provider model IDs, API prices or other users' ledgers.
