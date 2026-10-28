# Schritt 2: buildHouse-Erzeugung und isolierte Prüfung

## Implementiert

- `isolated-vm 7.0.1`, Node 24, separate V8-Isolate mit 128 MB und 8 s
  Ausführungslimit. Ein zusätzlicher Kindprozess enthält native Abbrüche und
  erhält keine Anwendungs-Credentials. Es gibt keinen `node:vm`-/Host-eval-
  Fallback. JSON-Ausgaben werden vor den Host-Prüfungen strukturell und auf
  Umfang geprüft.
- Core und beide buildhouse-Prompts unverändert kopiert. Host-Core-Zugriff nur
  für `measurementToMess` und `pruefen`; generierter Code läuft ausschließlich
  innerhalb der Isolate.
- Schritt-2-Modell über `SCHRITT2_MODELL` (Standard: `MESS_MODELL`) und
  `SCHRITT2_EFFORT` (Standard: `medium`). Gemeinsamer SDK-Client, keine
  `temperature`-/manuellen `thinking`-Parameter, unveränderte 4/20-USD-Schätzung.
- Größter geeigneter JS-Fence oder Funktions-Fallback; bei STOP genau eine
  Korrektur mit denselben Bildern und ausgefüllten Prompt-Platzhaltern.
- Additive Entwicklungsschema-Änderung angewendet: drei optionale Projektfelder
  plus `model_runs`, eine Zeile pro Aufruf/Versuch mit Usage, Schätzung,
  Zeitwerten und privatem Code.
- Messung wird vor Schritt 2 committed. Der zusätzliche Job besitzt einen
  privaten Messlauf-Fence und prüft ihn vor einem Korrekturaufruf erneut.
  Fehler ändern nur die 3D-Felder, nie Messung, Projektstatus oder Credits.
- Viewer-Renderer und Panel-Berechnung unverändert. Nur äußerer Statushinweis mit
  Polling; der neue Geometrie-Datensatz wird in diesem Auftrag **nicht** an den
  bestehenden Renderer angeschlossen.
- Keine privaten Modellberichte/KI-Code in Kunden-DTOs. Die Projektkarten-Abfrage
  wurde auf ihre öffentlichen Felder eingeschränkt, damit auch Entwicklungs-
  Flight-Debugdaten keine privaten Projektberichte als Props übernehmen.
- Finale private Projektberichte enthalten zusätzlich die gemessene
  Schritt-2-Gesamtdauer in `duration_ms` (inklusive Bildvorbereitung, Modellaufrufen
  und Sandbox; bis unmittelbar vor dem abschließenden Projekt-Update).

## Fixtures: echte Sandbox, keine API-Aufrufe

| Haus | Stufe | Fehlende IDs | Flächen | Öffnungen | Kanten |
|---|---|---:|---:|---:|---:|
| farmhouse-140040rk | merken | 0 | 47 | 12 | 41 |
| farmhouse-test5-beispiel | merken | 0 | 33 | 17 | 33 |
| leipzig-villa | merken | 0 | 51 | 29 | 54 |
| triplex-40014db | merken | 0 | 41 | 21 | 56 |
| tudor-93233el | merken | 0 | 49 | 29 | 66 |

Alle fünf entsprechen `test-fixtures/variante-a/erwartet.json`.

| Probe | Ergebnis | Testprozess |
|---|---|---|
| `throw new Error('x')` | stopp | bleibt aktiv |
| Endlosschleife | stopp; Zeitlimit von 8 s überschritten | bleibt aktiv |
| `require('fs')` | stopp; kein require | bleibt aktiv |
| `fetch(...)` | stopp; kein fetch | bleibt aktiv |
| `process.exit(...)` | stopp; kein process | bleibt aktiv |
| Speicherüberlauf | stopp; Speicherlimit überschritten | bleibt aktiv |
| Übermäßige JSON-Ausgabe | stopp; Ausgabelimit | bleibt aktiv |

Core-SHA-256:
`fa762fb3942ff78fe166a341a0b1d81ff9a47ba7c57ee7ad57c33f28b041239c`

## Datenbank-/Credit-Verifikation

`scripts/verify-step2.ts` verwendet simulierte Modellantworten, aber echtes
PostgreSQL, den echten Core und die echte Sandbox:

| Fall | 3D-Status | Modellzeilen | Stufe | Korrektur | Credits |
|---|---|---:|---|---|---|
| regulär | ready | 1 | merken | nein | genau eine Messungsabbuchung −1 |
| erste Ausgabe STOP | ready | 2 | merken | ja | genau eine Messungsabbuchung −1 |
| Modell-/Verbindungsfehler | unavailable | 1 | stopp | nein | genau eine Messungsabbuchung −1 |

In allen Fällen: Messung JSON-gleich, Projekt `model_ready`, keine Rückerstattung,
kein zweiter Credit-Eintrag, veralteter Job ohne Aufruf/Schreibzugriff ignoriert.
Unbekannte Usage/Kosten bleiben null. Synthetische Daten danach entfernt.
Details: `step2-offline-db-verification.json`.

## Browserprüfung

Eine neue synthetische Clerk-Testidentität, ausschließlich eigene Testdaten:

- Messpanel gleichzeitig mit `pending` sichtbar.
- Wechsel nach `unavailable`; alle **140 numerischen Panelzeilen identisch**.
- Gespeicherte Messung weiterhin JSONB-gleich.
- Private Report-/Code-Marker weder im Viewer/Projektlisten-Dokument noch in
  **32 erfassten App-/Netzwerkantworten** enthalten.
- Eigene Testdaten nachher vollständig entfernt. Keine Mess-/Modellaufrufe.
- WebGL ließ sich im Testbrowser nicht initialisieren; der bekannte
  Gerätehinweis erschien. Das Messpanel war trotzdem vollständig verfügbar.
  Dies ist keine visuelle Abnahme neu generierter Geometrie.

## Build und reale Abnahme

- `pnpm test`: **40 Dateien / 384 Tests bestanden**.
- Typecheck und Produktionsbuild bestanden; Runtime-Dateien und native
  ABI137/glibc-Bindung sind in Nexts Produktionstraces enthalten.
- Offline- und Browserprüfungen oben verwenden **0 bezahlte Modellaufrufe**.

Der Nutzer hat eine separate Kopie ohne Altbuchungen für genau einen echten
Abnahmelauf gewählt. Der Lauf wurde am 28.10.2026 abgeschlossen:
`0782db46-7e84-4996-a149-e08f7c6a4baf`.
Sieben Dateizeilen und ihre Speicherobjekte wurden unabhängig kopiert; die
vorhandene Klassifizierung wurde übernommen. Originalprojekt und historische
Buchungen werden nicht geändert. Die Kopie sperrt einen versehentlichen zweiten
Start des Abnahmeskripts über ihre feste Projekt-ID.
Vollständige Diagnose: `step2-live-verification.json`.

### Ergebnis des einmaligen echten Laufs

**Schritt 1 fehlgeschlagen; Schritt 2 nicht erreicht. Die reale Gesamtabnahme
ist damit nicht bestanden.**

| Merkmal | Ergebnis |
|---|---|
| Modell / Effort | claude-opus-5-5 / medium |
| Dauer Schritt 1 | 701.950 ms (11 min 41,95 s) |
| Input-/Outputtokens | 44.384 / 64.000 |
| Stop-Grund | `max_tokens` |
| Antwortblöcke | ausschließlich `thinking`, kein `text` |
| Fehler | `Anthropic API returned no text content.` |
| Usage vollständig | ja |
| Aus Usage berechnete Kosten | 1,457536 USD bei 4/20 USD pro Million Input-/Outputtokens |
| Messungsabbuchungen / Rückerstattungen | genau 1 × −1 / 1 × +1 |
| Guthaben vorher / nachher | 2 / 2 |
| Originalprojekt inkl. Dateien, Messläufen und Buchungen | unverändert |
| Kopierte Dateien / eigenständige Speicherobjekte | 7 / 16 |
| Schritt-2-Aufrufe / Modellzeilen | 0 / 0 |
| Schritt-2-Stufe, Korrektur, Tokens, Kosten, Dauer | nicht anwendbar; Schritt 2 nicht gestartet |
| Measurement-Vergleich vorher/nachher Schritt 2 | nicht möglich; keine gültige Messung entstanden |

Die Ursache dieses Laufs ist nun belegt: Das gemeinsame Outputbudget war mit
64.000 Denktokens ausgeschöpft, bevor Antworttext ausgegeben wurde. Es gab keinen
Schemafehler und keinen Sandboxfehler, weil diese Stufen nicht erreicht wurden.
Das beweist nicht rückwirkend den Stop-Grund früherer Läufe ohne Metadaten.

Keine automatische Wiederholung, keine Änderung an Effort, Tokenlimit oder
Produktcode. Für einen nächsten Versuch ist ein geringerer Denkaufwand eine
gezielte mögliche Anpassung, aber noch kein nachgewiesener Fix. Mehr
Outputbudget erhöht potenziell Dauer und Kosten und garantiert ebenfalls keinen
Erfolg. Ein weiterer kostenpflichtiger Lauf benötigt erneute Freigabe.

Der zusätzliche Abnahmerunner wurde vor dem Start typgeprüft. Dabei wurden
veraltete generierte Bibliotheks-Typdefinitionen über `typecheck:libs` aktualisiert;
anschließend bestand der App-Typecheck. Während des echten Laufs gab es keine
Builds oder Workflow-Neustarts. Der temporäre Abnahme-Workflow wird entfernt,
die Kopie und die vollständigen Diagnose-/Buchungsdaten bleiben erhalten.

## Autorisierte Wiederholung mit größerem Tokenlimit

Der Nutzer hat eine Reduzierung auf `low` ausdrücklich abgelehnt und einen
weiteren echten Lauf mit erhöhtem Tokenlimit freigegeben. Das gemeinsame
Outputbudget für Denken und Antwort wurde von 64.000 auf **128.000** angehoben.
Modell, Effort `medium`, Prompts und fachliche Verarbeitung bleiben unverändert.
Quelle für die unterstützte Obergrenze:
https://platform.claude.com/docs/en/models/opus-5-5/overview
(abgerufen am 28.10.2026).

Vor diesem Lauf bestanden erneut alle **384 Tests** und der Produktionsbuild
einschließlich Typprüfung. Der Web-Workflow wurde vor dem Start neu gestartet
und lief sauber an; während der Messung keine Builds oder Neustarts.

Eine weitere unabhängige Kopie mit eigener einmaliger Start-Sperre wird
verwendet: `8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a`.
Frühere Testkopien, Original und sämtliche historischen Buchungen bleiben
erhalten. Neue Evidenz, ohne Überschreiben des 64k-Nachweises:
`step2-live-128k-verification.json`.
### Ergebnis: reale Gesamtkette erfolgreich

| Merkmal | Messung (Schritt 1) | 3D-Modell (Schritt 2) |
|---|---|---|
| Modell | claude-opus-5-5 | claude-opus-5-5 |
| Effort | medium | medium |
| Outputlimit | 128.000 | 128.000 |
| Ergebnis | model_ready, Schema 1.8 | ready, Prüfstufe merken |
| Eingabetokens | 44.384 | 55.251 |
| Ausgabetokens | 91.285 | 49.919 |
| Aus Usage berechnete Kosten | 2,003236 USD | 1,219384 USD |
| Gesamtdauer der Stufe | 871.530 ms (14 min 31,53 s) | 471.753 ms (7 min 51,75 s) |
| Zusätzlicher Versuch / Korrektur | kein Retry, kein Repair | keine Korrektur |

Gesamtkosten dieses Wiederholungslaufs: **3,222620 USD** nach dem
4/20-USD-pro-Million-Tarif, keine Anbieterrechnung. Gesamtlaufzeit mit Kopieren
und Abschlussprüfung etwa **22 min 26 s**. Die Messungsantwort endete regulär
mit `end_turn` und enthielt `thinking` und `text`. Die 91.285 Ausgabetokens
überschreiten das alte 64k-Limit; die Budgeterhöhung hat diesen Lauf ermöglicht.
Dies garantiert keinen Erfolg für jede zukünftige Eingabe.

- Genau eine neue Messungsabbuchung −1, keine Erstattung, keine Buchung aus
  Schritt 2. Guthaben vorher 2, nachher 1.
- Messung nach Schritt 2 identisch mit dem vor Schritt 2 gespeicherten
  Messlauf-JSON. SHA-256:
  `76d064acdd7570f71875f28eac8b500998eb8b499dfce2e8864a3a184dd23fc2`.
- Originalprojekt mit Dateien, Messläufen und Buchungen unverändert.
- Ein echter Modellaufruf, eine `model_runs`-Zeile mit Usage und Kosten.
  Sandboxdauer 19 ms; generierter Code ausschließlich in der Isolate ausgeführt.
- Gespeichertes 3D-JSON: 32 Flächen, 26 Öffnungen, 37 Kanten.
- Core-Prüfung: **0 Fehler, 11 Warnungen, 0 fehlende IDs**, Dachflächenabweichung
  Modell zu Messung 4,5 %. `merken` ist kein fehlerfreier Geometrienachweis:
  Hinweise betreffen u. a. Gaubenwandbreiten/-höhen, zwei Öffnungsunterkanten und
  zwei Ortganglängen. Zwei Elemente sind ausdrücklich als nicht gebaut erfasst.
  Die Messung wird dadurch nicht verändert.
- Keine weitere kostenpflichtige Wiederholung gestartet; temporärer
  Abnahme-Workflow nach Abschluss entfernt.

Die Änderung dieses Auftrags betrifft nur das Outputlimit sowie zugehörige
Tests und den einmaligen Abnahmerunner. Keine Änderung an Effort, Messprompts,
Core, fachlicher Auswertung, Credits oder Viewer. Die reale Erzeugung und
Speicherung ist nachgewiesen; keine neue visuelle Geometrieabnahme behauptet.
