# Project viewer cutover

## Result

The existing owner and staff project viewer URLs now use guarded preparation
(`computeDerived → buildCards → ViewerNextClient`) with real project headers.
Readable non-1.6 objects show the localized older-version message without
entering preprocessing. Missing or unreadable measurements show the localized
unreadable message. Partial 1.6 data retains usable parts, unknown quantities,
and visible omission warnings. No stored projects or measurements were changed.

The existing owner filter, staff gate, UUID checks, project/status 404 behavior,
and post-measurement redirect remain intact. All three demo navigation links
now use `/viewer-next`; the fixture remains labelled “Test data”.

Run metadata now uses the measurement's actual schema version, or `unknown`
when extraction did not yield a readable version. No historical rows were
backfilled and no database schema was changed.

## Mandatory deletion checkpoint

Before any deletion, authenticated real-Chromium verification passed for all
28 model-ready projects through both owner and staff routes (56 visits):
24 older-version messages, three v1.6 viewers, and one unreadable message
in each route family. No browser console errors were recorded. Owner isolation
and the staff gate passed. Six temporary normal sessions were removed and
their absence re-queried.

The complete per-project table, actual omitted/degraded part IDs, visible
warnings, screenshots and coverage boundaries are in
`docs/viewer-cutover-browser-checkpoint.md`.

## Deleted files

Each candidate was searched across the codebase before deletion, in dependency
order, after the checkpoint passed:

- `artifacts/aufmass-app/app/app/viewer/page.tsx`
- `artifacts/aufmass-app/lib/messung/anzeigeAdapterV15.ts`
- `artifacts/aufmass-app/components/viewer/ModellViewer.tsx`
- `artifacts/aufmass-app/components/viewer/BauteilPanel.tsx`

There were no tests exclusively targeting these deleted components/adapter.
No live imports of `ModellViewer` or `anzeigeAdapterV15` remain.

## Retained legacy/shared files

- `lib/viewer/szene.ts`: retained because `lib/viewer/buehne.ts` imports it for
  the login-house scene; `lib/viewer/szene.test.ts` still tests it.
- `lib/viewer/baukasten.ts` and `lib/viewer/buehne.ts`: unchanged; consumed by
  `components/auth/HausBuehne.tsx`.
- `lib/viewer/anzeige.ts` and `lib/berechnung/flaechen.ts`: unchanged; consumed
  by `app/app/projekt/[id]/page.tsx` for overview formatting/summary tiles.
- Shared-module tests, measurement schema and `testhaus` remain for surviving
  login/overview/shared consumers.

Paths above are relative to `artifacts/aufmass-app` unless fully qualified.
No deletion caused a build/test failure or required restoring a file.

## Verification after deletion

- Production Next.js build: passed.
- Workspace library typecheck: passed.
- App typecheck: passed.
- `pnpm test`: 23 files / 233 tests passed, including localized version-gating,
  unreadable payloads, mixed partial data, project header isolation, model/cards
  tolerance, and pipeline metadata.
- Missing/null/malformed collections retain unknown aggregates (“—”);
  only explicitly empty collections produce known-zero totals. Preparation-to-card
  regressions cover all six collections and mixed valid/malformed records.
- Isolated partial-data browser checks passed after authenticated owner and
  staff route visits. All omitted/null/malformed cases displayed “—”; explicit
  empties displayed zeros. No console errors; both temporary sessions removed.
  See `docs/viewer-partial-quantities-browser-checkpoint.md`. These are isolated
  test inputs, not modifications to or claims about stored project payloads.
- `git diff --check`: passed.
- Managed app workflow restarted successfully.
- Post-deletion real-Chromium smoke passed: login WebGL house, authorized
  project detail summary tiles, demo navigation, and obsolete demo 404; no
  console errors. The single temporary session was removed and absence checked.

The standard preview screenshot browser cannot create WebGL in this
environment and correctly displays the fallback. The authenticated checkpoint
uses real Chromium with software WebGL; its screenshots show rendered models.
Neither constitutes physical-device GPU testing.

No measurement runs, paid API calls, stored-data migration, project deletion,
admin-table changes, authentication rewrites, publishing, or production-data
changes occurred.