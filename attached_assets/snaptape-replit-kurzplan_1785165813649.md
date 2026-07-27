# SnapTape — Project Brief & Roadmap (docs/plan.md)

> Put this file in the repo as `docs/plan.md` before the first prompt. It explains what we are building and in which order. Each later prompt builds one step of this roadmap.

## What we are building

SnapTape measures houses from photos. A contractor uploads photos of a house (or plan PDFs). Our AI pipeline turns them into a full set of measurements: roof, walls, edges, openings, penetrations, visible damage. The customer then gets two things: an interactive 3D viewer and a printable measurement report with PDF/Excel/JSON export. Our users are US roofing, siding, and painting contractors who use these numbers to write quotes.

## The most important rule

All parts of the app share one data format: **the measurement JSON, defined in `shared/schema/measurement-v1.5.json`.** The pipeline writes it, the viewer reads it, the report exports it. A complete example lives in `fixtures/garage-house.json` — use it as test data everywhere.

Two things follow from this rule:
- **Never invent new fields or formats.** If something seems missing, stop and ask.
- **All math happens in millimeters, unrounded.** Converting to feet/inches and rounding happens only once — when a value is shown on screen or in a report.

## Roadmap — what gets built, in this order

**Step 0 — Foundation.** Put the schema, the example house, and a validation test into the repo.

**Step 1 — Upload.** Users upload up to 10 files (photos or plan PDFs, max 20 MB each), choose a measurement quality (standard or premium), and can enter one known dimension as a reference (e.g. "the entry door is 2.03 m"). PDFs are rendered to one image per page right after upload — all AI calls work with these page images, never the raw PDF. Each project has a status: uploaded → measuring → ready → failed. After upload, the AI classifies every file and every PDF page (exterior photo? plan? unusable?); if there are many plan pages, only the 15 most relevant go into the measurement. The upload is only rejected if measuring is impossible.

**Step 2 — Measurement pipeline.** The AI extraction, copied from our existing n8n workflow: pick the right extraction prompt depending on what was uploaded (photos / plans / both), run it with the schema and our reference catalog (all files go in as images, only the usable ones), retry or repair if the answer is broken, combine the raw estimates into final values, validate against the schema, save. The quality choice decides which AI model is used. Every run is logged in an internal admin view — customers never see logs, model names, or costs.

**Step 3 — Compute layer.** A small, tested code module that turns the stored measurement into display values: squares, edge totals, net wall areas, grouped windows, and so on. Viewer and report both use this module, so their numbers always match.

**Step 4 — New viewer.** Built exactly after the approved design (`docs/viewer-reference.html`): on the left a freely rotatable 3D house in its real colors, with a measure-line tool (snaps to edges) and a damage toggle; on the right the measurements panel with trade filter chips and collapsible blocks. The old viewer is deleted only after the new one passes its checklist — and that deletion is its own separate prompt.

**Step 5 — Report & exports.** Built exactly after the approved example (`docs/report-reference.html`): the measurements as a clean printable document in quote order, plus PDF, Excel, and JSON download.

**Step 6 — Final check.** One complete run with real photos, remove all leftover test code, log duration and cost per measurement.

## Check numbers for the example house

Use these to verify results — don't just trust output that "looks right":
roof 2,097 sq ft = 21.0 SQ · 6 roof facets · walls net 2,656 sq ft · 16 windows · 3 doors · 4 downspouts · eaves 118' 0" · ridge 70' 0".
