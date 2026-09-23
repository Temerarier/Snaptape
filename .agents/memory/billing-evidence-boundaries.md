---
name: Billing evidence boundaries
description: Authorization and attribution constraints for provider billing work
---

After an Anthropic Admin API 401/403, stop authenticated Anthropic billing access until the credential is corrected and staff explicitly authorizes a retry. Never try the measurement pipeline key or another endpoint as a workaround.

**Why:** The user explicitly required a single initial test and a hard stop on rejection; automated retries must not circumvent that boundary.

**How to apply:** Preserve the durable rejection state across job restarts, and distinguish implementing a backfill from successfully executing it.

Moonshot balance-derived spend belongs to the actual snapshot interval and account, not automatically to a UTC day or model. Original measurement costs are estimates, not provider invoices.

**Why:** Polling times, gaps, manual credits, and other account activity prevent reliable model attribution. A cent-rounded match does not prove complete billing equivalence.

**How to apply:** Show timestamps, scope, incomplete data, and top-up assumptions. Never allocate account actuals to individual models as though the provider reported them.

Correct prices only with official evidence for the exact identifier, after reporting original stored totals; preserve a transactional old/new audit.

**Why:** Previously unchecked constants understated both models, but matching a billed total alone is not evidence of a rate.

**How to apply:** Refresh official evidence for future rate changes rather than treating the historical verification as permanent pricing authority.