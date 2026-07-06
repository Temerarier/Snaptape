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

# Artifact.toml lessons (platform)

- `verifyAndReplaceArtifactToml` rejects: (a) unknown keys like `serve = "run"` — for a server-rendered production service just give `build` + `run` arrays with no `serve` key; (b) any change to the `[[integratedSkills]]` block — keep it verbatim even if semantically stale (e.g. react-vite skill on a Next.js app).
- Next.js in this proxied env: dev/start scripts need `-p $PORT -H 0.0.0.0`; `allowedDevOrigins` must include the exact `REPLIT_DOMAINS` values (the `*.replit.dev` wildcard does NOT match the multi-level dev subdomain); `transpilePackages: ["@workspace/db"]` is required because @workspace/db exports .ts source.
- `next dev` auto-rewrites tsconfig on first run (sets `strict: false`, `esModuleInterop: true`) — re-set `strict: true` afterwards.
