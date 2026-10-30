# First hands-on test: six presentation changes

## Scope

- Pending 3D state: accent spinner, translated title and timing/final-measurement
  message. Existing 10-second `AutoRefresh` is retained.
- Viewer header: `/app` back link, text on desktop and accessible arrow below 768 px.
- Project detail URL: owner-checked server redirect to viewer for `model_ready`;
  all other statuses, including legacy ones, go to upload.
- Upload: processing message and refresh instead of editing/start controls;
  stored failure errors, editing and explicit one-credit retry information.
  A processing page follows completion to the viewer; a deliberate Add photo visit
  to an already-ready project stays on upload.
- Overview: no status chips or hidden legacy status query filtering; search, count,
  sorting, archive and card badges remain.
- Cards: earliest upload by `created_at`, with deterministic ID tie-break. Photo
  preview or PDF page one is served through the existing owner-protected file
  route, lazily displayed with cover sizing. No-files cards use a plain placeholder.
- Colors: valid six-digit measured hex wins even at low confidence; confidence
  metadata and measured secondary-color behavior remain. Missing/invalid colors
  use the requested proposed material palette, defined only in viewer tokens.
  Garage doors retain their existing darker semantic color. Lights, materials,
  textures, shadows and the Variante-A adapter are unchanged.

Legacy status labels remain because the shared status badge still renders
historical `reviewing`/`ready` projects (and staff billing uses the same dictionary).
The database enum and historical records were not changed.

## Automated verification

- `pnpm typecheck`: passed.
- `pnpm test`: 463 tests passed across 52 files.
- `pnpm --filter @workspace/aufmass-app run build`: passed.
- Managed web workflow restarted successfully and served requests.
- Regression tests cover low-confidence measured hex, every requested wall
  material, roof/soffit/fascia fallback, secondary hex validation, unchanged
  semantic opening colors, all eight redirect statuses and owner constraints,
  processing/failed upload states, overview controls, lazy image and no-photo cards.
- Existing model tests were updated to assert palette colors, not removed.

## Software-WebGL verification

Reused `scripts/inventory/viewer-harness.mjs` with `--variante-a --presentation`.
It renders the actual production ProjectViewer, ViewerNextClient, model adapter,
materials and compiled production CSS in an isolated loopback component host.
It is not an authentication bypass or a screenshot of an authenticated app route.
The host substitutes only the absent Next router: real AutoRefresh records a
refresh request instead of navigating the isolated host.

Read-only inputs:

1. Farmhouse 140040RK
2. Farmhouse test 5
3. Leipzig villa
4. Triplex 40014DB
5. Tudor 93233EL
6. Existing real step-2 acceptance project

All six produced front/back and 390-pixel screenshots with SwiftShader,
nonzero rendered triangles, no WebGL error or context loss, and valid non-neutral
wall/roof color values. Screenshots were visually inspected; measured dark colors
are intentionally retained rather than overwritten for stronger contrast.
The Leipzig case additionally verifies:

- pending spinner and both text lines, desktop and phone screenshots;
- a real 10-second polling callback;
- transition back to a rendered ready model;
- desktop Projects text and mobile arrow-only accessible link;
- no horizontal document overflow at 390 px.

Reproduction:

```sh
pnpm --filter @workspace/aufmass-app exec tsx ../../scripts/inventory/viewer-a-data.ts
node scripts/inventory/viewer-harness.mjs --variante-a --presentation \
  generated-artifacts/viewer-a/inputs.json \
  generated-artifacts/first-hands-on/results.json
```

Evidence lives in ignored `generated-artifacts/first-hands-on/`.
The harness presentation mode does not repeat the unrelated historic picking
or measuring acceptance tests.

## Authenticated browser pass

The existing owner account was used through the development preview, without
creating an account or modifying projects, uploads, measurements or credits.
The first pass verified ready/failed redirects, the failed project's stored
provider error and retry pricing, desktop/mobile back navigation, Add photo,
sorting and archive navigation.

It also caught two issues, fixed before delivery:

- Long card titles could expand a mobile grid item's intrinsic minimum width.
  Card containers now explicitly allow shrinking.
- Drizzle's single-table select removed the outer Column qualifier from the
  correlated first-file expression, binding `id` to the inner file instead.
  Explicit SQL identifiers preserve `"projects"."id"`. A regression test checks
  the full generated SELECT, and a read-only query through the actual app DB
  verified two photo-preview URLs and one PDF first-page URL.

Focused browser confirmation after those fixes passed:

- Desktop 1440 px: document scroll/client widths 1425/1425.
- Phone 390 px: document scroll/client widths 375/375; no overflow.
- Three lazy protected images loaded: two JPEG previews (600×800) and one
  PDF first-page PNG (2122×3000), all HTTP 200 after a cache-disabled hard reload.
- Clicking the ready project's card at 390 px reached its viewer.

An existing customer session/project was not modified to stage a processing
measurement. That upload state is covered by component regression tests; the
3D pending/ready states were rendered with the component-level SwiftShader host.
The ordinary browser's no-WebGL fallback is distinct from that successful
software-WebGL render.

## Protected scope

No changes to measurement prompts, computeDerived, viewerCards, panel values,
credit accounting, step 2, schema, stored measurements, or sandbox. No provider
calls, new measurements, uploads or credit grants were made for this work.
