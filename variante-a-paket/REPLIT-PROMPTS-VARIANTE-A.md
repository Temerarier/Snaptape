# SnapTape – Replit-Prompts Variante A (Stand 12.10.2026)

Geprüft gegen `github.com/Temerarier/Snaptape`, Commit `6687840` (23.09.2026). Vier Prompts, nacheinander. Nach jedem grünen „DONE WHEN“ einen Checkpoint in Replit setzen.

## Vorher (ohne Prompt)

1. **Paket ins Repo legen.** Den Ordner `variante-a-paket/` aus der Zip-Datei in das Repo-Wurzelverzeichnis kopieren und committen („add variante-a package“). Er enthält:
   - `shared/schema/measurement-v1.8.json`: Schema 1.8 mit `massing`
   - `docs/pipeline/extract-photo-prompt.md`, `extract-plan-prompt.md`, `extract-mixed-prompt.md`: Messprompts v1.8.3 in der App-Fassung
   - `docs/pipeline/buildhouse-prompt.md`: Prompt Schritt 2
   - `docs/pipeline/buildhouse-correction-prompt.md`: Korrektur bei „Stopp“
   - `artifacts/aufmass-app/lib/modell3d/core.js`: fester Kern (Messung → MESS, Bausteine, Prüfung mit Stufen)
   - `test-fixtures/variante-a/`: 5 Häuser mit Messung + `buildhouse.js` und `erwartet.json`
2. **Guthaben:** Anthropic aufladen (und Kimi, solange die Standard-Messung Kimi nutzt).

## Reihenfolge und Einstellungen

| # | Prompt | Agent-Einstellung | Kostet API-Geld? |
|---|---|---|---|
| R1 | Schema 1.8 + Messprompts v1.8.3 | Power, Effort Medium, ohne Plan | nein (ein optionaler Messlauf: Cent-Beträge) |
| R2 | Modell auf Opus 5.5 umstellen; Schritt 2: Hausbau-Funktion erzeugen, abgeschottet ausführen, prüfen, speichern | Power, Effort High, ohne Plan | ein Testlauf |
| R3 | Viewer zeigt das Variante-A-Modell | Power, Effort High, ohne Plan | nein |
| R4 | Admin-Ansicht: wie Schritt 2 lief, je Projekt | Power, Effort Low, ohne Plan | nein |

---

## R1 – Schema 1.8 und Messprompts v1.8.3

````text
GOAL
Switch the measurement step to schema 1.8 (adds the "massing" block) and to the measurement
prompts v1.8.3. Nothing else changes: same pipeline, same models, same viewer.

WHAT IS WHERE (verified at commit 6687840)
- Prompts are read VERBATIM from docs/pipeline/extract-{photo,plan,mixed}-prompt.md by
  artifacts/aufmass-app/lib/messung/prompts.ts (baueSystemText). It appends
  docs/pipeline/reference-catalog.md and shared/schema/measurement-v1.7.json.
- The repair prompt (baueRepairSystemText) replaces __SCHEMA_V1_7__ in
  docs/pipeline/repair-prompt.md with the v1.7 schema.
- Validation: lib/measurement/src/validateMeasurement.ts (Ajv 2020, schema file per version),
  lib/measurement/src/schemaVersions.ts (SUPPORTED_SCHEMA_VERSIONS = ["1.6","1.7"]).
- New files to use are in variante-a-paket/ at the repo root (already committed).

BUILD
1. Copy, do not edit:
   - variante-a-paket/shared/schema/measurement-v1.8.json -> shared/schema/measurement-v1.8.json
   - variante-a-paket/docs/pipeline/extract-photo-prompt.md, extract-plan-prompt.md,
     extract-mixed-prompt.md -> docs/pipeline/ (overwrite the existing three files)
   The prompt files are final texts. Never reword, shorten or "fix" them.
2. prompts.ts: append measurement-v1.8.json instead of v1.7 in baueSystemText and in
   baueRepairSystemText. In docs/pipeline/repair-prompt.md rename the placeholder
   __SCHEMA_V1_7__ to __SCHEMA__ and replace that one (only that line changes in the file).
3. Validation: add "1.8" to SUPPORTED_SCHEMA_VERSIONS and the schema path map. 1.6 and 1.7
   stay supported for stored projects.
4. lib/messung/pipeline.ts and the extractor must not drop or rename the "massing" key
   anywhere (check parseTolerant, the null-healing step heileNullFelder, and any code that
   copies the measurement field by field).
5. The existing viewer (buildModel) and computeDerived must keep working with a 1.8
   measurement: extra keys are ignored. Do not change buildModel in this prompt.

TESTS
- New test: each test-fixtures/variante-a/*/messung.json validates as schema 1.8 with
  validateMeasurement.
- New test: computeDerived runs on each of them without throwing.
- Existing tests stay green.

DO NOT
- Do not edit the three extract prompt texts, the schema text or the reference catalog.
- Do not change models, temperatures, the number of runs or the pipeline flow.
- Do not touch the viewer.

DONE WHEN
- [ ] shared/schema/measurement-v1.8.json and the three prompt files are byte-identical
      to variante-a-paket/ (show `diff` output: empty)
- [ ] baueSystemText output for each route ends with the v1.8 schema (log the first and
      last 200 characters for "photo")
- [ ] 5 of 5 fixtures in test-fixtures/variante-a validate as 1.8; computeDerived runs on all
- [ ] pnpm test passes; production build clean
- [ ] Optional, costs cents: one real measurement run on an existing test project returns
      meta.schema_version "1.8" and a non-empty massing.bodies. Report model, tokens, cost.
````

---

## R2 – Schritt 2: Hausbau-Funktion erzeugen, abgeschottet ausführen, prüfen, speichern

````text
GOAL
After a successful measurement (step 1), run step 2: a second model call writes a JavaScript
function buildHouse(MESS, api). Our server runs it in an isolated sandbox with the fixed core
(lib/modell3d/core.js), checks the result against the measurement and stores the resulting
3D data (faces with ids - plain JSON, no code) on the project. The customer never receives
AI-written code. The measurement (step 1) stays the single source of all numbers in the panel.

WHAT IS WHERE (verified at commit 6687840, after R1)
- Pipeline: artifacts/aufmass-app/lib/messung/pipeline.ts, fuehreMessLaufAus(). It sets the
  project to status "model_ready" (guarded by currentRunId) and inserts a measure_runs row.
  It is started from lib/upload/actions.ts.
- Model calls: lib/messung/modelle.ts, rufeExtraktionsModell(quality, {system, userText,
  bilder, temperature}) -> {text, inputTokens, outputTokens}; MODELL_IDS; schaetzeKostenUsd().
- Images: lib/messung/echterExtraktor.ts, baueBildTeile(dateien) (not exported yet).
- DB: lib/db/src/schema/projects.ts (projectsTable), lib/db/src/schema/messung.ts
  (measureRunsTable). Migrations via drizzle-kit push (lib/db).
- Core: variante-a-paket/artifacts/aufmass-app/lib/modell3d/core.js. It is plain ES5 inside
  one function SNAPTAPE_CORE() that returns {measurementToMess, makeApi, runBuild, pruefen, ...}.
  It has no imports and must be copied unchanged.
- Prompts: variante-a-paket/docs/pipeline/buildhouse-prompt.md (system text step 2) and
  buildhouse-correction-prompt.md (placeholders __ERRORS__ and __PREVIOUS_CODE__).

BUILD
0. Model: add "claude-opus-5-5" to lib/messung/modelle.ts as an Anthropic model (same client
   as claude-fable-5). Opus 5.5 thinks adaptively by default: look up in the current Anthropic
   API docs how to set the effort / thinking level, set it explicitly (start with the lowest
   level that still works), and count thinking tokens as output tokens. Price per 1M tokens
   for the cost estimate: input 4, output 20 (VERIFY on the official Anthropic pricing page
   and write the date of the check in a comment). Then:
   - the premium measurement (step 1) uses claude-opus-5-5 instead of claude-fable-5
     (MODELL_IDS.premium); the standard measurement (kimi-k3) stays unchanged;
   - step 2 uses claude-opus-5-5 by default (env SCHRITT2_MODELL can override it).
   Both steps were tested with Opus 5.5 in the chat tests.
1. Files (copy unchanged): core.js -> artifacts/aufmass-app/lib/modell3d/core.js;
   buildhouse-prompt.md and buildhouse-correction-prompt.md -> docs/pipeline/.
   Load the prompt texts verbatim the same way prompts.ts loads the extract prompts.

2. Sandbox (lib/modell3d/sandbox.ts)
   - Run the AI code with the npm package isolated-vm (a separate V8 isolate: no require, no
     process, no network, no file system). Limits: memoryLimit 128 MB, timeout 8000 ms.
   - Inside the isolate evaluate: the source of core.js, then
       const C = SNAPTAPE_CORE();
       JSON.stringify(C.runBuild(MESS, CODE));
     with MESS (the converted measurement, as JSON) and CODE (the AI code, as a string)
     passed in as copied values. runBuild already catches errors thrown by the AI code.
   - A timeout or memory abort returns an empty result with one entry in "fehler"
     ("Zeitlimit von 8 s überschritten" / "Speicherlimit überschritten").
   - If isolated-vm cannot be installed or built on Replit, STOP and report. Do not fall back
     to node:vm or eval in the main process - that is not a security boundary.

3. Code extraction (lib/modell3d/extract.ts): take the largest ```js / ```javascript block
   that contains "buildHouse"; if there is none, take the text from "function buildHouse" to
   the end (cut at the next ```). No function found -> treat as STOP with the error
   "Keine Funktion buildHouse in der Antwort".

4. Step 2 run (lib/modell3d/schritt2.ts, function fuehreModellLaufAus):
   a. MESS = C.measurementToMess(measurement) - run core functions on the host by loading
      core.js as a module (module.exports at its end) for measurementToMess and pruefen.
   b. Model call: system = buildhouse-prompt.md; userText = "MEASUREMENT:\n" + the stored
      measurement JSON (minified); bilder = the same images as step 1 (export baueBildTeile
      from echterExtraktor.ts without changing its behaviour); temperature 0.2.
      Model: env SCHRITT2_MODELL, default claude-opus-5-5 (see 0); any other model id known in modelle.ts can be set via the env.
   c. Extract code, run it in the sandbox, P = C.pruefen(MESS, result).
   d. If P.stufe === "stopp": ONE correction call. userText = buildhouse-correction-prompt.md
      with __ERRORS__ = one line per row with status "fail" ("- <id> <pruefung>: <text>")
      and __PREVIOUS_CODE__ = the extracted code; same images, same system text.
      Extract, run, check again.
   e. Store on the project (new columns, see 5):
      - stufe "ok" or "merken": model3d = the result JSON (flaechen, oeffnungen, anbauten,
        deko, kanten, fallrohre, schaeden, ergaenzt, konflikte, nicht_gebaut, fehler,
        hinweise), model3dStatus = "ready"
      - still "stopp": model3d = null, model3dStatus = "unavailable"
      - model3dReport always = {stufe, zahlen, zeilen, korrektur_genutzt, modell}
   f. Never let step 2 change the step-1 result: the project stays "model_ready" with its
      measurement, whatever happens in step 2. Any exception in step 2 -> model3dStatus
      "unavailable" and the error text in model3dReport.

5. DB (drizzle, then push):
   - projects: model3d jsonb null, model3d_status text null ("pending" | "ready" |
     "unavailable"), model3d_report jsonb null.
   - new table model_runs: id, project_id (fk, cascade), measure_run_id (fk measure_runs,
     null), created_at, model, stufe, korrektur_genutzt boolean, input_tokens,
     output_tokens, cost_usd, duration_ms, sandbox_ms, code_chars, report jsonb,
     ai_code text (the final code - stored for analysis only, never sent to a browser).
     One row per model call (so a correction gives two rows).

6. Wiring: in fuehreMessLaufAus, after the step-1 result was applied (ausgang
   "model_ready" and the guarded update returned a row), set model3dStatus "pending" and
   call fuehreModellLaufAus. Step 1 must already be visible to the user before step 2 ends
   (the viewer shows the panel and "3D-Modell wird erstellt"). Projects measured before this
   change have model3dStatus null and keep using the existing viewer path.

TESTS (no API calls)
- Sandbox + check on test-fixtures/variante-a: for each house run measurementToMess, the
  sandbox with buildhouse.js, pruefen. Expected values in test-fixtures/variante-a/erwartet.json
  (stufe, ids_fehlen, number of flaechen / oeffnungen / kanten). All 5 must match.
- Probes, each expected stufe "stopp", none may crash the test process:
  (a) code "function buildHouse(MESS, api) { throw new Error('x') }"
  (b) code "function buildHouse(MESS, api) { while (true) {} }"  (ends by timeout)
  (c) code "function buildHouse(MESS, api) { require('fs') }"    (no require in the isolate)
  (d) code "function buildHouse(MESS, api) { fetch('https://example.com') }" (no fetch)
- Extraction test: an answer with prose before and after one ```js block.
- Correction-prompt test: placeholders filled, no placeholder left.

DO NOT
- Do not edit core.js or the two prompt texts. If core.js seems wrong, report it.
- Do not run AI code outside the isolate, not even "just for a test".
- Do not send ai_code or model3dReport to the customer's browser.
- Do not change step 1 (except the model id switch in 0) or the existing viewer in this prompt.

DONE WHEN
- [ ] isolated-vm installed; sandbox test green for 5/5 fixtures and 4/4 probes (show table)
- [ ] One real run on an existing test project (costs about 1 USD): project gets
      model3dStatus "ready" or "unavailable", model3dReport filled, model_runs row(s) with
      tokens and cost. Report: stufe, correction used, tokens, cost, total duration.
- [ ] Step 1 result is unchanged by step 2 (same measurement JSON before and after)
- [ ] pnpm test passes; production build clean
````

---

## R3 – Viewer zeigt das Variante-A-Modell

````text
GOAL
The existing new viewer (/app/projekt/[id]/viewer, /admin/projekt/[id]/viewer, /viewer-next)
shows the Variante-A model (project.model3d) instead of the model computed by buildModel,
whenever it exists. Panel, selection, black box, measuring line, condition toggle and
dimension lines keep working unchanged, because they work on ViewerModel. All numbers in the
panel and in the black box still come from the measurement (computeDerived) - the 3D data
only decides where things are drawn.

WHAT IS WHERE (verified at commit 6687840)
- components/viewer-next/ViewerNextClient.tsx calls buildModel(measurement, derived) and
  passes the ViewerModel to components/viewer-next/ViewerViewport.tsx.
- ViewerModel and its parts are plain data: lib/viewer-next/model/types.ts
  (walls, roofFaces, roofs, edges, openings, attachments, conditions, massing, bounds,
  permanentDimensions, diagnostics, notes). Helpers for frames, triangles and bounds exist
  in lib/viewer-next/model/buildModel.ts.
- ViewerViewport applies buildPresentationClosure (closure.ts) to fill gaps.
- Stored A data (after R2): project.model3d with
    flaechen[]   {id_1_7, art: "wand" | "dach" | "untersicht" | "blende" | ..., ecken: [[x,y,z],...]}
    oeffnungen[] {id_1_7, art, wand_id_1_7, ecken}      outline in the wall plane
    anbauten[]   {id_1_7, art, flaechen: [ecken...], farben: [hex|null...]}
    deko[]       {art, farbe, flaechen: [ecken...]}     not selectable, no id
    kanten[]     {id_1_7, art, von: [x,y,z], bis: [x,y,z]}
    fallrohre[]  {id_1_7, oben, unten}
    schaeden[]   {id_1_7, art, flaeche_id_1_7, ecken}
  Coordinates in mm, origin front-left corner of the main body at grade, x right, y back, z up.

BUILD
1. lib/viewer-next/model/fromModel3d.ts: modelFromModel3d(model3d, measurement, derived)
   -> ViewerModel.
   - Geometry (corners, triangles, normals, frames, bounds) comes from model3d.
   - Every value shown to the user (widthMm, heightMm, gableHeightMm, areaMm2, netAreaMm2,
     pitchRiseOver12, opening type/size, edge lengthMm, colors) comes from the measurement
     by id - exactly like buildModel does today. If an id is not in the measurement, use
     null / "—", never a value measured from the 3D data.
   - Several polygons with the same id (a wall split by another body, a roof in parts) are
     allowed. Selecting the id highlights all of them. Add a test for that.
   - anbauten -> attachments (one entry per face, same id). deko -> massing polygons that are
     drawn but never selectable. fallrohre -> edges with edgeClass "downspout" and their
     DS id. schaeden -> conditions (lifted 20 mm off their face, as today).
   - permanentDimensions from the measurement: length = footprint width along the front,
     depth = footprint depth, eaveHeight = building.eave_height_mm, drawn at the matching
     model edges (front eave edge, front-left corner).
   - Use the existing helpers from buildModel.ts (move shared helpers to a small module if
     needed, without changing buildModel's output).
2. ViewerNextClient: if the project has model3dStatus "ready" and model3d, build the model
   with modelFromModel3d; otherwise use buildModel as today. Pass a flag so that
   ViewerViewport does NOT apply buildPresentationClosure to an A model (A models are
   closed by construction; the closure would add wrong faces).
3. States on the viewer page:
   - model3dStatus "pending": panel as usual, 3D area shows "3D-Modell wird erstellt …" and
     refreshes every 10 s until ready or unavailable.
   - "unavailable": panel as usual, 3D area shows "3D-Modell nicht verfügbar. Alle Werte im
     Panel stammen aus der Messung." (de) / English text in en-US, via i18n.
   - null (projects from before R2): unchanged, buildModel path.
4. /viewer-next (test page): add a selector "Testhaus" with the 5 fixtures from
   test-fixtures/variante-a. For each it builds model3d on the server with the R2 sandbox
   from buildhouse.js (no API call) and shows it. Keep the existing garage-house fixture as
   the first entry.

TESTS
- modelFromModel3d on all 5 fixtures: no throw; every id in model3d appears in the
  ViewerModel; every wall / opening / roof face carries the measured values by id.
- A model3d with one polygon id that is missing from the measurement shows "—", not a number.
- Viewer page renders for each of the three states (pending / unavailable / ready).

DO NOT
- Do not change buildModel's output for projects without model3d.
- Do not change the panel, the calculation layer, colors, layout or design tokens.
- Do not read numbers for the panel or the black box from the 3D data.

DONE WHEN
- [ ] /viewer-next shows all 5 test houses; screenshots front and back of each
- [ ] Leipzig: click on WL-1 -> black box shows 14,300 x 8,140 mm (the measured values);
      click on CA-1 with conditions on -> condition card; DS-1 selectable from the panel
- [ ] Panel -> model and model -> panel selection work on all 5 houses (spot check 3 ids each)
- [ ] Measuring line snaps to an eave edge of the Farmhouse 140040RK
- [ ] Old project without model3d looks exactly as before (screenshot before / after)
- [ ] pnpm test passes; production build clean
````

---

## R4 – Admin-Ansicht: wie Schritt 2 lief

````text
GOAL
Staff can see for every project how step 2 (the 3D model) went, without opening the database.
Read-only: no buttons that start model runs, no model switching in the UI.

WHAT IS WHERE (after R2/R3)
- Admin list: artifacts/aufmass-app/app/admin/measurements/page.tsx (measure_runs table).
- Admin project page: app/admin/projekt/[id]/ (requireStaff).
- Step-2 data: projects.model3d_status / model3d_report, table model_runs.

BUILD
1. Admin list: per project add the columns "3D" (ok / merken / stopp / ausstehend / –),
   "Korrektur" (ja / nein), "Modell Schritt 2", "Kosten Schritt 2" and "Kosten gesamt"
   (step 1 + step 2).
2. Admin project page, new section "3D-Prüfung":
   - the rows of model3dReport grouped by status: stopp, merken, info - each with id,
     check and text;
   - counts: ids built / not built / missing, edges, downspouts, condition areas;
   - the lists ergaenzt, konflikte and nicht_gebaut from model3d;
   - the stored ai_code of the last model_runs row in a collapsed block.
3. A filter on the admin list "nur 3D-Stufe merken / stopp" so recurring problems are easy
   to find.

DO NOT
- Do not show any of this to customers.
- Do not add buttons that call a model or change the default model (claude-opus-5-5) or the
  check thresholds. Another model for step 2 can still be set with the env SCHRITT2_MODELL.

DONE WHEN
- [ ] Admin list shows the new columns for at least one real project with a step-2 run
- [ ] Admin project page shows the "3D-Prüfung" section with grouped rows and the code block
- [ ] Filter "merken / stopp" works
- [ ] pnpm test passes; production build clean
````

---

## Danach (nicht Teil dieses Pakets)

- **Optional:** Ein anderes Modell für Schritt 2 (z. B. Sonnet 5.5) lässt sich über die Umgebungsvariable `SCHRITT2_MODELL` testen. Standard bleibt Opus 5.5.
- **Messprompt v1.8.3** ist schon in R1 enthalten. Eine Prompt-Änderung später heißt: die drei Dateien `docs/pipeline/extract-*-prompt.md` ersetzen und committen, ohne Codeänderung.
- **Aufräumen:** Erst wenn alle neuen Projekte ein A-Modell haben, `buildModel.ts` und `closure.ts` für 1.8-Messungen stilllegen. Für alte Projekte bleiben sie.
