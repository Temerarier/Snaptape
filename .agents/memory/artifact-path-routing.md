---
name: Artifact path routing traps
description: Shared proxy routes path prefixes to artifacts; /api/* belongs to the api-server artifact, so the Next app never sees those requests.
---

# /api/* is shadowed by the api-server artifact

The workspace proxy (localhost:80) routes by path prefix across artifacts.
The `api-server` artifact owns `/api/*`, so any Next.js route handler in
the aufmass-app under `app/api/...` is unreachable — requests get an
Express 404 (`X-Powered-By: Express`, text/html) instead.

**Why:** The proxy matches path prefixes before the Next app ever sees
the request, so an `app/api/...` route handler is silently unreachable —
the api-server artifact answers with its own 404 and nothing in the
Next app logs hints at the reason.

**How to apply:** Never create `app/api/...` routes in the aufmass-app.
Use a different top-level prefix (e.g. `/dateien/...`). Diagnose with
response headers: `X-Powered-By: Express` on an expected-Next path means
the request landed in the wrong artifact.
