# SnapTape – Bestandsaufnahme vom 25.10.2026

**Auftrag:** [attached_assets/Pasted-SnapTape-Bestandsaufnahme-und-Replit-Analyse-Prompt-Sta_1792958077561.txt](../attached_assets/Pasted-SnapTape-Bestandsaufnahme-und-Replit-Analyse-Prompt-Sta_1792958077561.txt), Abschnitt 5.
**Referenzstand:** unveränderter Produktstand `66878401d4f09207bd81fda7cbe605d8542c1a88`.
**Zweck:** Entscheidungsvorlage für Landing Page, Registrierung/Login, Upload/KI-Messung und 3D-Viewer. Kein Umbau, keine Migration, kein Publishing.
**Pfadangaben:** Kürzel wie `app/...`, `components/...`, `lib/upload/...`, `lib/messung/...`, `lib/viewer-next/...` und `i18n/...` sind relativ zu `artifacts/aufmass-app/`. Workspace-Bibliotheken wie `lib/db/` und `lib/measurement/` sowie `docs/`, `shared/`, `scripts/` liegen am Repo-Root.

## 1. Umgebung, Secrets und Veröffentlichung

### Laufzeit und Werkzeuge

```text
Checked UTC: 2026-10-25T20:02:33+00:00
Git HEAD: 66878401d4f09207bd81fda7cbe605d8542c1a88
v24.22.1
10.26.1
Python 3.11.14
pdftoppm version 25.05.0
Copyright 2005-2025 The Poppler Developers - http://poppler.freedesktop.org
Copyright 1996-2011, 2022 Glyph & Cog, LLC
vips-8.16.1
Paket vorhanden? no
Schema1.8 vorhanden? no
Production settings:
modules = ["nodejs-24", "python-3.11", "postgresql-16"]

[deployment]
router = "application"
deploymentTarget = "autoscale"

[deployment.postBuild]
args = ["pnpm", "store", "prune"]
env = { "CI" = "true" }

[workflows]

[agent]

```

Quelle: [scripts/inventory/environment.log](../scripts/inventory/environment.log). Der App-Preview läuft unter `/`; `/api/*` gehört dem separaten Express-Artefakt. Nach Start der vorhandenen Workflows lieferte `GET /api/healthz` `{"status":"ok"}`. Quellen: `artifacts/aufmass-app/.replit-artifact/artifact.toml:1–28`, `artifacts/api-server/src/routes/health.ts:6`. Frühere Meldung „Your app is not running“ war durch nicht gestartete Workflows erklärbar, nicht durch einen reproduzierten Compilefehler. Ein Grund für das damalige Stoppen ist nicht belegt.

### Secrets: nur Existenz, niemals Werte

Erhebung mit `viewEnvVars(type=secret, environment=development)` und Präsenzprüfung im laufenden Probeprozess, [scripts/inventory/secret-status.json](../scripts/inventory/secret-status.json) / [scripts/inventory/providers.json](../scripts/inventory/providers.json). SET bedeutet **nicht**, dass jeder Zugang oder jedes Guthaben damit bereits bewiesen ist.

| Variable | Status | Einordnung |
|---|---|---|
| DATABASE_URL | SET | Im Entwicklungsprozess vorhanden |
| ANTHROPIC_API_KEY | SET | Im Entwicklungsprozess vorhanden |
| KIMI_API_KEY | SET | Im Entwicklungsprozess vorhanden |
| ANTHROPIC_ADMIN_KEY | SET | Im Entwicklungsprozess vorhanden |
| DEFAULT_OBJECT_STORAGE_BUCKET_ID | SET | Im Entwicklungsprozess vorhanden |
| PRIVATE_OBJECT_DIR | SET | Im Entwicklungsprozess vorhanden |
| STAFF_EMAILS | SET | Im Entwicklungsprozess vorhanden |
| SESSION_SECRET | SET | Im Entwicklungsprozess vorhanden |
| EXTRAKTOR_STUB | MISSING | Optionaler Testschalter; fehlend ist im Normalbetrieb korrekt |
| EXTRAKTOR_STUB_KAPUTT | MISSING | Optionaler Testschalter; fehlend ist im Normalbetrieb korrekt |
| REPLIT_DEPLOYMENT | MISSING | Im Entwicklungsprozess erwartungsgemäß nicht gesetzt |

- **Datenbank:** `SELECT 1` erfolgreich, [scripts/inventory/db-baseline.json](../scripts/inventory/db-baseline.json); 14 deklarierte Tabellen und 142 Live-Spalten im gesonderten SELECT-only-Abgleich.
- **Object Storage:** privates Präfix erfolgreich gelistet, Stichprobe 5 Objekte; keine Objektnamen protokolliert. Ergebnis: `PRIVATE_PREFIX_LIST_OK`. Das belegt List-Zugriff, nicht allein einen vollständigen Browser-Upload.
- **Anthropic:** `GET /v1/models?limit=100`, HTTP 200. Geforderte IDs:

| Modell-ID | Für diesen Schlüssel gelistet |
|---|---|
| claude-fable-5 | LISTED |
| claude-opus-5-5 | LISTED |
| claude-sonnet-5-5 | LISTED |
| claude-haiku-5-5 | LISTED |

Eine Modellliste ist kein kostenpflichtiger Messages-Aufruf und beweist **kein verfügbares Guthaben**. Kein Opus-5.5-Aufruf wurde gesendet. `ANTHROPIC_ADMIN_KEY` ist gesetzt; ein vollständiger Kostenabgleich ist nicht Umfang dieser Bestandsaufnahme.

- **Moonshot:** minimaler gestreamter Chat mit `model=kimi-k3, max_tokens=5, temperature=1`, HTTP 200; Nutzung 88 Input- / 8 Output-Tokens, davon 5 Reasoning-Tokens; Abschluss `length`. Kein „insufficient balance“-Fehler in dieser Probe. Ein so kleiner Ausgabegrenzwert kann durch Reasoning verbraucht werden; Erfolg heißt nicht, dass eine vollständige Hausmessung bereits geprüft ist. 
- **Guthaben:** erfolgreicher Kimi-Ping belegt Bezahlbarkeit dieses Requests, keine garantierte Reserve für einen langen Lauf. Anthropic-Guthaben ist durch den Listenaufruf allein nicht feststellbar. Ergebnisse des realen Laufs stehen in Abschnitt 5.

Der spätere echte Start bestand auch die kostenpflichtige Klassifizierung vor der Kimi-Extraktion (`lib/klassifizierung/service.ts:15,160–180`, Browserübergang „Checking your files“ → „Measuring“). In den ausgeführten Providerprüfungen und diesem Lauf wurde **kein insufficient-balance-Fehler** gemeldet. Weder ein belastbarer aktueller Kontostand noch eine dauerhafte Guthabenreserve sind damit zugesichert.

### Deployment

`getDeploymentInfo()`: success=true, isDeployed=false, primaryUrl leer, additionalUrls=[].
Kein aktives Deployment und keine aktive Produktionsadresse. Produktions-DB-Probe `SELECT 1` wurde mit **„This project has no production database.“** abgewiesen. `.replit:1–13` nennt zwar `autoscale`, aber eine vorbereitete Einstellung ist keine Veröffentlichung. Es wurde nichts veröffentlicht oder konfiguriert. Unveröffentlichte Domainentwürfe sind durch diese Metadaten nicht belegt.
Quellen: [scripts/inventory/deployment.json](../scripts/inventory/deployment.json), [scripts/inventory/production-db.json](../scripts/inventory/production-db.json).

## 2. Installation, Typecheck, Tests, Build und Schemaabgleich

| Prüfung | Exit | Dauer | Ergebnis / Rohprotokoll |
|---|---:|---:|---|
| CI=true pnpm install --frozen-lockfile | 0 | 3.77 s | PASS – [scripts/inventory/install.log](../scripts/inventory/install.log) |
| pnpm typecheck | 0 | 12.31 s | PASS – [scripts/inventory/typecheck.log](../scripts/inventory/typecheck.log) |
| pnpm test | 0 | 5.01 s | PASS – [scripts/inventory/test.log](../scripts/inventory/test.log) |
| pnpm --filter @workspace/aufmass-app build | 0 | 36.66 s | PASS – [scripts/inventory/build.log](../scripts/inventory/build.log) |
| pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts | 1 | 0.64 s | FAIL – [scripts/inventory/drizzle-check.log](../scripts/inventory/drizzle-check.log) |

**Unit-Tests:** 30/30 Testdateien und 290/290 Tests bestanden. **Typecheck:** Exit 0 für gemeinsame Bibliotheken, API-Server, Next-App, Mockup-Sandbox und Skriptpaket. **Next-Produktions-Build:** erfolgreich. Keine fehlgeschlagenen Unit-Tests oder Typfehler zu transkribieren. Vollständige Ausgaben liegen in den verlinkten Logs.

### Fehlgeschlagene Kommandos: erste 30 Zeilen wortgetreu

**pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts**

```text
$ pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts
Reading config file '/home/runner/workspace/lib/db/drizzle.config.ts'
Error  Please provide required params for AWS Data API driver:
    [x] database: undefined
    [✓] secretArn: 'postgresql'
undefined
/home/runner/workspace/lib/db:
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command failed with exit code 1: drizzle-kit check --config ./drizzle.config.ts

```


`drizzle-kit check` ist **kein erfolgreicher Live-Schemaabgleich**: der Befehl scheitert mit einer Treiber-/Parameterfehlermeldung. Das ist nicht gleichbedeutend mit fehlenden Tabellen. Deshalb erfolgte ein unabhängiger Abgleich über `information_schema.columns` und `pg_enum` mit den tatsächlichen Drizzle-Tabellenmetadaten, innerhalb `BEGIN READ ONLY`, ohne `push` oder Workspace-Introspektionsdateien.

Ergebnis: **14 deklarierte Tabellen, 142 Live-Spalten, 0 Unterschiede** bei Tabellen/Spalten, nativen Typen, Nullable-Regeln und Enum-Werten/-Reihenfolge. Fehlende Tabellen/Spalten: **keine**. Grenzen: semantische Gleichheit aller Defaults, Indizes, CHECK- und FK-Ausdrücke wird damit nicht zugesichert.
Quelle: [scripts/inventory/database.ts](../scripts/inventory/database.ts), [scripts/inventory/db-drift.json](../scripts/inventory/db-drift.json).

## 3. Entwicklungsdatenbank: Ausgangsbestand

SELECT-only-Snapshot **vor den neuen Inventur-Testdaten**. Keine E-Mail-Adressen, Passwort-Hashes oder Sessionwerte abgefragt bzw. ausgegeben. Quelle: [scripts/inventory/db-baseline.json](../scripts/inventory/db-baseline.json).

| Tabelle | Zeilen |
|---|---:|
| users | 17 |
| projects | 87 |
| project_files | 137 |
| measure_runs | 55 |

### Projekte nach Status

| Status | Anzahl |
|---|---:|
| draft | 9 |
| reviewing | 2 |
| ready | 2 |
| failed | 25 |
| files_uploaded | 1 |
| processing | 15 |
| model_ready | 32 |
| classified | 1 |

### Messläufe nach Ausgang und Modell

| Ausgang | Modell | Anzahl |
|---|---|---:|
| model_ready | claude-fable-5 | 20 |
| model_ready | kimi-k3 | 8 |
| model_ready | NULL / nicht protokolliert | 3 |
| failed | claude-fable-5 | 5 |
| failed | kimi-k3 | 1 |
| failed | NULL / nicht protokolliert | 18 |

### Versionen gespeicherter Messungen

| meta.schema_version | Anzahl |
|---|---:|
| 1.5 | 24 |
| 1.6 | 5 |
| 1.7 | 2 |

32 Projekte haben Status `model_ready`, aber nur 31 davon enthalten eine gespeicherte Messung; die Differenz ist kein Versionszählfehler. Die einzelnen UUIDs und Versionen stehen zusammen mit ihrem Viewer-Ergebnis in Abschnitt 4. Die 15 Projekte mit Status `processing` beweisen keine aktuell laufenden Worker; ein automatisches Recovery/Timeout-Verhalten wurde nicht nachgerüstet oder allein aus dem Status behauptet.

## 4. Feature-Durchgang und Viewer

### Login, Registrierung, Upload und Admin

### UI inventory — browser pass

Scope: requested registration/login checks and uploads only. No product/source files were edited. No measurement was started, no paid provider was called, and no project/files were deleted or existing measurement data modified. The generated test credentials are intentionally omitted from this report and `ui-context.json`.

#### Anonymous routes and authentication

- Anonymous `GET /` redirected to `/login`; no public landing page was shown. Blank login form screenshot: `7v87yg`.
- `/status` rendered “Application running,” “Database connected,” and “Object storage configured.” Screenshot: `6j374b`. The browser logged a WebGL-context creation failure on this route; no status-page content error was visible.
- Registration succeeded and redirected to `/app`. Blank register form screenshot: `nasrgc`.
- Sign out returned to `/login` after a short navigation delay.
- Wrong-password login stayed on `/login` and displayed the readable alert **“Invalid email or password.”** Screenshot: `9bf9g5`.
- Registering the same account again was rejected on `/register` with **“An account already exists for this email.”** Screenshot: `0lfnky`.
- Correct-password login redirected to `/app`; the project list was initially empty. Blank login form screenshot: `mq17g5`.
- Form screenshots with entered values were visually masked. No credentials are recorded here.

#### Projects and uploads

- Created **Inventory 2026-10-25 stub Braamheide**, address label `Braamheide`. Uploaded all six Braamheide JPEGs and `Hausansicht_Braamheide_1.pdf`. The PDF displayed as 3 pages. All seven items were present with no pending/error status and “Start measurement” enabled. Final upload screenshot: `8x5ker`.
- Created **Inventory 2026-10-25 real Leipzig** and uploaded only the nine Leipzig photos (`IMG_6794.jpeg`, `IMG_6797.jpeg`, `IMG_6799.jpeg`, `IMG_6804.jpeg`, `IMG_6805.jpeg`, `IMG_6807.jpeg`, `IMG_6809.jpeg`, `IMG_6810.jpeg`, `seitenansiicht.jpg`). No PDF was uploaded. All nine photo cards were present, with no pending/error status; “Start measurement” was not clicked. Screenshot: `43ypdr`.
- The header quick-create control opened a new blank project with its default title; that own-user project was renamed inline to the requested Leipzig title and reused. No extra project was left behind. Both created project UUIDs and the new user UUID are in `scripts/inventory/ui-context.json`.
- After workflow restoration, the Leipzig project still opened for the same user and retained all nine photos. The navigation call timed out waiting for `load`, but the resulting page and screenshot showed the complete upload page (`up52kf`).

#### Admin and ownership checks

- As the authenticated non-staff user, `/admin/measurements` and `/admin/billing` each returned the generic Next.js 404 page rather than an explicit authorization-denied message. Screenshots: `lh7hoi`, `4vuapc`.
- Runtime-only positive staff check was available. The web workflow was restarted with a temporary `STAFF_EMAILS` override for the generated test account only. `/admin/measurements` rendered the “Measurement runs” table (screenshot `oxcbxn`); `/admin/billing` rendered “Billing Reconciliation” and warned that the daily billing schedule is not activated (screenshot `acnr1m`). Billing actions were not used. Customer/table data were visually masked for these screenshots; no existing row JSON or Viewer link was opened.
- The workflow was restarted again without an override, and the temporary env file was removed. The test user then attempted an existing project’s viewer route without any staff/auth bypass; the app returned a generic 404 (`lyfot6`). No other user’s viewer data was inspected.

#### Evidence and limits

Screenshot IDs above refer to the browser harness’s automatic observations. The harness did not expose screenshot bytes for export, so this pass could not copy these observations into `screenshots/inventory-2026-10-25/`. No viewer/model-ready screenshot was taken because the requested pipeline was deliberately not started. WebGL creation errors appeared in the browser during some non-viewer routes; the viewer itself was not tested in this pass.


Zusätzlich als lokale Dateien gesichert: [screenshots/inventory-2026-10-25/register.jpg](../screenshots/inventory-2026-10-25/register.jpg) und [screenshots/inventory-2026-10-25/login.jpg](../screenshots/inventory-2026-10-25/login.jpg). Der Standard-Screenshotbrowser kann dort keinen WebGL-Kontext für die dekorative 3D-Ansicht erstellen und zeigt den Hintergrund-Fallback; die Login-/Registerformulare bleiben sichtbar. Diese Umgebungsfehler werden nicht als genereller Ausfall der App oder der separat mit SwiftShader geprüften 3D-Komponenten gewertet.

Präzise Prüflücke zu Abschnitt 4e des Auftrags: `/status` wurde anonym erfolgreich geprüft, nicht nochmals gesondert in der temporären Staff-Sitzung. Die beiden Admin-Seiten wurden mit und ohne Staff-Berechtigung geprüft.

### Kostenloser Stub-Lauf: bewusst getrennte Prüfschritte

Wichtige Einschränkung des gelieferten Testauftrags: `EXTRAKTOR_STUB=1` wird nur in `lib/messung/extraktor.ts:78–87` geprüft; `lib/upload/actions.ts:522–539` ruft vorher unverändert `klassifiziereDateien` auf. `lib/klassifizierung/service.ts:15,160–180` nutzt dafür Claude Sonnet. Ein Klick auf „Messung starten“ ist damit **nicht automatisch kostenlos**.

Der neue, über die UI hochgeladene Braamheide-Test wurde anschließend mit der **echten Pipeline**, aber Prozessschalter `EXTRAKTOR_STUB=1` und explizit synthetischen Klassifizierungsmetadaten ausgeführt. Status **model_ready**, 7 Dateien, 3 PDF-Seiten, Schema **1.7**, Dauer 10.35 s. Das ist ein Test von Upload → Verarbeitung und separat Pipeline → Stub → Viewer, kein Beweis eines vollständig kostenlosen produktiven Start-Buttons. Quelle: [scripts/inventory/stub-result.json](../scripts/inventory/stub-result.json).

### Viewer screenshots and authorized real-run start

#### Environment and live-run handoff

- Before starting the Leipzig run, checked the currently running Next process without printing environment values: `EXTRAKTOR_STUB` was **unset**; `STAFF_EMAILS` was set but did **not** match the temporary test-account override. The default web workflow had already been restored.
- On `Inventory 2026-10-25 real Leipzig` (project UUID `93e09fad-fef3-4e2b-af9f-adf4bd137831`), confirmed the nine photos, Standard selected, no reference object/value, then clicked **Start measurement once**.
- The UI first showed **“Checking your files …”**, then navigated to the project page with status **“Measuring”** and message **“Measuring your building… this page updates automatically.”** It listed 9 files, showed no classification gate failure, and kept Open 3D disabled. This is the stop condition requested; no second click, retry, premium run, or further polling was performed. The live run was left active for the main agent to SELECT-poll.
- The web workflow was not restarted after the live measurement started.
- Start-state screenshot observation: `1papdc`.

#### Braamheide stub viewer

Tested only the new user's own Braamheide stub project, UUID `2a4ba0ce-7e33-455a-9f81-b449eb0c7ed0`.

##### Desktop — 1280×720

- Screenshot observation: `6j279k` (the preceding route-navigation capture is `01t2li`).
- The measurements panel rendered populated data and viewer controls, but no 3D model appeared. The viewport displayed: **“The 3D view could not be started. Your browser or device does not support WebGL. The measurements in the panel remain available.”**
- Renderer check: one 300×150 canvas, no image fallback. Browser logs reported `THREE.WebGLRenderer` could not create a WebGL context; therefore the observed state is the app's WebGL-unavailable fallback, not a rendered model.
- Document width was 1265px at 1280px viewport width; no horizontal overflow was measured. No raw viewer/common/measurement translation-key-like strings were detected.
- Browser logs also included a React hydration-mismatch warning. No other viewer-specific console error was observed.

##### Phone — 390×844

- Screenshot observation: `usyh5h` (the first resized capture is `wy6ol4`).
- The same WebGL-unavailable fallback remained; measurement controls/data were stacked below the viewport, with “Show full model” between viewer and Measurements.
- Measured document/body client width was 375px and scroll width 383px, i.e. 8px horizontal overflow. The viewer itself measured 375px client/scroll width. The screenshot showed a bottom horizontal scrollbar and the fallback sentence clipped at the right edge. The development issues badge also overlapped part of the first measurement row.
- No raw translation-key-like strings were detected. The browser logs retained the WebGL creation errors and hydration warning seen at desktop.

#### Screenshot export

The browser tool supplied the screenshot observations above, but no supported byte/file export was available in this pass. Per browser harness constraints, `page.screenshot()` was not called. The observations are referenced by ID here; image files were not written into `screenshots/inventory-2026-10-25/`.


**Zusätzlicher lokaler Software-WebGL-Nachweis:** tatsächliche ProjectViewer-Komponente des neuen Stub-Projekts, [screenshots/inventory-2026-10-25/stub-desktop.png](../screenshots/inventory-2026-10-25/stub-desktop.png) und [screenshots/inventory-2026-10-25/stub-phone.png](../screenshots/inventory-2026-10-25/stub-phone.png). Je sechs Wände und sechs Dachflächen sowie 20 Öffnungen modelliert. Quelle: [scripts/inventory/stub-project-viewer-results.json](../scripts/inventory/stub-project-viewer-results.json). Diese isolierten Komponentenbilder ergänzen die authentifizierten Browser-Beobachtungen; sie ersetzen weder deren vollständiges App-Layout noch widerlegen sie den dort beobachteten mobilen Fallback-Overflow.

### Alle 32 zuvor vorhandenen model_ready-Projekte

**Zugriffsmethode:** SELECT-only-Messungssnapshots → tatsächliche `ProjectViewer`-, `ViewerNextClient`-, Vorbereitungs- und Builder-Komponenten → unveränderte Materialien und kompiliertes Produktions-CSS → isolierter Loopback-Browser mit SwiftShader-WebGL bei 1280×900. Systemschrift statt Next-Fontloader; geerbtes App-Layout und jeweilige Benutzer-Sprache nicht mitgeprüft. Die Route selbst prüft Eigentum (`app/app/projekt/[id]/viewer/page.tsx:23–43`); es wurden keine fremden Sitzungen eingefügt und keine Authentifizierungsprüfung umgangen. Diese Bilder sind daher **Komponentenaufnahmen realer Messungen, keine angemeldeten Eigentümer-Routen-Screenshots**.

Ergebnis: **31/32** mit tatsächlichen WebGL-Dreiecken, **1/32** mit lesbarer „Measurement could not be read“-Meldung. Keine ungefangenen Browserausnahmen, keine protokollierten Browser-Console-Errors in diesem abgeschlossenen Durchgang. Ein verworfener erster Harness-Versuch hatte den LocaleProvider vergessen; dies war ein Probeaufbaufehler, keine App-Regression. Der korrigierte Harness verwendet den tatsächlichen LocaleProvider.

**Wichtige Abweichung vom Übergabetext:** `projectMeasurement.ts:464–475` akzeptiert Schema **1.5** ausdrücklich strukturell. Alle 24 entsprechenden Bestandsprojekte werden aktuell zum Viewer vorbereitet, nicht pauschal mit „ältere Version“ abgewiesen; der Builder hält dazu eine interne Kompatibilitätsnotiz. Die behauptete pauschale 1.5-Sperre stimmt nicht mit dem aktuellen Code überein. Es wurde kein Datensatz migriert.

„Modelliert“ zählt erhaltene Builder-Elemente, nicht aus einem Kamerawinkel sichtbare Flächen oder geometrische Richtigkeit. Überlagerung und falsche Positionierung sind damit nicht ausgeschlossen. Die bekannte Ursache bleibt durch [docs/viewer-diagnose-2026-09-23.md](../docs/viewer-diagnose-2026-09-23.md) belegt.

Quelle und vollständige Diagnostik: [scripts/inventory/viewer-results.json](../scripts/inventory/viewer-results.json); reproduzierbar über `node scripts/inventory/viewer-harness.mjs` nach dem Build.

| Projekt-ID | Schema | Zustand | Wände vorhanden → modelliert | Dachflächen vorhanden → modelliert | Öffnungen vorhanden → modelliert | ältere-Version-Hinweis | Aufnahme |
|---|---|---|---|---|---|---|---|
| 04770b22-405d-4d41-b0f9-77e4dc680288 | 1.5 | viewer | 4 → 4 | 2 → 2 | 3 → 3 | nein | [screenshots/inventory-2026-10-25/real-04770b22-405d-4d41-b0f9-77e4dc680288.png](../screenshots/inventory-2026-10-25/real-04770b22-405d-4d41-b0f9-77e4dc680288.png) |
| 0c87a1ce-389c-435a-87fa-12d163039c06 | 1.6 | viewer | 5 → 5 | 4 → 4 | 26 → 26 | nein | [screenshots/inventory-2026-10-25/real-0c87a1ce-389c-435a-87fa-12d163039c06.png](../screenshots/inventory-2026-10-25/real-0c87a1ce-389c-435a-87fa-12d163039c06.png) |
| 2271dc5c-ab3a-4467-befb-62a5618a32d9 | 1.5 | viewer | 6 → 6 | 6 → 6 | 20 → 20 | nein | [screenshots/inventory-2026-10-25/real-2271dc5c-ab3a-4467-befb-62a5618a32d9.png](../screenshots/inventory-2026-10-25/real-2271dc5c-ab3a-4467-befb-62a5618a32d9.png) |
| 25422333-feb1-47c4-bed0-b777c41b43b2 | 1.5 | viewer | 4 → 4 | 2 → 2 | 21 → 21 | nein | [screenshots/inventory-2026-10-25/real-25422333-feb1-47c4-bed0-b777c41b43b2.png](../screenshots/inventory-2026-10-25/real-25422333-feb1-47c4-bed0-b777c41b43b2.png) |
| 2bd34366-48df-4c20-a373-eaba96923df5 | 1.5 | viewer | 4 → 4 | 5 → 5 | 16 → 16 | nein | [screenshots/inventory-2026-10-25/real-2bd34366-48df-4c20-a373-eaba96923df5.png](../screenshots/inventory-2026-10-25/real-2bd34366-48df-4c20-a373-eaba96923df5.png) |
| 2cc420e9-0d2e-429d-904a-cea6cedf775b | 1.5 | viewer | 4 → 4 | 2 → 2 | 17 → 17 | nein | [screenshots/inventory-2026-10-25/real-2cc420e9-0d2e-429d-904a-cea6cedf775b.png](../screenshots/inventory-2026-10-25/real-2cc420e9-0d2e-429d-904a-cea6cedf775b.png) |
| 42b0a8bc-19e9-43a8-ba78-ab9baeb876fc | 1.5 | viewer | 6 → 6 | 6 → 6 | 20 → 20 | nein | [screenshots/inventory-2026-10-25/real-42b0a8bc-19e9-43a8-ba78-ab9baeb876fc.png](../screenshots/inventory-2026-10-25/real-42b0a8bc-19e9-43a8-ba78-ab9baeb876fc.png) |
| 46d55e00-2b01-4ba4-98a0-fc9e0f31d881 | 1.5 | viewer | 4 → 4 | 5 → 5 | 2 → 2 | nein | [screenshots/inventory-2026-10-25/real-46d55e00-2b01-4ba4-98a0-fc9e0f31d881.png](../screenshots/inventory-2026-10-25/real-46d55e00-2b01-4ba4-98a0-fc9e0f31d881.png) |
| 47430a5e-fb35-4184-b67b-ca66f082ae50 | 1.5 | viewer | 4 → 4 | 2 → 2 | 21 → 21 | nein | [screenshots/inventory-2026-10-25/real-47430a5e-fb35-4184-b67b-ca66f082ae50.png](../screenshots/inventory-2026-10-25/real-47430a5e-fb35-4184-b67b-ca66f082ae50.png) |
| 48a182a7-5510-470c-b3b0-a2abb0845ae2 | 1.5 | viewer | 4 → 4 | 2 → 2 | 21 → 21 | nein | [screenshots/inventory-2026-10-25/real-48a182a7-5510-470c-b3b0-a2abb0845ae2.png](../screenshots/inventory-2026-10-25/real-48a182a7-5510-470c-b3b0-a2abb0845ae2.png) |
| 4f1e05e4-2c9f-48e5-ae19-ee4ecb1e753c | 1.6 | viewer | 12 → 12 | 5 → 5 | 15 → 15 | nein | [screenshots/inventory-2026-10-25/real-4f1e05e4-2c9f-48e5-ae19-ee4ecb1e753c.png](../screenshots/inventory-2026-10-25/real-4f1e05e4-2c9f-48e5-ae19-ee4ecb1e753c.png) |
| 536235c3-131d-4279-92b0-007c9cea831b | 1.7 | viewer | 10 → 10 | 6 → 6 | 36 → 36 | nein | [screenshots/inventory-2026-10-25/real-536235c3-131d-4279-92b0-007c9cea831b.png](../screenshots/inventory-2026-10-25/real-536235c3-131d-4279-92b0-007c9cea831b.png) |
| 5522503a-2e4f-447f-af3b-7a4110bdcb4b | 1.5 | viewer | 11 → 11 | 4 → 4 | 16 → 16 | nein | [screenshots/inventory-2026-10-25/real-5522503a-2e4f-447f-af3b-7a4110bdcb4b.png](../screenshots/inventory-2026-10-25/real-5522503a-2e4f-447f-af3b-7a4110bdcb4b.png) |
| 63eb5c55-1708-43e2-a072-855147cf141b | 1.5 | viewer | 4 → 4 | 2 → 2 | 21 → 21 | nein | [screenshots/inventory-2026-10-25/real-63eb5c55-1708-43e2-a072-855147cf141b.png](../screenshots/inventory-2026-10-25/real-63eb5c55-1708-43e2-a072-855147cf141b.png) |
| 6a35d39a-6c85-48a3-8b2f-33131a430dd7 | 1.5 | viewer | 4 → 4 | 2 → 2 | 19 → 19 | nein | [screenshots/inventory-2026-10-25/real-6a35d39a-6c85-48a3-8b2f-33131a430dd7.png](../screenshots/inventory-2026-10-25/real-6a35d39a-6c85-48a3-8b2f-33131a430dd7.png) |
| 6a470762-c67b-4789-a880-f77cbf61a0d9 | 1.5 | viewer | 4 → 4 | 4 → 4 | 31 → 31 | nein | [screenshots/inventory-2026-10-25/real-6a470762-c67b-4789-a880-f77cbf61a0d9.png](../screenshots/inventory-2026-10-25/real-6a470762-c67b-4789-a880-f77cbf61a0d9.png) |
| 6c08c720-eab7-4e27-92ef-86465376d2b2 | 1.5 | viewer | 5 → 5 | 5 → 5 | 25 → 25 | nein | [screenshots/inventory-2026-10-25/real-6c08c720-eab7-4e27-92ef-86465376d2b2.png](../screenshots/inventory-2026-10-25/real-6c08c720-eab7-4e27-92ef-86465376d2b2.png) |
| 72ddf59e-0ce4-43d7-8a27-8ab71ca91c00 | 1.5 | viewer | 5 → 5 | 5 → 5 | 29 → 29 | nein | [screenshots/inventory-2026-10-25/real-72ddf59e-0ce4-43d7-8a27-8ab71ca91c00.png](../screenshots/inventory-2026-10-25/real-72ddf59e-0ce4-43d7-8a27-8ab71ca91c00.png) |
| 7a93e5c5-b3d4-442e-bc74-d6d91b6f3661 | 1.6 | viewer | 6 → 6 | 5 → 5 | 19 → 19 | nein | [screenshots/inventory-2026-10-25/real-7a93e5c5-b3d4-442e-bc74-d6d91b6f3661.png](../screenshots/inventory-2026-10-25/real-7a93e5c5-b3d4-442e-bc74-d6d91b6f3661.png) |
| 82a4d3a3-053e-47d6-9494-49c76509ea60 | 1.6 | viewer | 6 → 6 | 5 → 5 | 29 → 29 | nein | [screenshots/inventory-2026-10-25/real-82a4d3a3-053e-47d6-9494-49c76509ea60.png](../screenshots/inventory-2026-10-25/real-82a4d3a3-053e-47d6-9494-49c76509ea60.png) |
| 82f5c15e-c473-4f53-9f50-d8a9d66a3020 | 1.5 | viewer | 4 → 4 | 4 → 4 | 16 → 16 | nein | [screenshots/inventory-2026-10-25/real-82f5c15e-c473-4f53-9f50-d8a9d66a3020.png](../screenshots/inventory-2026-10-25/real-82f5c15e-c473-4f53-9f50-d8a9d66a3020.png) |
| 9e9231ce-3798-4ddf-a164-48ce03ee2d8f | 1.5 | viewer | 6 → 6 | 5 → 5 | 17 → 17 | nein | [screenshots/inventory-2026-10-25/real-9e9231ce-3798-4ddf-a164-48ce03ee2d8f.png](../screenshots/inventory-2026-10-25/real-9e9231ce-3798-4ddf-a164-48ce03ee2d8f.png) |
| a847416a-6f1c-478f-817c-371896023124 | 1.6 | viewer | 8 → 8 | 5 → 5 | 38 → 38 | nein | [screenshots/inventory-2026-10-25/real-a847416a-6f1c-478f-817c-371896023124.png](../screenshots/inventory-2026-10-25/real-a847416a-6f1c-478f-817c-371896023124.png) |
| a8b999fc-9fbb-4576-bdcf-a3e86da715fc | NULL | unreadable | 0 → — | 0 → — | 0 → — | nein | [screenshots/inventory-2026-10-25/real-a8b999fc-9fbb-4576-bdcf-a3e86da715fc.png](../screenshots/inventory-2026-10-25/real-a8b999fc-9fbb-4576-bdcf-a3e86da715fc.png) |
| b0f513f3-77aa-4c63-a45c-daba46169782 | 1.5 | viewer | 4 → 4 | 2 → 2 | 12 → 12 | nein | [screenshots/inventory-2026-10-25/real-b0f513f3-77aa-4c63-a45c-daba46169782.png](../screenshots/inventory-2026-10-25/real-b0f513f3-77aa-4c63-a45c-daba46169782.png) |
| b16c24e6-8593-4137-9491-d409e26cde43 | 1.5 | viewer | 4 → 4 | 5 → 5 | 17 → 17 | nein | [screenshots/inventory-2026-10-25/real-b16c24e6-8593-4137-9491-d409e26cde43.png](../screenshots/inventory-2026-10-25/real-b16c24e6-8593-4137-9491-d409e26cde43.png) |
| d165c333-6125-4294-bd79-fb1c9c185568 | 1.7 | viewer | 5 → 5 | 5 → 5 | 19 → 19 | nein | [screenshots/inventory-2026-10-25/real-d165c333-6125-4294-bd79-fb1c9c185568.png](../screenshots/inventory-2026-10-25/real-d165c333-6125-4294-bd79-fb1c9c185568.png) |
| dc8930cc-914e-4dde-b48a-5292188dbdfc | 1.5 | viewer | 6 → 6 | 6 → 6 | 20 → 20 | nein | [screenshots/inventory-2026-10-25/real-dc8930cc-914e-4dde-b48a-5292188dbdfc.png](../screenshots/inventory-2026-10-25/real-dc8930cc-914e-4dde-b48a-5292188dbdfc.png) |
| df482f8e-65ea-4c33-91df-96cbe23e3582 | 1.5 | viewer | 4 → 4 | 2 → 2 | 3 → 3 | nein | [screenshots/inventory-2026-10-25/real-df482f8e-65ea-4c33-91df-96cbe23e3582.png](../screenshots/inventory-2026-10-25/real-df482f8e-65ea-4c33-91df-96cbe23e3582.png) |
| ec52cca4-5c6c-4f16-81bc-0841d910b1f1 | 1.5 | viewer | 7 → 7 | 5 → 5 | 17 → 17 | nein | [screenshots/inventory-2026-10-25/real-ec52cca4-5c6c-4f16-81bc-0841d910b1f1.png](../screenshots/inventory-2026-10-25/real-ec52cca4-5c6c-4f16-81bc-0841d910b1f1.png) |
| f1a6eac4-1608-41f1-ad5d-1f1d2b099a8f | 1.5 | viewer | 4 → 4 | 5 → 5 | 16 → 16 | nein | [screenshots/inventory-2026-10-25/real-f1a6eac4-1608-41f1-ad5d-1f1d2b099a8f.png](../screenshots/inventory-2026-10-25/real-f1a6eac4-1608-41f1-ad5d-1f1d2b099a8f.png) |
| fefcc5b4-1b6d-4b68-a161-ce4d377b7df8 | 1.5 | viewer | 10 → 10 | 5 → 5 | 36 → 36 | nein | [screenshots/inventory-2026-10-25/real-fefcc5b4-1b6d-4b68-a161-ce4d377b7df8.png](../screenshots/inventory-2026-10-25/real-fefcc5b4-1b6d-4b68-a161-ce4d377b7df8.png) |

## 5. Ein realer Standard-Messlauf

Aktuelle Evidenz (abgeschlossener Lauf):

```json
{
  "checkedAt": "2026-10-25T20:27:17.275Z",
  "projectId": "93e09fad-fef3-4e2b-af9f-adf4bd137831",
  "projectStatus": "model_ready",
  "quality": "standard",
  "currentRunId": null,
  "observedDurationMs": 1097171,
  "measurementSchemaVersion": "1.7",
  "projectErrors": null,
  "route": "photo",
  "runs": [
    {
      "id": "65ddcabe-ef99-4538-b797-11bb40963f25",
      "outcome": "model_ready",
      "schema_version": "1.7",
      "model": "kimi-k3",
      "route": "photo",
      "duration_ms": 1093462,
      "input_tokens": 30923,
      "output_tokens": 67575,
      "cost_usd": 1.106394,
      "retry_used": false,
      "repair_used": false,
      "warnings": [
        "total_width chains disagree by >8%: window-sum ~13200 mm vs vehicle-length-based ~8000 mm (vehicle chain weak: SUV stands in front of the facade plane and camera standoff distances are unknown); both kept per disagreement rule, width anchor confidence capped low.",
        "total_width has only one robust horizontal chain (window group sum); brick stretcher coursing not countable across the facade at photo distance.",
        "Ground line occluded on all front photos (fence, hedge, parked cars): eave/ridge heights assume the ground offset at the facade; height confidence capped medium-to-low per vertical anchor rule.",
        "Photos 4 and 5 are steep upward wide-angle shots: verticals compressed, height chains from these photos capped low.",
        "Clinker brick format ambiguous (DF 62.5 mm vs Reichsformat ~78 mm course); 75 mm assumed at medium reliability for all coursing chains.",
        "Back ground floor partially occluded by party guests and vegetation in photo 6: back door D-4 is inferred from the external stair, openings on back GF may be undercounted.",
        "Front-left corner of the facade is hidden by a tree in photos 1/3: a fourth downspout may exist there.",
        "Shed dormer (AT-4) and left upper window (W-12) covered with renovation sheeting; dimensions estimated from the sheeted outlines.",
        "Annex roof surfaces not visible: covering assumed membrane with estimated pitch per ATTACHMENT ROOF RULE.",
        "Right annex (AT-8) seen in one oblique photo only; its orientation along the right wall and the placement of D-6 are uncertain.",
        "Roof pitch estimated from oblique views only (~33 deg); no roof plan or frontal slope view available.",
        "total_width: 2 outlier estimate(s) more than 10% from median removed in consolidation",
        "geometry checks skipped: complex roof (4 ridge edge(s), 6 valley edge(s)), single-pitch gable/hip formulas not applicable"
      ],
      "errors": [],
      "created_at": "2026-10-25T20:27:13.416Z"
    }
  ],
  "modelMetrics": {
    "preparation": "viewer",
    "walls": 8,
    "roofs": 6,
    "openings": 32
  },
  "terminal": true,
  "method": "Created/uploaded/started through actual authenticated UI; SELECT-only monitoring. Model metrics are source execution, not a WebGL screenshot."
}
```

Quelle: [scripts/inventory/real-result.json](../scripts/inventory/real-result.json). `duration_ms` ist die Pipeline-Dauer, nicht die komplette Zeit seit dem Upload. `cost_usd` ist die App-Kostenschätzung, kein verifizierter Anbieter-Rechnungsbetrag; die Klassifizierungskosten sind darin nicht separat ausgewiesen.

**Kurzbefund:** model_ready, 1.7, kimi-k3, Route photo; 18 min 13,462 s Pipeline-Dauer, 30.923 Input-/67.575 Output-Tokens, **geschätzt 1,106394 USD** für die Extraktion. Die Kostenannahme „costs cents“ aus dem Auftrag ist damit für diesen Lauf nicht bestätigt. Keine Retry-/Repair-Runde, 13 Qualitätswarnungen. Die Warnungen sind oben vollständig und unverändert wiedergegeben; Erfolg bedeutet nicht, dass die unsicheren Maße sachlich korrekt sind.

**Tatsächlicher Komponenten-Render:** [screenshots/inventory-2026-10-25/real-desktop.png](../screenshots/inventory-2026-10-25/real-desktop.png) und [screenshots/inventory-2026-10-25/real-phone.png](../screenshots/inventory-2026-10-25/real-phone.png); SwiftShader lieferte WebGL-Dreiecke, acht Wände, sechs Dachflächen und 32 Öffnungen. Quelle: [scripts/inventory/real-project-viewer-results.json](../scripts/inventory/real-project-viewer-results.json). Der aktuelle Builder erzeugt damit sichtbar ein Modell; dessen räumliche Richtigkeit ist nicht durch diese Zählung belegt.

### Real Leipzig run — terminal/UI follow-up

#### Terminal result

The terminal result below was supplied by the requester from the SELECT monitor; it was not independently re-read from the database or displayed by the UI in this pass:

- Project: `93e09fad-fef3-4e2b-af9f-adf4bd137831`
- Run: `752926e6-4e0c-43e8-80fa-75ab3a240ecf`
- Status: `model_ready`, schema 1.7
- Model/route: Kimi K3 / photo
- Duration: 1,093,462 ms
- Tokens: 30,923 input / 67,575 output
- Estimated cost: USD 1.106394
- Retry/repair: none
- Warnings: 13

#### Viewer UI follow-up limitation

- The previous authenticated browser wait exceeded the notebook's 45-second script limit; the notebook worker then reset and discarded the page, cookies, and in-memory test-session state.
- I created a fresh browser context and navigated to the own-user project route. It redirected to `/login` (`25cj4k`), confirming the authenticated session was not preserved in the fresh context.
- No credentials were available in the reset session. I did not create another user, guess credentials, use an auth/owner bypass, restart the workflow, or modify project/run data.
- Because the required own-user session was lost, I could not open the real Leipzig viewer or capture its terminal UI, desktop/390px screenshots, warnings, or console/hydration messages. There is no real-viewer console error prefix to report from this pass.
- No screenshot bytes were exported; only the login-page observation ID is available. No screenshot file was written.

The run was already terminal according to the requester, so no additional polling or measurement action was performed.


Die im Browser-Handoff genannte UUID `752926e6-4e0c-43e8-80fa-75ab3a240ecf` bezeichnet den temporären Start-/`current_run_id`-Guard. Der persistierte `measure_runs.id` des abgeschlossenen Laufs ist `65ddcabe-ef99-4538-b797-11bb40963f25`; die beiden IDs sind nicht zu verwechseln.

Ein Standard-Lauf ist autorisiert; eine Premium-Wiederholung erfordert vorherige ausdrückliche Freigabe. Der kleine Kimi-Verbindungstest aus Abschnitt 1 ist kein Haus-Messlauf. Modellgenerierter Code wird bei dieser Bestandsaufnahme nicht ausgeführt.

## 6. Variante-A-Bereitschaft und aktuelle Opus-Fakten

### Paket und Testhäuser

**Nachtrag nach dem ZIP-Upload:** Das zunächst fehlende Originalpaket ist jetzt als verschachtelte ZIP im übergebenen Archiv vorhanden. Der ursprüngliche Befund im unveränderten [scripts/inventory/environment.log](../scripts/inventory/environment.log) dokumentiert den Zustand **vor** diesem Upload. Das aktive Produkt enthält weiterhin weder `variante-a-paket/` noch das aktive Schema 1.8: die Prüfung entpackt ausschließlich vorübergehend nach `/tmp`, verändert keine Produktionsdatei und entfernt den Probeordner danach. Es wurde kein Testhaus ersetzt oder nachgebessert.

**Herkunft:** [attached_assets/0_Übergabe-20261025T193857Z-1-001_1792977826688.zip](../attached_assets/0_Übergabe-20261025T193857Z-1-001_1792977826688.zip) (283870 Bytes), SHA-256 `c29d0092f20d63ebc6b298129846eaf40ebec276dd38e02afa12ad4d44054109`. Darin: `Übergabe/snaptape-variante-a-replit-paket.zip` (157529 Bytes), SHA-256 `56080c75a2465c3f0ef03f544472c9acaec05eb4cd44a60e101bccf80bd465f4`.

**Vollständigkeit:** 19 reguläre Dateien, 876884 unkomprimierte Bytes; fehlende Pflichtdateien **0**, unerwartete Testhaus-Verzeichnisse **0**. Geprüft wurden Schema, Core, fünf Promptdateien, Referenzbeschreibung, `erwartet.json` und je Messung/Build-Funktion für fünf Häuser. Core-Version `A-2026-10-08`.

**Reproduktion:** `node scripts/inventory/variante-a.mjs <hochgeladene ZIP>`. Der Hilfsextraktor prüft Archivpfade und Größen und verweigert Symlinks. Nur die ausdrücklich autorisierten **mitgelieferten Referenzfunktionen** werden durch den Original-Core mit plain Node ausgeführt; kein Code aus dem kostenpflichtigen Messlauf. Das Original-`runBuild` verwendet intern `new Function` (Core:197–206); dies ist der erlaubte Fixture-Test, **kein Sandbox- oder Sicherheitsnachweis**.

**Ergebnis:** **5/5** Vergleiche vollständig identisch mit `erwartet.json`; **5/5** Ajv-2020-Validierungen bestanden. Ajv **8.20.0**, Dialekt `https://json-schema.org/draft/2020-12/schema`, `allErrors:true, strict:false`; keine Fehler ausgeblendet oder Messwerte verändert. `strict:false` betrifft Ajv-Schema-Striktheitsdiagnosen, nicht die Prüfung der Datenbedingungen. Temporäre Dateien gelöscht: **true**.

Die Tabellenzellen zeigen jeweils **erwartet → tatsächlich**. `Stopp` ist die Zahl der `fail`-Prüfzeilen aus `pruefen().zahlen.fehler`; Flächen/Öffnungen/Kanten zählen die gleichnamigen Ergebnisarrays des Original-Cores.

| Haus | Stufe | IDs fehlen | Stopp | Flächen | Öffnungen | Kanten | Warnungen | Vergleich | Schema 1.8 |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| farmhouse-140040rk | merken → merken | 0 → 0 | 0 → 0 | 47 → 47 | 12 → 12 | 41 → 41 | 4 | PASS | PASS |
| farmhouse-test5-beispiel | merken → merken | 0 → 0 | 0 → 0 | 33 → 33 | 17 → 17 | 33 → 33 | 4 | PASS | PASS |
| leipzig-villa | merken → merken | 0 → 0 | 0 → 0 | 51 → 51 | 29 → 29 | 54 → 54 | 28 | PASS | PASS |
| triplex-40014db | merken → merken | 0 → 0 | 0 → 0 | 41 → 41 | 21 → 21 | 56 → 56 | 16 | PASS | PASS |
| tudor-93233el | merken → merken | 0 → 0 | 0 → 0 | 49 → 49 | 29 → 29 | 66 → 66 | 10 | PASS | PASS |

Alle fünf `merken`-Ergebnisse sind **erwartete Warnzustände**, nicht „alles ohne Warnung“. Das bestätigt die Paketkonsistenz, nicht die sachliche Maßgenauigkeit anhand von Fotos, eine produktionsreife Sandbox oder die Integration in die bestehende App. Ein vollständiger Abgleich aller R1–R4-Anweisungen gegen den Code wurde nicht zusätzlich beauftragt und wird nicht behauptet.

Rohbelege: [scripts/inventory/variante-a-results.json](../scripts/inventory/variante-a-results.json), [scripts/inventory/variante-a.log](../scripts/inventory/variante-a.log), [scripts/inventory/variante-a-manifest.json](../scripts/inventory/variante-a-manifest.json); Skripte [scripts/inventory/variante-a.mjs](../scripts/inventory/variante-a.mjs) und [scripts/inventory/variante-a-extract.py](../scripts/inventory/variante-a-extract.py).

#### Dateiliste mit Größen und SHA-256

Pfad relativ zum enthaltenen Verzeichnis `variante-a-paket/`:

| Datei | Bytes | SHA-256 |
|---|---:|---|
| REPLIT-PROMPTS-VARIANTE-A.md | 20502 | 25b87f1328fcf9b4a9ef93c87b0f11c4186608b465812b8b387bcd4a125db459 |
| artifacts/aufmass-app/lib/modell3d/core.js | 31774 | fa762fb3942ff78fe166a341a0b1d81ff9a47ba7c57ee7ad57c33f28b041239c |
| docs/pipeline/buildhouse-correction-prompt.md | 977 | 2d934fbf55c61a7f9d1eeeac0908eeb5ed16ec7dfc549d0a12549cd6671c4187 |
| docs/pipeline/buildhouse-prompt.md | 13426 | 24ebc4c65e247e515c34901e52942e24c953b20efd72bb2afc334dccbdb28ebb |
| docs/pipeline/extract-mixed-prompt.md | 34277 | e811247abed0bc14b55ff09a5f382480e777aa0b77cc78e4c3d0fbdfa7addff9 |
| docs/pipeline/extract-photo-prompt.md | 31660 | 93ab21d67df6050abf9f80ad2befa7e3aec45c0da301ae8e2c76e535046d8142 |
| docs/pipeline/extract-plan-prompt.md | 28809 | 11862c95a7ae8ca58587cb267bc3ebdaf2627ec3036927ed65aa4c4a491cfba7 |
| shared/schema/measurement-v1.8.json | 42621 | a9340dbc15c02296fa8b93fb8b2751f3a9dbbaf98b780ce3a904ba55f6e294d1 |
| test-fixtures/variante-a/erwartet.json | 675 | c4975f1e8a89f829688a1067be003e03640e42fa4551ed1977636b5fd8933a57 |
| test-fixtures/variante-a/farmhouse-140040rk/buildhouse.js | 15973 | 94b2869f6c1c50e59b3b6b6bd4f1303df3be927007dc7b3d2f0c07abbce2f7eb |
| test-fixtures/variante-a/farmhouse-140040rk/messung.json | 97939 | 805081fe6af8e9af945f3c376ab1ffc2c7e36c8764187a9db269835c9649223d |
| test-fixtures/variante-a/farmhouse-test5-beispiel/buildhouse.js | 11787 | 840b9d3a3a9823e77dfb13ac3fbefdd1392f5063cdeab19cf0cb3856c3e3cc51 |
| test-fixtures/variante-a/farmhouse-test5-beispiel/messung.json | 82574 | 52c6bd28fe9fc95d116ac43e04f39c2fd1406e82b8a3985fc86bf2a64c46654e |
| test-fixtures/variante-a/leipzig-villa/buildhouse.js | 26266 | ce70f83cd5c50fa411b5fcffe65c909c442109d09d9af04d66c1445a0399f905 |
| test-fixtures/variante-a/leipzig-villa/messung.json | 116708 | 69b5d53b31285a4f69bcd6cedcff279d28c1d4e3eadc1e42a64493afba667ba8 |
| test-fixtures/variante-a/triplex-40014db/buildhouse.js | 15528 | 72e3d2a0c5d73a1ae2a3af98730adac1e9793cb4256a3de0eb306ec4b4ae6873 |
| test-fixtures/variante-a/triplex-40014db/messung.json | 103787 | 38169f9a542ed12ff6fcc9d63859a58b6cef4edb7ae731afbbf637063bb70317 |
| test-fixtures/variante-a/tudor-93233el/buildhouse.js | 17217 | fd9c5a44d015e642bf49fe76fc3ba0cad6ff3f7c7942d8c90c760cc56c798684 |
| test-fixtures/variante-a/tudor-93233el/messung.json | 184384 | 7e57688f8bc2431a9450f1d0e372a64c57c14f9edc25953d089359bc0813668e |


### isolated-vm unter dem aktuellen Node

Isoliertes temporäres **pnpm**-Workspace statt Installation in die App-Abhängigkeiten (bewusste Abweichung vom beispielhaften npm-Kommando). Node **v24.22.1**, ABI **137**; `isolated-vm` **7.0.1** wurde in 1.632 s installiert und geladen; Test-Isolate mit 128 MB lieferte `1+1 = 2`, Exit 0. Kein ABI-Fehler. Scratch-Verzeichnis danach gelöscht: **true**. Das ist ein Nachweis für **7.0.1**, nicht für das im Vorspann genannte 6.2.0 und nicht für die Sicherheit einer vollständigen künftigen Sandbox. Speichergrenzen, Timeout, Callback-Freigaben und fremder Build-Code wurden nicht getestet.

Quellen: [scripts/inventory/native-probe.json](../scripts/inventory/native-probe.json), [scripts/inventory/native-install.log](../scripts/inventory/native-install.log), [scripts/inventory/native-probe.mjs](../scripts/inventory/native-probe.mjs).

### Offizielle Anthropic-Dokumentation, geprüft am 25.10.2026

| Frage | Offiziell dokumentiertes Ergebnis |
|---|---|
| Claude-API-ID | `claude-opus-5-5`; zusätzlich für diesen Schlüssel durch Models-Liste belegt |
| Effort | `output_config.effort`; `low`, `medium`, `high`, `xhigh`, `max`; Opus 5.5 Default `medium` |
| Thinking | Adaptiv immer aktiv. `thinking` weglassen oder `{"type":"adaptive"}`; `disabled` und manuelles `enabled/budget_tokens` werden abgewiesen |
| Temperature | Nicht mitsenden. Sampling-Parameter werden für Claude 4.7+ nicht unterstützt; ab API-Version 2026-10-21 ist jeder explizite Wert nicht zulässig. Nicht auf ein Modellupgrade durch Austausch nur der ID vertrauen |
| Standardpreis ohne Cache/Batch | Input **4 USD / 1 Mio. Tokens**, Output **20 USD / 1 Mio. Tokens** |

Offizielle URLs und lokale Dokumentationssnapshots:

1. https://platform.claude.com/docs/en/models/opus-5-5/overview — [scripts/inventory/anthropic-doc-1.md](../scripts/inventory/anthropic-doc-1.md)
2. https://platform.claude.com/docs/en/build-with-claude/effort — [scripts/inventory/anthropic-doc-2.md](../scripts/inventory/anthropic-doc-2.md)
3. https://platform.claude.com/docs/en/about-claude/pricing — [scripts/inventory/anthropic-doc-3.md](../scripts/inventory/anthropic-doc-3.md)
4. https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 — [scripts/inventory/anthropic-doc-4.md](../scripts/inventory/anthropic-doc-4.md)
5. https://platform.claude.com/docs/en/build-with-claude/working-with-messages.md — [scripts/inventory/anthropic-doc-5.md](../scripts/inventory/anthropic-doc-5.md)

Nur Dokumentations- und Models-Listenaufrufe: **kein Opus-Messages-Aufruf**. In der bestehenden App bleiben `standard=kimi-k3` und `premium=claude-fable-5` unverändert (`lib/messung/modelle.ts:26–40`). Aktuelle App-Schätzpreise dürfen nicht als neue Opus-Preise ausgegeben werden.

## 7. Lücken zur ersten lauffähigen Version, Defekte und Prüfgrenzen

### Anforderungsmatrix

| Anforderung | Status | Evidenz | Was fehlt | Blocker für Mindestversion |
|---|---|---|---|---|
| Öffentliche Landing Page | missing | app/page.tsx leitet nach /login oder /app; UI-Prüfung Abschnitt 4 | Öffentliche Inhalte, erlaubte Aussagen und CTA-Ziele | yes |
| Registrierung + Login | done | Implementierung lib/auth/actions.ts; erfolgreiche Registrierung, Logout, Login und lesbare Passwort-/Duplikatfehler, Abschnitt 4 | E-Mail-Bestätigung/Reset ausdrücklich nicht MVP-Umfang; keine vollständige Auth-Sicherheitsprüfung beauftragt | no |
| Upload + Klassifizierung + Schritt-1-Messung | done | lib/upload/actions.ts, lib/messung/pipeline.ts, Abschnitte 4–5 | Echte Messung technisch abgeschlossen; räumliche Qualität bleibt eigene Viewer-Anforderung | no |
| 3D mit aktuellem buildModel | partial | 31 reale Messungen renderbar; 1 unlesbar; Diagnose 23.09. | Korrekte räumliche Geometrie statt Giebelschablone | yes |
| 3D Variante A | missing | Originalpaket nach Upload geprüft: 5/5 Referenzvergleiche und 5/5 Schema-Validierungen PASS; aktives Modell3d-Modul und Schema 1.8 weiterhin nicht integriert | R1 → R2 → R3 einschließlich Sandbox/Adapter; Referenztest ist keine Implementierung | yes |
| Deployment | missing | getDeploymentInfo und Produktions-DB-Probe | Veröffentlichung, Produktions-DB, Produktionskonfiguration und Domain für öffentlichen Betrieb | yes |
| Secrets / Guthaben | partial | Alle erforderlichen Variablen SET; Providerproben und echter Standardlauf erfolgreich, Abschnitte 1 und 5 | Vollständiger Kontostand bzw. Reserve nicht nachgewiesen; kein insufficient-balance-Fehler in geprüften Requests | no |

### Priorisierte Defekte und vorgeschlagene nächste Änderungen – **nicht umgesetzt**

| Schwere | Befund und Beleg | Einzeiliger Korrekturvorschlag | Aufwand |
|---|---|---|---|
| Hoch | MODEL BUILDER: reale Geometrie bleibt inkorrekt trotz erhaltener IDs, Diagnose 23.09. und aktuelle Aufnahmen | Den entschiedenen Variante-A-Pfad mit gesichertem Vertrag, Sandbox, Prüfung und Viewer-Adapter implementieren; keine Häuser einzeln zurechtbiegen | L |
| Hoch | model_ready ohne lesbare Messung, UUID a8b999fc-9fbb-4576-bdcf-a3e86da715fc, Abschnitt 4 | Zustandsinvariante beim Schreiben/Lesen absichern und Bestandsfall separat entscheiden, keine stille Inventur-Migration | M |
| Mittel | EXTRAKTOR_STUB umgeht nicht die kostenpflichtige Klassifizierung, Abschnitt 4 | Eigenen expliziten Klassifizierungs-Testmodus bzw. durchgehende kostenfreie Testumgebung ergänzen | M |
| Mittel | `drizzle-kit check` scheitert trotz fehlender Live-Spaltendrift, Abschnitt 2 | Einen zum aktuellen CLI kompatiblen nicht-mutierenden Check definieren; nicht durch push ersetzen | S |
| Mittel | Übergabe behauptet pauschalen 1.5-Altversionshinweis, aktueller Code akzeptiert 1.5, Abschnitt 4 | Gewollte Kompatibilitätsregel entscheiden und Dokumentation/Tests daran ausrichten | S |
| Mittel | Mobile WebGL-Fallback-Ansicht bei 390 px hat 8 px horizontalen Überlauf und abgeschnittenen Meldungstext, Browserbefund Abschnitt 4 | Fallback-Text und äußeres Layout ohne horizontale Überbreite umbrechen lassen und auf echtem Gerätebrowser nachprüfen | S |
| Niedrig / Ursache offen | React-Hydration-Warnung im authentifizierten Viewer-Testbrowser, Abschnitt 4 | Reproduktionsschritte und genaue Server-/Client-Differenz isolieren, nicht ohne Beleg dem Builder zuschreiben | S–M |
| Prüflücke | Eigentümergeschützte Bestandsrouten nicht als jeweiliger Eigentümer angemeldet | Mit autorisierten Testkonten/Sitzungen gezielt vollständige Seiten testen; keine Authentifizierungsumgehung | M |
| Prüflücke / Testumgebung | Vollständiger abschließender Real-Viewer-Routencheck verlor die neue Testsession durch Notebook-Reset, Abschnitt 5 | Sitzung regulär wiederherstellen und bestehendes Ergebnis öffnen; keine weitere Messung und kein Session-/Eigentums-Bypass | S |

Weitere konkrete UI-/Messfehler werden in Abschnitt 4/5 mit Originalmeldungen geführt; die Liste ist kein Auftrag zu deren Umsetzung. Landing Page und fehlendes Deployment sind fehlende Produktteile, keine fehlgeschlagenen Tests.

### Abgrenzung und Integrität

- Keine Produktdatei, kein Prompt, kein Schema und keine bestehende Messung absichtlich verändert; keine Migration, kein `push`, keine Projektlöschung, kein Publishing.
- Die explizit angeforderten UI-Tests erzeugen neue Testkonten, Projekte, Dateien und Sessions im Entwicklungsbestand; neue Testmessungen sind erwartete Ergebnisse. Der Datenbestand ist daher **nicht insgesamt unverändert**, obwohl bestehende Messungen unverändert bleiben sollen.
- Neue Inventurdateien nur unter `docs/inventory-2026-10-25.md`, `scripts/inventory/`, `screenshots/inventory-2026-10-25/`; Install-/Buildausgaben in vorhandenen ignorierten Verzeichnissen und der ausdrücklich verlangte temporäre native Probeordner.
- Prüflücken werden als nicht geprüft bzw. blockiert benannt. Insbesondere werden fehlende Paketdateien, ungetestete Eigentümerrouten oder ausstehende Messläufe nicht als bestanden gewertet.

Abschließender Integritätsnachweis: **32** ursprüngliche model_ready-Messungswerte per kanonischem SHA-256-Vergleich erneut geprüft; Abweichungen **0**. Git-sichtbare Agent-Ausgaben außerhalb erlaubter Pfade: **0**. Die nachgereichte Benutzer-ZIP ist in `userSuppliedInputPaths` separat als Eingabe erfasst und nicht als Agent-Ausgabe gezählt. Quelle: [scripts/inventory/integrity.json](../scripts/inventory/integrity.json).

### Abgleich mit DONE WHEN des Auftrags

| Punkt | Ergebnis |
|---|---|
| Bericht mit Abschnitten 1–7 und Belegen | Erfasst; nicht ausgeführte Teilprüfungen ausdrücklich benannt |
| Umgebung, Variablen, Modellliste, Guthabenstatus, Deployment | Erfasst, kein insufficient-balance-Fehler in den ausgeführten Requests; Reserve nicht garantiert |
| Typecheck / Tests / Build einschließlich aller Fehler | PASS / 290 PASS / PASS; Drizzle-CLI-Fehler wortgetreu in Abschnitt 2 |
| Screenshot-Archiv | **Teilweise**: lokale Register-/Login-, Stub-Desktop/390-, alle 32 Bestands- und neue Real-Komponentenaufnahmen vorhanden. Authentifizierte Upload-/Admin-/Fallback-Aufnahmen nur als Browser-Beobachtungs-IDs, nicht als exportierte Bilddateien verfügbar |
| Echter Standardlauf mit Dauer, Tokens, Kosten, Version und Ergebnis | **Abgeschlossen**, technische Renderbarkeit per echter Komponente mit Software-WebGL belegt; abschließende authentifizierte Route nach Sessionverlust nicht geprüft |
| Variante A: fünf Häuser und fünf Schema-1.8-Validierungen | **Abgeschlossen: 5/5 Vergleiche und 5/5 Validierungen PASS; Herkunft, Größen und SHA-256 dokumentiert**, keine Produktintegration vorgenommen |
| Native isolated-vm-Probe | PASS für Version 7.0.1 unter Node 24.22.1, Installation/Laden/1+1; keine Behauptung für 6.2.0 oder vollständige Sandbox-Sicherheit |
| Opus 5.5-Fakten mit Quellen und Datum | Erfasst, kein kostenpflichtiger Opus-Aufruf |
| Lückenmatrix, priorisierte Defekte, erlaubte Dateipfade | Erfasst; keine Produktkorrekturen umgesetzt |
