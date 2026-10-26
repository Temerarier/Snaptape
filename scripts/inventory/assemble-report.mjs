import { readFile, writeFile } from "node:fs/promises";
const dir="scripts/inventory/";
const text=async(p,fallback="Noch nicht geprüft / Ergebnis steht aus.")=>{try{return await readFile(dir+p,"utf8")}catch{return fallback}};
const json=async(p,fallback=null)=>{try{return JSON.parse(await text(p))}catch{return fallback}};
const esc=x=>String(x??"—").replaceAll("|","\\|").replaceAll("\n"," ");
const row=a=>`| ${a.map(esc).join(" | ")} |\n`;
const link=p=>`[${p}](../${p})`;
const subordinate=s=>s.replace(/^#/gm,"###");
const baselineResponse=await json("db-baseline.json");
const csv=baselineResponse.output.slice(baselineResponse.output.indexOf("\n")+1).trim();
const baseline=JSON.parse(csv.slice(1,-1).replaceAll('""','"'));
const providers=await json("providers.json");
const commands=await json("commands.json",[]);
const drift=await json("db-drift.json");
const native=await json("native-probe.json");
const viewers=(await json("viewer-results.json",{cases:[]})).cases;
const stub=await json("stub-result.json");
const real=await json("real-result.json");
const integrity=await json("integrity.json");
const stubViews=await json("stub-project-viewer-results.json");
const realViews=await json("real-project-viewer-results.json");
const deployed=await json("deployment.json");
const variante=await json("variante-a-results.json");
const varianteManifest=await json("variante-a-manifest.json");
let report=`# SnapTape – Bestandsaufnahme vom 25.10.2026

**Auftrag:** ${link("attached_assets/Pasted-SnapTape-Bestandsaufnahme-und-Replit-Analyse-Prompt-Sta_1792958077561.txt")}, Abschnitt 5.
**Referenzstand:** unveränderter Produktstand \`66878401d4f09207bd81fda7cbe605d8542c1a88\`.
**Zweck:** Entscheidungsvorlage für Landing Page, Registrierung/Login, Upload/KI-Messung und 3D-Viewer. Kein Umbau, keine Migration, kein Publishing.
**Pfadangaben:** Kürzel wie \`app/...\`, \`components/...\`, \`lib/upload/...\`, \`lib/messung/...\`, \`lib/viewer-next/...\` und \`i18n/...\` sind relativ zu \`artifacts/aufmass-app/\`. Workspace-Bibliotheken wie \`lib/db/\` und \`lib/measurement/\` sowie \`docs/\`, \`shared/\`, \`scripts/\` liegen am Repo-Root.

## 1. Umgebung, Secrets und Veröffentlichung

### Laufzeit und Werkzeuge

\`\`\`text
${await text("environment.log")}
\`\`\`

Quelle: ${link(dir+"environment.log")}. Der App-Preview läuft unter \`/\`; \`/api/*\` gehört dem separaten Express-Artefakt. Nach Start der vorhandenen Workflows lieferte \`GET /api/healthz\` \`{"status":"ok"}\`. Quellen: \`artifacts/aufmass-app/.replit-artifact/artifact.toml:1–28\`, \`artifacts/api-server/src/routes/health.ts:6\`. Frühere Meldung „Your app is not running“ war durch nicht gestartete Workflows erklärbar, nicht durch einen reproduzierten Compilefehler. Ein Grund für das damalige Stoppen ist nicht belegt.

### Secrets: nur Existenz, niemals Werte

Erhebung mit \`viewEnvVars(type=secret, environment=development)\` und Präsenzprüfung im laufenden Probeprozess, ${link(dir+"secret-status.json")} / ${link(dir+"providers.json")}. SET bedeutet **nicht**, dass jeder Zugang oder jedes Guthaben damit bereits bewiesen ist.

| Variable | Status | Einordnung |
|---|---|---|
`;
for(const [k,v] of Object.entries(providers.env))report+=row([k,v,["EXTRAKTOR_STUB","EXTRAKTOR_STUB_KAPUTT"].includes(k)?"Optionaler Testschalter; fehlend ist im Normalbetrieb korrekt":k==="REPLIT_DEPLOYMENT"?"Im Entwicklungsprozess erwartungsgemäß nicht gesetzt":"Im Entwicklungsprozess vorhanden"]);
report+=`
- **Datenbank:** \`SELECT 1\` erfolgreich, ${link(dir+"db-baseline.json")}; 14 deklarierte Tabellen und 142 Live-Spalten im gesonderten SELECT-only-Abgleich.
- **Object Storage:** privates Präfix erfolgreich gelistet, Stichprobe ${providers.storage.sampledObjects??"—"} Objekte; keine Objektnamen protokolliert. Ergebnis: \`${providers.storage.result}\`. Das belegt List-Zugriff, nicht allein einen vollständigen Browser-Upload.
- **Anthropic:** \`GET /v1/models?limit=100\`, HTTP ${providers.anthropic.httpStatus}. Geforderte IDs:

| Modell-ID | Für diesen Schlüssel gelistet |
|---|---|
`;
for(const [id,status] of Object.entries(providers.anthropic.requested))report+=row([id,status]);
report+=`
Eine Modellliste ist kein kostenpflichtiger Messages-Aufruf und beweist **kein verfügbares Guthaben**. Kein Opus-5.5-Aufruf wurde gesendet. \`ANTHROPIC_ADMIN_KEY\` ist gesetzt; ein vollständiger Kostenabgleich ist nicht Umfang dieser Bestandsaufnahme.

- **Moonshot:** minimaler gestreamter Chat mit \`model=kimi-k3, max_tokens=5, temperature=1\`, HTTP ${providers.moonshot.httpStatus}; Nutzung ${providers.moonshot.usage?.prompt_tokens??"—"} Input- / ${providers.moonshot.usage?.completion_tokens??"—"} Output-Tokens, davon ${providers.moonshot.usage?.completion_tokens_details?.reasoning_tokens??"—"} Reasoning-Tokens; Abschluss \`${providers.moonshot.finishReasons?.join(",")??"—"}\`. Kein „insufficient balance“-Fehler in dieser Probe. Ein so kleiner Ausgabegrenzwert kann durch Reasoning verbraucht werden; Erfolg heißt nicht, dass eine vollständige Hausmessung bereits geprüft ist. ${providers.moonshot.error?`Fehler: ${providers.moonshot.error}`:""}
- **Guthaben:** erfolgreicher Kimi-Ping belegt Bezahlbarkeit dieses Requests, keine garantierte Reserve für einen langen Lauf. Anthropic-Guthaben ist durch den Listenaufruf allein nicht feststellbar. Ergebnisse des realen Laufs stehen in Abschnitt 5.

Der spätere echte Start bestand auch die kostenpflichtige Klassifizierung vor der Kimi-Extraktion (\`lib/klassifizierung/service.ts:15,160–180\`, Browserübergang „Checking your files“ → „Measuring“). In den ausgeführten Providerprüfungen und diesem Lauf wurde **kein insufficient-balance-Fehler** gemeldet. Weder ein belastbarer aktueller Kontostand noch eine dauerhafte Guthabenreserve sind damit zugesichert.

### Deployment

\`getDeploymentInfo()\`: success=${deployed.success}, isDeployed=${deployed.isDeployed}, primaryUrl leer, additionalUrls=[].
Kein aktives Deployment und keine aktive Produktionsadresse. Produktions-DB-Probe \`SELECT 1\` wurde mit **„This project has no production database.“** abgewiesen. \`.replit:1–13\` nennt zwar \`autoscale\`, aber eine vorbereitete Einstellung ist keine Veröffentlichung. Es wurde nichts veröffentlicht oder konfiguriert. Unveröffentlichte Domainentwürfe sind durch diese Metadaten nicht belegt.
Quellen: ${link(dir+"deployment.json")}, ${link(dir+"production-db.json")}.

## 2. Installation, Typecheck, Tests, Build und Schemaabgleich

| Prüfung | Exit | Dauer | Ergebnis / Rohprotokoll |
|---|---:|---:|---|
`;
for(const c of commands)report+=row([c.command,c.code,`${(c.durationMs/1000).toFixed(2)} s`,`${c.code===0?"PASS":"FAIL"} – ${link(c.path)}`]);
report+=`
**Unit-Tests:** 30/30 Testdateien und 290/290 Tests bestanden. **Typecheck:** Exit 0 für gemeinsame Bibliotheken, API-Server, Next-App, Mockup-Sandbox und Skriptpaket. **Next-Produktions-Build:** erfolgreich. Keine fehlgeschlagenen Unit-Tests oder Typfehler zu transkribieren. Vollständige Ausgaben liegen in den verlinkten Logs.

### Fehlgeschlagene Kommandos: erste 30 Zeilen wortgetreu

`;
for(const c of commands.filter(c=>c.code!==0))report+=`**${c.command}**\n\n\`\`\`text\n${(await text(c.slug+".log")).split("\n").slice(0,30).join("\n")}\n\`\`\`\n\n`;
report+=`
\`drizzle-kit check\` ist **kein erfolgreicher Live-Schemaabgleich**: der Befehl scheitert mit einer Treiber-/Parameterfehlermeldung. Das ist nicht gleichbedeutend mit fehlenden Tabellen. Deshalb erfolgte ein unabhängiger Abgleich über \`information_schema.columns\` und \`pg_enum\` mit den tatsächlichen Drizzle-Tabellenmetadaten, innerhalb \`BEGIN READ ONLY\`, ohne \`push\` oder Workspace-Introspektionsdateien.

Ergebnis: **${drift.expectedTables.length} deklarierte Tabellen, ${drift.actualColumns.length} Live-Spalten, ${drift.differences.length} Unterschiede** bei Tabellen/Spalten, nativen Typen, Nullable-Regeln und Enum-Werten/-Reihenfolge. Fehlende Tabellen/Spalten: **keine**. Grenzen: semantische Gleichheit aller Defaults, Indizes, CHECK- und FK-Ausdrücke wird damit nicht zugesichert.
Quelle: ${link(dir+"database.ts")}, ${link(dir+"db-drift.json")}.

## 3. Entwicklungsdatenbank: Ausgangsbestand

SELECT-only-Snapshot **vor den neuen Inventur-Testdaten**. Keine E-Mail-Adressen, Passwort-Hashes oder Sessionwerte abgefragt bzw. ausgegeben. Quelle: ${link(dir+"db-baseline.json")}.

| Tabelle | Zeilen |
|---|---:|
`;
for(const [k,v] of Object.entries(baseline.counts))report+=row([k,v]);
report+="\n### Projekte nach Status\n\n| Status | Anzahl |\n|---|---:|\n";
for(const s of baseline.project_statuses)report+=row([s.status,s.n]);
report+="\n### Messläufe nach Ausgang und Modell\n\n| Ausgang | Modell | Anzahl |\n|---|---|---:|\n";
for(const r of baseline.run_status_models)report+=row([r.outcome,r.model??"NULL / nicht protokolliert",r.n]);
report+="\n### Versionen gespeicherter Messungen\n\n| meta.schema_version | Anzahl |\n|---|---:|\n";
for(const v of baseline.measurement_versions)report+=row([v.version,v.n]);
report+=`
32 Projekte haben Status \`model_ready\`, aber nur 31 davon enthalten eine gespeicherte Messung; die Differenz ist kein Versionszählfehler. Die einzelnen UUIDs und Versionen stehen zusammen mit ihrem Viewer-Ergebnis in Abschnitt 4. Die 15 Projekte mit Status \`processing\` beweisen keine aktuell laufenden Worker; ein automatisches Recovery/Timeout-Verhalten wurde nicht nachgerüstet oder allein aus dem Status behauptet.

## 4. Feature-Durchgang und Viewer

### Login, Registrierung, Upload und Admin

${subordinate(await text("ui-findings.md"))}

Zusätzlich als lokale Dateien gesichert: ${link("screenshots/inventory-2026-10-25/register.jpg")} und ${link("screenshots/inventory-2026-10-25/login.jpg")}. Der Standard-Screenshotbrowser kann dort keinen WebGL-Kontext für die dekorative 3D-Ansicht erstellen und zeigt den Hintergrund-Fallback; die Login-/Registerformulare bleiben sichtbar. Diese Umgebungsfehler werden nicht als genereller Ausfall der App oder der separat mit SwiftShader geprüften 3D-Komponenten gewertet.

Präzise Prüflücke zu Abschnitt 4e des Auftrags: \`/status\` wurde anonym erfolgreich geprüft, nicht nochmals gesondert in der temporären Staff-Sitzung. Die beiden Admin-Seiten wurden mit und ohne Staff-Berechtigung geprüft.

### Kostenloser Stub-Lauf: bewusst getrennte Prüfschritte

Wichtige Einschränkung des gelieferten Testauftrags: \`EXTRAKTOR_STUB=1\` wird nur in \`lib/messung/extraktor.ts:78–87\` geprüft; \`lib/upload/actions.ts:522–539\` ruft vorher unverändert \`klassifiziereDateien\` auf. \`lib/klassifizierung/service.ts:15,160–180\` nutzt dafür Claude Sonnet. Ein Klick auf „Messung starten“ ist damit **nicht automatisch kostenlos**.

${stub?`Der neue, über die UI hochgeladene Braamheide-Test wurde anschließend mit der **echten Pipeline**, aber Prozessschalter \`EXTRAKTOR_STUB=1\` und explizit synthetischen Klassifizierungsmetadaten ausgeführt. Status **${stub.status}**, ${stub.files} Dateien, ${stub.pdfPages} PDF-Seiten, Schema **${stub.schemaVersion}**, Dauer ${(stub.durationMs/1000).toFixed(2)} s. Das ist ein Test von Upload → Verarbeitung und separat Pipeline → Stub → Viewer, kein Beweis eines vollständig kostenlosen produktiven Start-Buttons. Quelle: ${link(dir+"stub-result.json")}.`:"Stub-Pipeline noch nicht ausgeführt; kein Erfolg behauptet."}

${subordinate(await text("ui-viewer-findings.md","Viewer-Screenshots des neuen UI-Testprojekts stehen noch aus."))}

${stubViews?`**Zusätzlicher lokaler Software-WebGL-Nachweis:** tatsächliche ProjectViewer-Komponente des neuen Stub-Projekts, ${link("screenshots/inventory-2026-10-25/stub-desktop.png")} und ${link("screenshots/inventory-2026-10-25/stub-phone.png")}. Je sechs Wände und sechs Dachflächen sowie 20 Öffnungen modelliert. Quelle: ${link(dir+"stub-project-viewer-results.json")}. Diese isolierten Komponentenbilder ergänzen die authentifizierten Browser-Beobachtungen; sie ersetzen weder deren vollständiges App-Layout noch widerlegen sie den dort beobachteten mobilen Fallback-Overflow.`:""}

### Alle 32 zuvor vorhandenen model_ready-Projekte

**Zugriffsmethode:** SELECT-only-Messungssnapshots → tatsächliche \`ProjectViewer\`-, \`ViewerNextClient\`-, Vorbereitungs- und Builder-Komponenten → unveränderte Materialien und kompiliertes Produktions-CSS → isolierter Loopback-Browser mit SwiftShader-WebGL bei 1280×900. Systemschrift statt Next-Fontloader; geerbtes App-Layout und jeweilige Benutzer-Sprache nicht mitgeprüft. Die Route selbst prüft Eigentum (\`app/app/projekt/[id]/viewer/page.tsx:23–43\`); es wurden keine fremden Sitzungen eingefügt und keine Authentifizierungsprüfung umgangen. Diese Bilder sind daher **Komponentenaufnahmen realer Messungen, keine angemeldeten Eigentümer-Routen-Screenshots**.

Ergebnis: **${viewers.filter(c=>c.render?.triangles>0).length}/32** mit tatsächlichen WebGL-Dreiecken, **${viewers.filter(c=>c.preparation==="unreadable").length}/32** mit lesbarer „Measurement could not be read“-Meldung. Keine ungefangenen Browserausnahmen, keine protokollierten Browser-Console-Errors in diesem abgeschlossenen Durchgang. Ein verworfener erster Harness-Versuch hatte den LocaleProvider vergessen; dies war ein Probeaufbaufehler, keine App-Regression. Der korrigierte Harness verwendet den tatsächlichen LocaleProvider.

**Wichtige Abweichung vom Übergabetext:** \`projectMeasurement.ts:464–475\` akzeptiert Schema **1.5** ausdrücklich strukturell. Alle 24 entsprechenden Bestandsprojekte werden aktuell zum Viewer vorbereitet, nicht pauschal mit „ältere Version“ abgewiesen; der Builder hält dazu eine interne Kompatibilitätsnotiz. Die behauptete pauschale 1.5-Sperre stimmt nicht mit dem aktuellen Code überein. Es wurde kein Datensatz migriert.

„Modelliert“ zählt erhaltene Builder-Elemente, nicht aus einem Kamerawinkel sichtbare Flächen oder geometrische Richtigkeit. Überlagerung und falsche Positionierung sind damit nicht ausgeschlossen. Die bekannte Ursache bleibt durch ${link("docs/viewer-diagnose-2026-09-23.md")} belegt.

Quelle und vollständige Diagnostik: ${link(dir+"viewer-results.json")}; reproduzierbar über \`node scripts/inventory/viewer-harness.mjs\` nach dem Build.

| Projekt-ID | Schema | Zustand | Wände vorhanden → modelliert | Dachflächen vorhanden → modelliert | Öffnungen vorhanden → modelliert | ältere-Version-Hinweis | Aufnahme |
|---|---|---|---|---|---|---|---|
`;
for(const c of viewers)report+=row([c.id,c.version??"NULL",c.preparation,c.input?`${c.input.walls} → ${c.modeled?.walls??"—"}`:"—",c.input?`${c.input.roofs} → ${c.modeled?.roofs??"—"}`:"—",c.input?`${c.input.openings} → ${c.modeled?.openings??"—"}`:"—",c.olderNotice?"ja":"nein",c.screenshot?link(c.screenshot):c.error]);
report+=`
## 5. Ein realer Standard-Messlauf

${real?`Aktuelle Evidenz${real.terminal?" (abgeschlossener Lauf)":" (**noch laufend; kein bestandenes Endergebnis**)"}:\n\n\`\`\`json\n${JSON.stringify(real,null,2)}\n\`\`\`\n\nQuelle: ${link(dir+"real-result.json")}. \`duration_ms\` ist die Pipeline-Dauer, nicht die komplette Zeit seit dem Upload. \`cost_usd\` ist die App-Kostenschätzung, kein verifizierter Anbieter-Rechnungsbetrag; die Klassifizierungskosten sind darin nicht separat ausgewiesen.`:"Der autorisierte neue Leipzig-Foto-Lauf wurde noch nicht gestartet. Keine Premium-Wiederholung freigegeben; es wird kein erfolgreicher Lauf behauptet."}

${real?.terminal?`**Kurzbefund:** ${real.projectStatus}, ${real.measurementSchemaVersion}, ${real.runs[0]?.model}, Route ${real.runs[0]?.route}; 18 min 13,462 s Pipeline-Dauer, 30.923 Input-/67.575 Output-Tokens, **geschätzt 1,106394 USD** für die Extraktion. Die Kostenannahme „costs cents“ aus dem Auftrag ist damit für diesen Lauf nicht bestätigt. Keine Retry-/Repair-Runde, 13 Qualitätswarnungen. Die Warnungen sind oben vollständig und unverändert wiedergegeben; Erfolg bedeutet nicht, dass die unsicheren Maße sachlich korrekt sind.`:""}

${realViews?`**Tatsächlicher Komponenten-Render:** ${link("screenshots/inventory-2026-10-25/real-desktop.png")} und ${link("screenshots/inventory-2026-10-25/real-phone.png")}; SwiftShader lieferte WebGL-Dreiecke, acht Wände, sechs Dachflächen und 32 Öffnungen. Quelle: ${link(dir+"real-project-viewer-results.json")}. Der aktuelle Builder erzeugt damit sichtbar ein Modell; dessen räumliche Richtigkeit ist nicht durch diese Zählung belegt.`:""}

${subordinate(await text("real-ui-findings.md","Der abschließende authentifizierte Real-Viewer-Routencheck ist noch nicht abgeschlossen."))}

Die im Browser-Handoff genannte UUID \`752926e6-4e0c-43e8-80fa-75ab3a240ecf\` bezeichnet den temporären Start-/\`current_run_id\`-Guard. Der persistierte \`measure_runs.id\` des abgeschlossenen Laufs ist \`65ddcabe-ef99-4538-b797-11bb40963f25\`; die beiden IDs sind nicht zu verwechseln.

Ein Standard-Lauf ist autorisiert; eine Premium-Wiederholung erfordert vorherige ausdrückliche Freigabe. Der kleine Kimi-Verbindungstest aus Abschnitt 1 ist kein Haus-Messlauf. Modellgenerierter Code wird bei dieser Bestandsaufnahme nicht ausgeführt.

## 6. Variante-A-Bereitschaft und aktuelle Opus-Fakten

### Paket und Testhäuser

${variante && varianteManifest?`**Nachtrag nach dem ZIP-Upload:** Das zunächst fehlende Originalpaket ist jetzt als verschachtelte ZIP im übergebenen Archiv vorhanden. Der ursprüngliche Befund im unveränderten ${link(dir+"environment.log")} dokumentiert den Zustand **vor** diesem Upload. Das aktive Produkt enthält weiterhin weder \`variante-a-paket/\` noch das aktive Schema 1.8: die Prüfung entpackt ausschließlich vorübergehend nach \`/tmp\`, verändert keine Produktionsdatei und entfernt den Probeordner danach. Es wurde kein Testhaus ersetzt oder nachgebessert.

**Herkunft:** ${link(varianteManifest.sourceArchive)} (${varianteManifest.sourceArchiveBytes} Bytes), SHA-256 \`${varianteManifest.sourceArchiveSha256}\`. Darin: \`${varianteManifest.nestedMember}\` (${varianteManifest.nestedArchiveBytes} Bytes), SHA-256 \`${varianteManifest.nestedArchiveSha256}\`.

**Vollständigkeit:** ${varianteManifest.fileCount} reguläre Dateien, ${varianteManifest.uncompressedFileBytes} unkomprimierte Bytes; fehlende Pflichtdateien **${variante.requiredFilesMissing.length}**, unerwartete Testhaus-Verzeichnisse **${variante.unexpectedHouses.length}**. Geprüft wurden Schema, Core, fünf Promptdateien, Referenzbeschreibung, \`erwartet.json\` und je Messung/Build-Funktion für fünf Häuser. Core-Version \`${variante.coreVersion}\`.

**Reproduktion:** \`node scripts/inventory/variante-a.mjs <hochgeladene ZIP>\`. Der Hilfsextraktor prüft Archivpfade und Größen und verweigert Symlinks. Nur die ausdrücklich autorisierten **mitgelieferten Referenzfunktionen** werden durch den Original-Core mit plain Node ausgeführt; kein Code aus dem kostenpflichtigen Messlauf. Das Original-\`runBuild\` verwendet intern \`new Function\` (Core:197–206); dies ist der erlaubte Fixture-Test, **kein Sandbox- oder Sicherheitsnachweis**.

**Ergebnis:** **${variante.comparisonPassed}/5** Vergleiche vollständig identisch mit \`erwartet.json\`; **${variante.schemaPassed}/5** Ajv-2020-Validierungen bestanden. Ajv **${variante.ajvVersion}**, Dialekt \`${variante.schemaDialect}\`, \`allErrors:true, strict:false\`; keine Fehler ausgeblendet oder Messwerte verändert. \`strict:false\` betrifft Ajv-Schema-Striktheitsdiagnosen, nicht die Prüfung der Datenbedingungen. Temporäre Dateien gelöscht: **${variante.cleaned}**.

Die Tabellenzellen zeigen jeweils **erwartet → tatsächlich**. \`Stopp\` ist die Zahl der \`fail\`-Prüfzeilen aus \`pruefen().zahlen.fehler\`; Flächen/Öffnungen/Kanten zählen die gleichnamigen Ergebnisarrays des Original-Cores.

| Haus | Stufe | IDs fehlen | Stopp | Flächen | Öffnungen | Kanten | Warnungen | Vergleich | Schema 1.8 |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
${variante.cases.map(c=>row([c.house,...["stufe","ids_fehlen","stopp","flaechen","oeffnungen","kanten"].map(k=>`${c.expected[k]} → ${c.actual[k]}`),c.checkNumbers.warnungen,c.comparisonPass?"PASS":"FAIL",c.schemaValid?"PASS":"FAIL"])).join("")}
Alle fünf \`merken\`-Ergebnisse sind **erwartete Warnzustände**, nicht „alles ohne Warnung“. Das bestätigt die Paketkonsistenz, nicht die sachliche Maßgenauigkeit anhand von Fotos, eine produktionsreife Sandbox oder die Integration in die bestehende App. Ein vollständiger Abgleich aller R1–R4-Anweisungen gegen den Code wurde nicht zusätzlich beauftragt und wird nicht behauptet.

Rohbelege: ${link(dir+"variante-a-results.json")}, ${link(dir+"variante-a.log")}, ${link(dir+"variante-a-manifest.json")}; Skripte ${link(dir+"variante-a.mjs")} und ${link(dir+"variante-a-extract.py")}.

#### Dateiliste mit Größen und SHA-256

Pfad relativ zum enthaltenen Verzeichnis \`variante-a-paket/\`:

| Datei | Bytes | SHA-256 |
|---|---:|---|
${varianteManifest.files.map(f=>row([f.path.slice("variante-a-paket/".length),f.bytes,f.sha256])).join("")}`:`\`variante-a-paket/\` und das aktive Schema 1.8 fehlen; Originalpaket noch nicht erfolgreich geprüft. Keine Referenztests als bestanden gewertet. Quellen: ${link(dir+"environment.log")}.`}

### isolated-vm unter dem aktuellen Node

Isoliertes temporäres **pnpm**-Workspace statt Installation in die App-Abhängigkeiten (bewusste Abweichung vom beispielhaften npm-Kommando). Node **${native.node}**, ABI **${native.abi}**; \`isolated-vm\` **7.0.1** wurde in ${(native.elapsedMs/1000).toFixed(3)} s installiert und geladen; Test-Isolate mit 128 MB lieferte \`1+1 = 2\`, Exit ${native.execution?.code??"—"}. Kein ABI-Fehler. Scratch-Verzeichnis danach gelöscht: **${native.cleaned}**. Das ist ein Nachweis für **7.0.1**, nicht für das im Vorspann genannte 6.2.0 und nicht für die Sicherheit einer vollständigen künftigen Sandbox. Speichergrenzen, Timeout, Callback-Freigaben und fremder Build-Code wurden nicht getestet.

Quellen: ${link(dir+"native-probe.json")}, ${link(dir+"native-install.log")}, ${link(dir+"native-probe.mjs")}.

### Offizielle Anthropic-Dokumentation, geprüft am 25.10.2026

| Frage | Offiziell dokumentiertes Ergebnis |
|---|---|
| Claude-API-ID | \`claude-opus-5-5\`; zusätzlich für diesen Schlüssel durch Models-Liste belegt |
| Effort | \`output_config.effort\`; \`low\`, \`medium\`, \`high\`, \`xhigh\`, \`max\`; Opus 5.5 Default \`medium\` |
| Thinking | Adaptiv immer aktiv. \`thinking\` weglassen oder \`{"type":"adaptive"}\`; \`disabled\` und manuelles \`enabled/budget_tokens\` werden abgewiesen |
| Temperature | Nicht mitsenden. Sampling-Parameter werden für Claude 4.7+ nicht unterstützt; ab API-Version 2026-10-21 ist jeder explizite Wert nicht zulässig. Nicht auf ein Modellupgrade durch Austausch nur der ID vertrauen |
| Standardpreis ohne Cache/Batch | Input **4 USD / 1 Mio. Tokens**, Output **20 USD / 1 Mio. Tokens** |

Offizielle URLs und lokale Dokumentationssnapshots:

1. https://platform.claude.com/docs/en/models/opus-5-5/overview — ${link(dir+"anthropic-doc-1.md")}
2. https://platform.claude.com/docs/en/build-with-claude/effort — ${link(dir+"anthropic-doc-2.md")}
3. https://platform.claude.com/docs/en/about-claude/pricing — ${link(dir+"anthropic-doc-3.md")}
4. https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 — ${link(dir+"anthropic-doc-4.md")}
5. https://platform.claude.com/docs/en/build-with-claude/working-with-messages.md — ${link(dir+"anthropic-doc-5.md")}

Nur Dokumentations- und Models-Listenaufrufe: **kein Opus-Messages-Aufruf**. In der bestehenden App bleiben \`standard=kimi-k3\` und \`premium=claude-fable-5\` unverändert (\`lib/messung/modelle.ts:26–40\`). Aktuelle App-Schätzpreise dürfen nicht als neue Opus-Preise ausgegeben werden.

## 7. Lücken zur ersten lauffähigen Version, Defekte und Prüfgrenzen

### Anforderungsmatrix

| Anforderung | Status | Evidenz | Was fehlt | Blocker für Mindestversion |
|---|---|---|---|---|
| Öffentliche Landing Page | missing | app/page.tsx leitet nach /login oder /app; UI-Prüfung Abschnitt 4 | Öffentliche Inhalte, erlaubte Aussagen und CTA-Ziele | yes |
| Registrierung + Login | done | Implementierung lib/auth/actions.ts; erfolgreiche Registrierung, Logout, Login und lesbare Passwort-/Duplikatfehler, Abschnitt 4 | E-Mail-Bestätigung/Reset ausdrücklich nicht MVP-Umfang; keine vollständige Auth-Sicherheitsprüfung beauftragt | no |
| Upload + Klassifizierung + Schritt-1-Messung | ${real?.projectStatus==="model_ready"?"done":"partial"} | lib/upload/actions.ts, lib/messung/pipeline.ts, Abschnitte 4–5 | ${real?.projectStatus==="model_ready"?"Echte Messung technisch abgeschlossen; räumliche Qualität bleibt eigene Viewer-Anforderung":"Realer End-to-End-Ausgang noch nicht erfolgreich belegt"} | ${real?.projectStatus==="model_ready"?"no":"yes bis Abschnitt 5 geklärt"} |
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
| Mittel | \`drizzle-kit check\` scheitert trotz fehlender Live-Spaltendrift, Abschnitt 2 | Einen zum aktuellen CLI kompatiblen nicht-mutierenden Check definieren; nicht durch push ersetzen | S |
| Mittel | Übergabe behauptet pauschalen 1.5-Altversionshinweis, aktueller Code akzeptiert 1.5, Abschnitt 4 | Gewollte Kompatibilitätsregel entscheiden und Dokumentation/Tests daran ausrichten | S |
| Mittel | Mobile WebGL-Fallback-Ansicht bei 390 px hat 8 px horizontalen Überlauf und abgeschnittenen Meldungstext, Browserbefund Abschnitt 4 | Fallback-Text und äußeres Layout ohne horizontale Überbreite umbrechen lassen und auf echtem Gerätebrowser nachprüfen | S |
| Niedrig / Ursache offen | React-Hydration-Warnung im authentifizierten Viewer-Testbrowser, Abschnitt 4 | Reproduktionsschritte und genaue Server-/Client-Differenz isolieren, nicht ohne Beleg dem Builder zuschreiben | S–M |
| Prüflücke | Eigentümergeschützte Bestandsrouten nicht als jeweiliger Eigentümer angemeldet | Mit autorisierten Testkonten/Sitzungen gezielt vollständige Seiten testen; keine Authentifizierungsumgehung | M |
| Prüflücke / Testumgebung | Vollständiger abschließender Real-Viewer-Routencheck verlor die neue Testsession durch Notebook-Reset, Abschnitt 5 | Sitzung regulär wiederherstellen und bestehendes Ergebnis öffnen; keine weitere Messung und kein Session-/Eigentums-Bypass | S |

Weitere konkrete UI-/Messfehler werden in Abschnitt 4/5 mit Originalmeldungen geführt; die Liste ist kein Auftrag zu deren Umsetzung. Landing Page und fehlendes Deployment sind fehlende Produktteile, keine fehlgeschlagenen Tests.

### Abgrenzung und Integrität

- Keine Produktdatei, kein Prompt, kein Schema und keine bestehende Messung absichtlich verändert; keine Migration, kein \`push\`, keine Projektlöschung, kein Publishing.
- Die explizit angeforderten UI-Tests erzeugen neue Testkonten, Projekte, Dateien und Sessions im Entwicklungsbestand; neue Testmessungen sind erwartete Ergebnisse. Der Datenbestand ist daher **nicht insgesamt unverändert**, obwohl bestehende Messungen unverändert bleiben sollen.
- Neue Inventurdateien nur unter \`docs/inventory-2026-10-25.md\`, \`scripts/inventory/\`, \`screenshots/inventory-2026-10-25/\`; Install-/Buildausgaben in vorhandenen ignorierten Verzeichnissen und der ausdrücklich verlangte temporäre native Probeordner.
- Prüflücken werden als nicht geprüft bzw. blockiert benannt. Insbesondere werden fehlende Paketdateien, ungetestete Eigentümerrouten oder ausstehende Messläufe nicht als bestanden gewertet.

${integrity?`Abschließender Integritätsnachweis: **${integrity.existingReadyProjectsChecked}** ursprüngliche model_ready-Messungswerte per kanonischem SHA-256-Vergleich erneut geprüft; Abweichungen **${integrity.existingMeasurementDifferences.length}**. Git-sichtbare Agent-Ausgaben außerhalb erlaubter Pfade: **${integrity.outsideAllowedPaths.length}**. Die nachgereichte Benutzer-ZIP ist in \`userSuppliedInputPaths\` separat als Eingabe erfasst und nicht als Agent-Ausgabe gezählt. Quelle: ${link(dir+"integrity.json")}.`:"Abschließender Integritätsvergleich steht noch aus."}

### Abgleich mit DONE WHEN des Auftrags

| Punkt | Ergebnis |
|---|---|
| Bericht mit Abschnitten 1–7 und Belegen | Erfasst; nicht ausgeführte Teilprüfungen ausdrücklich benannt |
| Umgebung, Variablen, Modellliste, Guthabenstatus, Deployment | Erfasst, kein insufficient-balance-Fehler in den ausgeführten Requests; Reserve nicht garantiert |
| Typecheck / Tests / Build einschließlich aller Fehler | PASS / 290 PASS / PASS; Drizzle-CLI-Fehler wortgetreu in Abschnitt 2 |
| Screenshot-Archiv | **Teilweise**: lokale Register-/Login-, Stub-Desktop/390-, alle 32 Bestands- und neue Real-Komponentenaufnahmen vorhanden. Authentifizierte Upload-/Admin-/Fallback-Aufnahmen nur als Browser-Beobachtungs-IDs, nicht als exportierte Bilddateien verfügbar |
| Echter Standardlauf mit Dauer, Tokens, Kosten, Version und Ergebnis | **Abgeschlossen**, technische Renderbarkeit per echter Komponente mit Software-WebGL belegt; abschließende authentifizierte Route nach Sessionverlust nicht geprüft |
| Variante A: fünf Häuser und fünf Schema-1.8-Validierungen | **${variante?.allPass?"Abgeschlossen: 5/5 Vergleiche und 5/5 Validierungen PASS; Herkunft, Größen und SHA-256 dokumentiert":"Noch nicht erfolgreich abgeschlossen"}**, keine Produktintegration vorgenommen |
| Native isolated-vm-Probe | PASS für Version 7.0.1 unter Node 24.22.1, Installation/Laden/1+1; keine Behauptung für 6.2.0 oder vollständige Sandbox-Sicherheit |
| Opus 5.5-Fakten mit Quellen und Datum | Erfasst, kein kostenpflichtiger Opus-Aufruf |
| Lückenmatrix, priorisierte Defekte, erlaubte Dateipfade | Erfasst; keine Produktkorrekturen umgesetzt |
`;
await writeFile("docs/inventory-2026-10-25.md",report);
console.log(`Wrote inventory report, ${report.length} characters, ${viewers.length} existing projects.`);
