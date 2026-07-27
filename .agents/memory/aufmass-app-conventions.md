---
name: Aufmaß-App conventions
description: Fixed stack, iron rules, and artifact quirks for the Aufmaß-App (Next.js artifact in this monorepo)
---

# Aufmaß-App

- The stack is FIXED per explicit user instruction (Next.js App Router + TS + Tailwind, PostgreSQL, Replit Object Storage, three.js later, Anthropic later, Stripe stage 6). Never swap it.
  **Why:** user brief says "Stack (fix, nicht ändern)".
- The 9 "Eiserne Regeln" (mm unrounded internally, mess-schema.json contract, fixed English IDs, confidence/source on every value, reference-only hint, errors before payment, calculations only in lib/berechnung/, UI texts central in i18n, elevations front/back/left/right) live verbatim in root `replit.md` — read them before any feature work.
- Schema contract is v1.2 (English, US market) since July 2026: IDs RF-/WL-/SF-/FC-, E-, W-/D-/G-/SK-, AT-; CAUTION: D- means door (was Dach) and W- means window (was Wand) — never assume v1.0 meanings. Status enum: draft/reviewing/ready/failed. Display imperial (ft-in, whole ft², pitch x/12), data stays unrounded mm. Contract file: `artifacts/aufmass-app/schema/mess-schema.json`.
- TWO contracts coexist since 2026-07-27: the SnapTape roadmap (docs/plan.md) added canonical v1.5 at `shared/schema/measurement-v1.5.json` (fixture `fixtures/garage-house.json`, validator `@workspace/measurement`, Ajv 2020-12 dialect required). The running app still reads v1.2 until the roadmap's viewer step migrates it — don't "unify" them early, and never edit v1.5 schema/fixture content (byte-fixed external contract).
- The internal HausModell (lib/viewer/baukasten.ts) intentionally keeps German FIELD names (typ, fassade, laengeMm) with English VALUES — do not "fix" `.typ` accesses.
- The app lives at `artifacts/aufmass-app/` (previewPath "/"); it is a Next.js app inside a mostly Vite/Express monorepo. `artifacts/api-server` and `artifacts/mockup-sandbox` are NOT part of this product.
- User communicates in German; UI display texts are still German (English UI translation is its own stage, proposed as follow-up task), internal names/enums are English.

# Viewer (three.js) lessons

- CSS2DRenderer (three ~0.178) rewrites each label's `element.style.display` every frame from `object.visible` (+frustum/layers), and skips whole subtrees whose parent has `visible === false`. Control CSS2D label visibility via the `.visible` flag — manual `style.display` writes get clobbered next frame.
  **How to apply:** any toggle/thinning of Maß-Labels in `lib/viewer/szene.ts` must set `CSS2DObject.visible` (group flag alone also works for all-off).
- Headless verification: neither the E2E test browser nor local tooling has WebGL — `erstelleSzene` throws and the fallback shows. Keep viewer logic testable by extracting pure functions (see `szene.ts` exports + `szene.test.ts`); visual 3D checks only the user's preview can confirm.

# Form validation convention

- Forms with i18n error texts must set `noValidate` and rely on the server action's German message; native browser `required` tooltips are locale-dependent (English in tests) and violate iron rule 8.
  **How to apply:** any new form with a required field — return the i18n error from the action, render it via role="alert", keep `required` only as a semantic hint.

# Build/test quirks (monorepo)

- After editing `lib/db/src/schema/*`, run `pnpm exec tsc -b lib/db --force` — the composite build emits `lib/db/dist/*.d.ts` that project references consume; stale declarations cause false tsc errors in the app even though exports point to src.
  **Why:** cost >1 debugging round during the v1.2 migration.
- Run vitest from the workspace ROOT (`pnpm exec vitest run`); running inside `artifacts/aufmass-app` finds no tests.
- DB schema renames here are done by drop & recreate (psql drop tables/types, then `pnpm --filter @workspace/db run push-force`, then reseed via `artifacts/aufmass-app/scripts/seed-testdaten.ts`); there is deliberately no migration infrastructure.

# Server Actions & system deps

- Every export of a `"use server"` file is a client-invocable HTTP endpoint. Never export unauthenticated read helpers from action files — inline such queries in the server component instead.
  **Why:** an exported `ladeProjektDateien` without auth would have been callable by anyone (caught during Step-1 upload review).
- System deps for uploads: nix names are `poppler-utils` (pdftoppm/pdfinfo; `poppler_utils` does NOT resolve) and `vips` (vipsthumbnail, has HEIF de+encode). Both are needed at runtime → also in deployment.

# Artifact.toml lessons (platform)

- `verifyAndReplaceArtifactToml` rejects: (a) unknown keys like `serve = "run"` — for a server-rendered production service just give `build` + `run` arrays with no `serve` key; (b) any change to the `[[integratedSkills]]` block — keep it verbatim even if semantically stale (e.g. react-vite skill on a Next.js app).
- Next.js in this proxied env: dev/start scripts need `-p $PORT -H 0.0.0.0`; `allowedDevOrigins` must include the exact `REPLIT_DOMAINS` values (the `*.replit.dev` wildcard does NOT match the multi-level dev subdomain); `transpilePackages: ["@workspace/db"]` is required because @workspace/db exports .ts source.
- `next dev` auto-rewrites tsconfig on first run (sets `strict: false`, `esModuleInterop: true`) — re-set `strict: true` afterwards.
