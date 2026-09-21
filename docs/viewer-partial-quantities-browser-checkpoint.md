# Partial v1.6 quantity browser checkpoint

This is an isolated browser regression check performed after the missing
collection completeness fix. It is intentionally separate from the stored
project inventory: no project or measurement row was created, edited, or
deleted.

## Result

- Authenticated owner project viewer route opened successfully before the
  isolated mount.
- Authenticated staff project viewer route opened successfully before the
  isolated mount.
- The harness bundled and mounted the real `ProjectViewer`, `ViewerNextClient`,
  `prepareProjectMeasurement`, `computeDerived`, and `buildCards` flow inside
  that authenticated browser document. It did not add an app route or bypass
  application authentication.
- Omitted, null, and malformed collection scenarios all rendered `—` in the
  visible card totals for roof area, roof edges, gutters, walls, openings,
  trim, and condition areas. The visible downspout row also rendered `—`.
- An explicitly empty-array scenario rendered known zero quantities rather
  than `—` for all of those cards and the downspout row.
- For every scenario, the prepared card/row values were compared with the
  values in the rendered DOM; all matched.
- Real Chromium with software WebGL completed all four isolated mounts with
  zero uncaught exceptions, console errors, or failed assertions.
- Two opaque temporary sessions were inserted solely for normal owner/staff
  authentication. Both were deleted, and both token hashes were re-queried
  absent before the harness reported success.

## Reproduction

The test-only browser harness is:

- `artifacts/aufmass-app/scripts/viewer-partial-quantities-browser.ts`
- `artifacts/aufmass-app/scripts/viewer-partial-quantities-entry.tsx`
- `artifacts/aufmass-app/scripts/viewer-partial-measurement-browser.ts`

It uses the already-running app and a separately launched headless Chromium
CDP process. Its final result was:

```json
{"authenticatedOwnerRoute":"passed","authenticatedStaffRoute":"passed","isolatedScenarios":["omitted","null","malformed","empty"],"result":"passed","consoleErrors":0,"temporarySessions":2,"temporarySessionCleanup":"passed"}
```

The isolated samples exist only in browser memory. The run did not start a
measurement, call an extraction/paid API, alter staff configuration, or write
any stored project data.