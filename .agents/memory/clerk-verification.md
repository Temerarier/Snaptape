---
name: Clerk verification boundaries
description: Browser cache and bot checks can distort authentication migration verification.
---

After an authentication SDK major change, evaluate the app using freshly loaded
browser bundles before diagnosing a provider-context error as an application defect.
Keep self-service signup verification distinct from sign-in with an
administrator-created development account.

**Why:** During Clerk adoption, a retained browser context reported a missing
provider while a fresh browser rendered correctly. Hard navigation removed that
false failure; Cloudflare's protect_check then prevented the tester from
completing self-service signup, even though ordinary login worked.

**How to apply:** Preserve the bot protection. Report CAPTCHA-blocked signup as
unverified, never as passed merely because a supported backend-created test user
can sign in. Do not weaken production protections to make automated tests pass.

Dynamic protected routes with image-like extensions must still run Clerk
middleware.

**Why:** A staff-only SVG route initially skipped the default static-asset
matcher; invoking server auth there produced a 500 instead of a proper
authentication redirect or nonstaff 404.

**How to apply:** Explicitly include protected route subtrees even when they
contain file extensions. Verify the actual matcher and both anonymous and
nonstaff responses, without removing staff authorization.
