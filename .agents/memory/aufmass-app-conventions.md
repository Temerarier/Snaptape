---
name: Aufmaß-App conventions
description: Fixed stack, iron rules, and artifact quirks for the Aufmaß-App (Next.js artifact in this monorepo)
---

# Aufmaß-App

- Viewer cutover does not authorize data migration or shared-module cleanup.
  **Why:** the user explicitly chose an older-version message over converting stored measurements, and requires login-house/overview dependencies to remain intact.
  **How to apply:** treat stored geometry as authoritative; preserve shared legacy calculations and rendering dependencies even after the project viewer changes.
- Safe rendering arrays must not imply complete measurement collections.
  **Why:** normalizing missing/null collections to empty arrays made unknown takeoff totals look like exact zero during the viewer cutover.
  **How to apply:** preserve completeness separately when sanitizing partial data; omitted or malformed records cannot justify exact totals, even if remaining geometry renders.
- Do not alter the canonical fixture to make requested golden totals pass when independent arithmetic disagrees.
  **Why:** on 2026-09-10 the user approved correcting the net-wall expected value to match parent-linked dimension deductions, rather than trusting inconsistent stored net totals or changing the fixture.
  **How to apply:** explain and obtain approval for an inconsistent acceptance value; preserve the fixture and the independently correct calculation.

# Viewer (three.js) lessons

- CSS2DRenderer (three ~0.178) rewrites each label's `element.style.display` every frame from `object.visible` (+frustum/layers), and skips whole subtrees whose parent has `visible === false`. Control CSS2D label visibility via the `.visible` flag — manual `style.display` writes get clobbered next frame.
  **How to apply:** any toggle/thinning of Maß-Labels in `lib/viewer/szene.ts` must set `CSS2DObject.visible` (group flag alone also works for all-off).
- Headless verification: the standard screenshot browser may lack WebGL, but local Chromium with ANGLE/SwiftShader has successfully rendered the viewer. Distinguish software-WebGL evidence from fallback screenshots and physical-device/hardware verification.
  **Why:** A blanket assumption that all local browsers lack WebGL prevented actual 3D verification; explicitly enabled software rendering works here.

# Form validation convention

- Forms with i18n error texts must set `noValidate` and rely on the server action's localized message; native browser `required` tooltips are browser-locale-dependent and can contradict the user's selected app language.
  **How to apply:** any new form with a required field — return the i18n error from the action, render it via role="alert", keep `required` only as a semantic hint.

# Build/test quirks (monorepo)

- After editing `lib/db/src/schema/*`, run `pnpm exec tsc -b lib/db --force` — the composite build emits `lib/db/dist/*.d.ts` that project references consume; stale declarations cause false tsc errors in the app even though exports point to src.
  **Why:** cost >1 debugging round during the v1.2 migration.
- Run vitest from the workspace ROOT (`pnpm exec vitest run`); running inside `artifacts/aufmass-app` finds no tests.

# Server Actions & system deps

- Every export of a `"use server"` file is a client-invocable HTTP endpoint. Never export unauthenticated read helpers from action files — inline such queries in the server component instead.
  **Why:** an exported `ladeProjektDateien` without auth would have been callable by anyone (caught during Step-1 upload review).
- System deps for uploads: nix names are `poppler-utils` (pdftoppm/pdfinfo; `poppler_utils` does NOT resolve) and `vips` (vipsthumbnail, has HEIF de+encode). Both are needed at runtime → also in deployment.

# Artifact.toml lessons (platform)

- `verifyAndReplaceArtifactToml` rejects: (a) unknown keys like `serve = "run"` — for a server-rendered production service just give `build` + `run` arrays with no `serve` key; (b) any change to the `[[integratedSkills]]` block — keep it verbatim even if semantically stale (e.g. react-vite skill on a Next.js app).
- Next.js in this proxied env: dev/start scripts need `-p $PORT -H 0.0.0.0`; `allowedDevOrigins` must include the exact `REPLIT_DOMAINS` values (the `*.replit.dev` wildcard does NOT match the multi-level dev subdomain); `transpilePackages: ["@workspace/db"]` is required because @workspace/db exports .ts source.
- `next dev` auto-rewrites tsconfig on first run (sets `strict: false`, `esModuleInterop: true`) — re-set `strict: true` afterwards.
