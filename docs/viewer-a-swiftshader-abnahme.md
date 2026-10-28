# Variante-A-Viewer: echte SwiftShader-Abnahme, 28.10.2026

## Ergebnis

Das vorhandene `scripts/inventory/viewer-harness.mjs` funktioniert auch mit dem
neuen A-Adapter. Die zuvor fehlende WebGL-Unterstützung des anderen Testbrowsers
ist **kein allgemeines Hindernis dieser Umgebung**.

**Teilweise bestanden:** zwölf echte Front-/Rückaufnahmen, WL-1, CA-1 und
Farmhouse-Messlinie nachgewiesen. **DS-1-Klick fehlgeschlagen**; keine
Produktänderung oder Fehlerbehebung vorgenommen.

## Methode und Grenzen

- Vorhandenes System-Chromium, Headless, ANGLE/SwiftShader, CDP-Port 9223.
- Tatsächlicher Renderer meldet:
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
- Originale ProjectViewer-, ViewerNextClient- und ViewerViewport-Komponenten,
  A-Adapter und kompiliertes Produktions-CSS, Desktop 1280 × 900.
- Wie bei der ursprünglichen Bestandsaufnahme: isolierter Loopback-
  Komponentenhost, keine Anmeldung umgangen oder Benutzer impersoniert.
  Der authentifizierte Seitenrahmen, Clerk und die Staff-Auswahl selbst sind
  nicht Gegenstand dieses Harness-Laufs; sie wurden zuvor separat geprüft.
- Test-only Three-Wrapper beobachten den echten Renderer und erlauben
  reproduzierbare Kamerapositionen. Alle Geometrie-Bounds werden vor einer
  Front-/Rückaufnahme auf Sichtbarkeit im Viewport geprüft.
- Auswahl und Messung erfolgen über die originalen Ereignishandler, mit
  CDP-Mausbewegungen, Pointer-/Mausklicks und DOM-Bedienelementen. Kein direktes
  Setzen von Auswahl- oder Messzustand.
- Die fünf unveränderten Fixture-Skripte werden im vorhandenen isolierten
  Sandbox-Runner ausgeführt. Das echte Projekt wird ausschließlich gelesen;
  kein erneutes Generieren seines Modells.
- Keine Modell-/Anbieteraufrufe, keine Credits, keine Datenbankänderungen,
  keine Änderung von Dateien unter `artifacts/`, keine App-Neustarts.

## Front-/Rückansichten

Alle zwölf Aufnahmen zeigen echte gerenderte Geometrie mit
`data-geometry-source="model3d"` und WebGL-Status `ready`. Beide Ansichten je Fall:
GL-Fehlercode 0, Kontext nicht verloren. Die Übersichten wurden zusätzlich
visuell betrachtet; sie ersetzen keinen Vergleich mit den Originalbauplänen.

| Fall | Gerenderte Dreiecke je Grundansicht | Ansichten |
|---|---:|---|
| Farmhouse 140040RK | 334 | front / back |
| Farmhouse Test 5 | 262 | front / back |
| Leipzig Villa | 333 | front / back |
| Triplex 40014DB | 865 | front / back |
| Tudor 93233EL | 299 | front / back |
| Echtes Projekt `8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a` | 447 | front / back |

Die Aufnahmen belegen, dass komplexe Dächer, Anbauten und Öffnungen tatsächlich
gerendert werden. Sie allein bescheinigen keine vollständige geometrische
Übereinstimmung mit Fotos oder Bauplänen.

## Interaktionen

### Leipzig WL-1: bestanden

Echter Klick auf die sichtbare Wand wählt die Panelzeile WL-1.
Die Blackbox lautet:

`front · WL-1 / 14,300 mm × 8,140 mm / 1146 sq ft net`

Damit sind die verlangten 14.300 × 8.140 mm im tatsächlichen Browser sichtbar.

### Leipzig CA-1: bestanden

Conditions wurden mit dem vorhandenen Schalter eingeblendet. Ein echter Klick
auf die sichtbare Schadensfläche wählt CA-1 im Panel und zeigt die zugehörige
Schadensinformation. Screenshot liegt vor.

### Leipzig DS-1: fehlgeschlagen

Bei acht vorher festgelegten Kamerawinkeln wurde kein unverdeckter
Raycast-Treffer auf DS-1 gefunden. Danach wurde aus der linken Seitenansicht
gezielt auf den projizierten Mittelpunkt seiner tatsächlichen Geometrie
geklickt. Ergebnis:

```text
Click on projected DS-1 selected ["WL-10"] instead;
nearest raycast hit: WL-10
```

Der originale Viewer wählt dabei tatsächlich WL-10; der Screenshot zeigt
diese Wand hervorgehoben und die entsprechende Panelzeile. Das ist kein
WebGL-Startfehler. Die DS-1-Auswahl im 3D-Modell ist **nicht abgenommen**.

Das Fixture platziert DS-1 von `[0, 900, 8140]` bis
`[0, 900, -109.85915492957746]`. Die genaue Ursache der verdeckten/nicht
priorisierten Auswahl wurde auftragsgemäß nicht weiter untersucht.
Insbesondere wurden weder Hit-Test-Regeln noch Modellkoordinaten geändert.

### Farmhouse 140040RK: bestanden im getesteten Ablauf

Die vorhandene Funktion „Measure line“ wurde aktiviert. Beim Bewegen auf den
projizierten Mittelpunkt der Traufkante E-15 erscheint im originalen Viewer
`edge snap`. Anschließend wurden Anfang und Mittelpunkt angeklickt:
Der Viewer erzeugt eine sichtbare Messlinie mit dem Label `15' 6"`.
Separate Screenshots zeigen Snap-Vorschau und fertige Messlinie.

## Reproduzieren

```sh
pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json \
  scripts/inventory/viewer-a-data.ts
node scripts/inventory/viewer-harness.mjs --variante-a \
  generated-artifacts/viewer-a/inputs.json
```

Der letzte Befehl liefert derzeit bewusst Exitcode 1 wegen des DS-1-
Interaktionsfehlers, erzeugt aber die Ansichten aller sechs Fälle und
dokumentiert den Fehler in `results.json`. Ein tatsächlicher Start-/Renderfehler
stoppt den A-Lauf nach dem ersten betroffenen Fall.

Die generierten Eingaben und Bilder liegen ausschließlich im ignorierten
Verzeichnis `generated-artifacts/viewer-a/`. Das Downloadpaket enthält die
Screenshots, den Bericht und die Ergebnisdaten, nicht die vollständigen
Projekt-/Messungs-JSON-Eingaben.

## Abgrenzung zu noch weitergehender Abnahme

Dieser Lauf ersetzt die vorher fehlenden zwölf tatsächlichen Renderbilder
und die hier aufgeführten gezielten Interaktionen. Auswahl in beiden
Richtungen für jeweils drei IDs **jedes** Hauses, der historische visuelle
Vorher-/Nachher-Vergleich und fachliche Plan-/Fotokonformität wurden damit
nicht zusätzlich pauschal bestätigt.
