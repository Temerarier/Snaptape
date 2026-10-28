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

## Build und offene reale Abnahme

- `pnpm test`: **40 Dateien / 384 Tests bestanden**.
- Typecheck und Produktionsbuild bestanden; Runtime-Dateien und native
  ABI137/glibc-Bindung sind in Nexts Produktionstraces enthalten.
- Bis hierhin **0 bezahlte Modellaufrufe** in diesem Auftrag.

Der echte Messlauf ist noch offen. Das vorhandene Testprojekt besitzt bereits
zwei ältere −1-Buchungen samt Erstattungen. Vor dem neuen kostenpflichtigen Lauf
ist zu entscheiden, ob eine separate Kopie ohne Altbuchungen oder das bestehende
Projekt verwendet wird. Historische Buchungen werden nicht geändert.

Dieser Offline-/Browsernachweis behauptet weder einen erfolgreichen echten
Opus-Messlauf noch bereits vorhandene reale Schritt-2-Usage/Kosten. Reale Stufe,
Korrektur, Effort, Tokens, Kosten und Gesamtdauer werden erst nach diesem Lauf
ergänzt; echte Testfehler sind mit den tatsächlichen Diagnosemetadaten zu melden.
