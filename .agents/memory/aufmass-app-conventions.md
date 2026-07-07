---
name: Aufmaß-App conventions
description: Fixed stack, iron rules, and artifact quirks for the Aufmaß-App (Next.js artifact in this monorepo)
---

# Aufmaß-App

- The stack is FIXED per explicit user instruction (Next.js App Router + TS + Tailwind, PostgreSQL, Replit Object Storage, three.js later, Anthropic later, Stripe stage 6). Never swap it.
  **Why:** user brief says "Stack (fix, nicht ändern)".
- The 9 "Eiserne Regeln" (mm unrounded internally, mess-schema.json contract, fixed IDs F-1/T-1/K-1/D-1, confidence/source on every value, "Richtmaß, kein Bestellmaß" hint, errors before payment, calculations only in lib/berechnung/, UI texts central in i18n, facade names strassenseite/gartenseite/links/rechts) live verbatim in root `replit.md` — read them before any feature work.
- The app lives at `artifacts/aufmass-app/` (previewPath "/"); it is a Next.js app inside a mostly Vite/Express monorepo. `artifacts/api-server` and `artifacts/mockup-sandbox` are NOT part of this product.
- User communicates in German; UI starts German, English prepared.

# Viewer (three.js) lessons

- CSS2DRenderer (three ~0.178) rewrites each label's `element.style.display` every frame from `object.visible` (+frustum/layers), and skips whole subtrees whose parent has `visible === false`. Control CSS2D label visibility via the `.visible` flag — manual `style.display` writes get clobbered next frame.
  **How to apply:** any toggle/thinning of Maß-Labels in `lib/viewer/szene.ts` must set `CSS2DObject.visible` (group flag alone also works for all-off).
- Headless verification: neither the E2E test browser nor local tooling has WebGL — `erstelleSzene` throws and the fallback shows. Keep viewer logic testable by extracting pure functions (see `szene.ts` exports + `szene.test.ts`); visual 3D checks only the user's preview can confirm.

# Form validation convention

- Forms with i18n error texts must set `noValidate` and rely on the server action's German message; native browser `required` tooltips are locale-dependent (English in tests) and violate iron rule 8.
  **How to apply:** any new form with a required field — return the i18n error from the action, render it via role="alert", keep `required` only as a semantic hint.

# Artifact.toml lessons (platform)

- `verifyAndReplaceArtifactToml` rejects: (a) unknown keys like `serve = "run"` — for a server-rendered production service just give `build` + `run` arrays with no `serve` key; (b) any change to the `[[integratedSkills]]` block — keep it verbatim even if semantically stale (e.g. react-vite skill on a Next.js app).
- Next.js in this proxied env: dev/start scripts need `-p $PORT -H 0.0.0.0`; `allowedDevOrigins` must include the exact `REPLIT_DOMAINS` values (the `*.replit.dev` wildcard does NOT match the multi-level dev subdomain); `transpilePackages: ["@workspace/db"]` is required because @workspace/db exports .ts source.
- `next dev` auto-rewrites tsconfig on first run (sets `strict: false`, `esModuleInterop: true`) — re-set `strict: true` afterwards.
