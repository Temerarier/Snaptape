# UI inventory — browser pass

Scope: requested registration/login checks and uploads only. No product/source files were edited. No measurement was started, no paid provider was called, and no project/files were deleted or existing measurement data modified. The generated test credentials are intentionally omitted from this report and `ui-context.json`.

## Anonymous routes and authentication

- Anonymous `GET /` redirected to `/login`; no public landing page was shown. Blank login form screenshot: `7v87yg`.
- `/status` rendered “Application running,” “Database connected,” and “Object storage configured.” Screenshot: `6j374b`. The browser logged a WebGL-context creation failure on this route; no status-page content error was visible.
- Registration succeeded and redirected to `/app`. Blank register form screenshot: `nasrgc`.
- Sign out returned to `/login` after a short navigation delay.
- Wrong-password login stayed on `/login` and displayed the readable alert **“Invalid email or password.”** Screenshot: `9bf9g5`.
- Registering the same account again was rejected on `/register` with **“An account already exists for this email.”** Screenshot: `0lfnky`.
- Correct-password login redirected to `/app`; the project list was initially empty. Blank login form screenshot: `mq17g5`.
- Form screenshots with entered values were visually masked. No credentials are recorded here.

## Projects and uploads

- Created **Inventory 2026-10-25 stub Braamheide**, address label `Braamheide`. Uploaded all six Braamheide JPEGs and `Hausansicht_Braamheide_1.pdf`. The PDF displayed as 3 pages. All seven items were present with no pending/error status and “Start measurement” enabled. Final upload screenshot: `8x5ker`.
- Created **Inventory 2026-10-25 real Leipzig** and uploaded only the nine Leipzig photos (`IMG_6794.jpeg`, `IMG_6797.jpeg`, `IMG_6799.jpeg`, `IMG_6804.jpeg`, `IMG_6805.jpeg`, `IMG_6807.jpeg`, `IMG_6809.jpeg`, `IMG_6810.jpeg`, `seitenansiicht.jpg`). No PDF was uploaded. All nine photo cards were present, with no pending/error status; “Start measurement” was not clicked. Screenshot: `43ypdr`.
- The header quick-create control opened a new blank project with its default title; that own-user project was renamed inline to the requested Leipzig title and reused. No extra project was left behind. Both created project UUIDs and the new user UUID are in `scripts/inventory/ui-context.json`.
- After workflow restoration, the Leipzig project still opened for the same user and retained all nine photos. The navigation call timed out waiting for `load`, but the resulting page and screenshot showed the complete upload page (`up52kf`).

## Admin and ownership checks

- As the authenticated non-staff user, `/admin/measurements` and `/admin/billing` each returned the generic Next.js 404 page rather than an explicit authorization-denied message. Screenshots: `lh7hoi`, `4vuapc`.
- Runtime-only positive staff check was available. The web workflow was restarted with a temporary `STAFF_EMAILS` override for the generated test account only. `/admin/measurements` rendered the “Measurement runs” table (screenshot `oxcbxn`); `/admin/billing` rendered “Billing Reconciliation” and warned that the daily billing schedule is not activated (screenshot `acnr1m`). Billing actions were not used. Customer/table data were visually masked for these screenshots; no existing row JSON or Viewer link was opened.
- The workflow was restarted again without an override, and the temporary env file was removed. The test user then attempted an existing project’s viewer route without any staff/auth bypass; the app returned a generic 404 (`lyfot6`). No other user’s viewer data was inspected.

## Evidence and limits

Screenshot IDs above refer to the browser harness’s automatic observations. The harness did not expose screenshot bytes for export, so this pass could not copy these observations into `screenshots/inventory-2026-10-25/`. No viewer/model-ready screenshot was taken because the requested pipeline was deliberately not started. WebGL creation errors appeared in the browser during some non-viewer routes; the viewer itself was not tested in this pass.
