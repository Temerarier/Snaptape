---
name: Trial credit policy
description: Eligibility and daily-window decisions for new-account free credits.
---

Trial credits are exclusively for brand-new local accounts; existing accounts and
accounts denied by the daily cap must never receive a later catch-up grant.

**Why:** The user explicitly excluded existing users and retroactive grants, including
repeat or simultaneous logins. Trial credits must not change staff grants or refunds.

**How to apply:** Preserve new-account-only eligibility when changing authentication
or account linking. The daily window is UTC midnight to midnight for both allocation
and the staff counter; disclose that convention if changing its behavior.

Do not add a trial-grant partial index that references the newly added enum value.

**Why:** Publish applies the enum addition and dependent index in one transaction;
PostgreSQL rejects that index as unsafe use of a new enum value. The user chose
new-user-only transactional booking and identity locking instead.

**How to apply:** Preserve the concurrent-login regression test. Keep schema changes
compatible with a single publish transaction rather than adding production DDL hooks.
