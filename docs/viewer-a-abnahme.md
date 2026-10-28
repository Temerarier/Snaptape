# Variante-A-Geometrie im bestehenden Viewer

> Nachtrag 28.10.2026: Das vorhandene Inventory-Harness kann echtes WebGL mit
> SwiftShader ausführen. Zwölf Renderbilder und gezielte Interaktionsnachweise
> liegen inzwischen vor. DS-1 wählt fälschlich WL-10 und ist nicht abgenommen.
> Der aktuelle Befund steht in `viewer-a-swiftshader-abnahme.md`; die folgende
> frühere Browser-Einschränkung gilt nur für den damaligen Testbrowser.

## Umfang

Kunden- und Staff-Projektviewer verwenden gespeicherte Variante-A-Geometrie,
wenn `model3dStatus = ready` und `model3d` vorhanden ist. Bei historischen
Projekten ohne Modellstatus bleibt der bisherige `buildModel`-Pfad erhalten.
An `buildModel` selbst wurden ausschließlich vorhandene Hilfsfunktionen
exportiert, keine Berechnungen oder Ergebnisse geändert.

Der Adapter verbindet die Geometrie über die Messungs-IDs mit den angezeigten
Werten. Breiten, Höhen, Flächen, Neigungen, Öffnungstypen, Kantenlängen und
Farben stammen aus der Messung bzw. unveränderten messungsabhängigen
Farbregeln. Fehlende Werte bleiben null und erscheinen als „—“. Bounding-Boxes,
Dreiecke, Normalen, Kamerapositionen und manuelle Messlinien verwenden die
Geometrie. Die Berechnungsschicht und das Panel wurden nicht geändert.

- Geteilte Flächen und Anbauflächen behalten dieselbe ID; die Auswahl markiert
  alle zugehörigen Renderobjekte.
- Anbauten: ein auswählbarer Eintrag je Fläche. Dekoration: nicht auswählbar.
- Fallrohre: Kanten mit `edgeClass = downspout`. Schäden: 20 mm von der Fläche
  abgehoben, ohne zusätzlichen zweiten Renderoffset.
- Polygontriangulation berücksichtigt konkave Konturen.
- Keine Präsentations-Schließflächen für A-Modelle; die alte Schließung bleibt
  für den bisherigen Modellpfad aktiv.
- Keine Fensterrahmen, Sprossen oder Türblätter ergänzt.
- Schwarze Auswahlboxen für A-Modelle zeigen gemessene Millimeterwerte; der
  bisherige Modellpfad behält seine bisherige Formatierung.
- Pending/unavailable: Status ausschließlich im 3D-Bereich, Messpanel bleibt
  verfügbar. Pending aktualisiert alle 10 Sekunden. Texte in Deutsch/Englisch.
- Private Modellberichte und KI-Code werden nicht an die Viewer übergeben.
  Projektabfragen wählen öffentliche Felder explizit aus.

## Staff-Testseite

`/viewer-next` und `/viewer-next/debug.svg` verlangen `requireStaff`.
Die Auswahl „Test house“/„Testhaus“ enthält zuerst die Garage und anschließend
alle fünf Variante-A-Fixtures. Aus `buildhouse.js` entsteht das Fixture-Modell
ausschließlich serverseitig in der bestehenden isolierten Sandbox, ohne
Anbieteraufruf und ohne Datenbankbuchung. Fixture-Dateien sind in den
Produktions-Traces enthalten; sie liegen nur im Staff-Testseitenmodul, nicht in
gemeinsamem Kunden-Viewercode.

## Automatische Nachweise

- **399 Tests in 42 Dateien bestanden.**
- Zusätzlich vier gezielte Tests mit Nexts tatsächlicher Middleware-
  Matcherprüfung bestanden: Testseite, Queryparameter und SVG-Debugroute
  werden geschützt; normale statische Bilder bleiben ausgenommen.
- Produktionsbuild einschließlich Typprüfung erfolgreich.
- Alle fünf Häuser werden mit echtem Core und echter Sandbox geladen:
  Farmhouse 140040RK, Farmhouse Test 5, Leipzig Villa, Triplex 40014DB,
  Tudor 93233EL.
- Alle geometrischen IDs im ViewerModel vorhanden. Gemessene Werte jeder
  Wand, Dachfläche und Öffnung anhand ihrer ID geprüft.
- Unbekannte Messungs-ID: null-Werte und „—“, keine aus Geometrie errechneten
  Anzeigemaße.
- Geteilte ID bleibt erhalten; für Leipzig WL-1 ergeben beide Teile
  **14.300 × 8.140 mm**.
- Absichtliche Geometrie- und AI-Farbänderung verändert die angezeigten
  Messwerte oder Messungsfarbe nicht.
- CA-1 bleibt Bedingungsfläche mit Parent WL-3, DS-1 bleibt auswählbare
  Fallrohrkante, Schadensabstand 20 mm geprüft.
- Farmhouse-140040RK-Traufkante im geometrischen Snap-Test bestätigt.
- Pending, unavailable und ready serverseitig in beiden Sprachen gerendert:
  Panel weiterhin vorhanden; keine Canvas bei pending/unavailable;
  ready nutzt A-Geometrie. Sämtliche numerischen Paneltexte identisch.

## Echtes Projekt, ausschließlich lesend

`viewer-a-real-project-verification.json` dokumentiert die erfolgreiche
Adapterausführung auf dem gespeicherten, zuvor bezahlten Projekt
`8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a`:

| Objektgruppe | Viewer-Einträge |
|---|---:|
| Wände | 13 |
| Dachflächen | 9 |
| Öffnungen | 26 |
| Anbau-/sonstige Flächen | 136 |
| Schäden | 2 |
| Kanten inkl. Fallrohre | 41 |

Alle gespeicherten geometrischen IDs erhalten. **0 neue Modellaufrufe**;
Messungen, Geometrie, Eigentümer und Buchungen des echten Projekts unverändert.

Während des vorausgehenden echten Schritt-2-Laufs wurde bereits folgender
Zustand durch eine lesende DB-Abnahmekontrolle protokolliert:

```text
status       model3d_status  has_measurement  outcome       duration_ms  input_tokens  output_tokens  retry_used  repair_used  model_rows
model_ready  pending        true             model_ready   871530       44384         91285          false       false        0
```

Dies belegt den damaligen Zwischenzustand nach gespeicherter Messung und vor
Abschluss der Modellgenerierung. Es ist kein Screenshot des jetzt geänderten
Viewers.

## Browserabnahme und verbleibende Einschränkungen

Vor Änderungen wurde die Garage im Testbrowser geöffnet. WebGL konnte bereits
dort nicht initialisiert werden; die Aufnahme `ny8p9v` zeigt den tatsächlichen
Gerätehinweis statt gerenderter Geometrie. Der Browser stellt keine unterstützte
Startoption zur Aktivierung eines Software-Renderers bereit.

Daher sind die zehn geforderten echten Front-/Rückansichten, geometrisches
Klicken, die schwarze Auswahlbox im WebGL-Viewport, die manuelle Snap-Messlinie
im Browser und der visuelle Vorher-/Nachher-Vergleich alter Geometrie **noch
nicht visuell abgenommen**. Die automatischen Daten-/Interaktionstests oben
ersetzen diese Aufnahmen nicht. Die Nutzerfreigabe für das Staff-Konto wurde
eingeholt, ohne Berechtigungen oder Konfiguration zu verändern.

Die Browserprüfung hat eine anfängliche 500-Antwort auf der geschützten
SVG-Debugroute aufgedeckt. Ursache: Die vorhandene Middleware schloss
Dateiendungen wie `.svg` aus. Der gesamte Testseiten-Unterbaum wird nun
ausdrücklich von Clerk erfasst. Danach bestanden die vier neuen Matcher-Tests
und erneut der Produktionsbuild. Dies ist keine Abschwächung des Staff-Gates.

Bereits im Browser bestätigt: anonyme Testseite leitet zur Anmeldung um,
normales Kundenkonto sieht auf `/viewer-next` eine 404. Das tatsächliche
erfolgreiche Projekt lädt im Kundenviewer seine Messwerte und den A-Pfad
(`data-geometry-source="model3d"`), nicht den alten Modellpfad. Kein
Modellbericht oder Codefeld im gerenderten Dokument. Die 3D-Geometrie selbst
bleibt wegen fehlendem WebGL unsichtbar.

### Abschließendes Browserergebnis

Der gleiche Browserprüfer hat nach der Korrektur die verbleibenden
nicht-GPU-abhängigen Prüfungen abgeschlossen:

| Prüfung | Ergebnis |
|---|---|
| Anonym → SVG-Debugroute | Weiterleitung zur Anmeldung, keine 500 |
| Normales Kundenkonto → Testseite / SVG | beide 404, keine Staff-Inhalte |
| Freigegebenes Staff-Konto → Testseite / SVG | 200 / 200, SVG mit korrektem Content-Type |
| Fixture-Auswahl | sechs Optionen; Garage zuerst |
| Garage | Quelle buildModel |
| Alle fünf A-Häuser | Quelle model3d, Panel vorhanden |
| Eigenes Ready-Testprojekt | model3d |
| Eigenes historisches Testprojekt | buildModel |
| Pending | Status im 3D-Bereich, vollständiges Panel, automatische Aktualisierung |
| Pending → ready | offene Seite aktualisiert ohne manuellen Reload |
| Unavailable | lokalisierter Status, vollständiges Panel, null Canvas-Elemente |
| Numerischer Panelvergleich | alle 285 numerischen Tokens in fünf geprüften Zuständen identisch |
| Private Reports / KI-Code | Marker und Feldnamen weder in den vier HTML-Dokumenten noch in erfassten Ready-Netzwerkantworten |
| Panel-Filter | Roofing aktiviert, anschließend All wiederhergestellt |
| Cleanup | genau vier eigene synthetische Projekte gelöscht, verbleibende Anzahl 0 |

Die Pending-Beobachtung dauerte zunächst 10.026 ms; nach dem gezielten
DB-Zustandswechsel des eigenen Testprojekts wurde die A-Quelle innerhalb der
anschließenden 20-Sekunden-Beobachtung automatisch sichtbar. Der produktive
Refresh-Takt ist 10 Sekunden. Kein Upload, Anbieteraufruf, Credit-Aufruf oder
Ändern fremder Projekt-/Messungsdaten.

Aufnahmen der tatsächlich erreichbaren Zustände:

- `idhhau`: Staff-Testseite mit sechs Fixture-Optionen.
- `5v4pu8`: Garage mit Messpanel und bestehendem WebGL-Gerätehinweis.
- `xv7mg1`: Leipzig Villa mit Messpanel und A-Quellpfad, WebGL-Gerätehinweis.
- `rt71ak`: Pending im 3D-Bereich bei gleichzeitig sichtbarem Messpanel.
- `tw0brh`: Unavailable mit weiterhin sichtbarem Messpanel.
- `45zgth`: unabhängiger Roofing-Filter.
- `wvr4mj`: echtes gespeichertes Projekt mit A-Quellpfad und Messwerten.

Der historische Kopfstatus „Model ready“ bleibt der bisherige, erfolgreiche
Messungsstatus; der zusätzliche Modellzustand wird getrennt im 3D-Bereich
angezeigt. Keine weiteren Layout-/Designänderungen wurden dafür eingeführt.

**Abschlussstatus:** Umsetzung und automatische Daten-/Zustandsabnahme
abgeschlossen, Zugriffsschutz und nicht-GPU-abhängige Browserabnahme bestanden.
Die vollständige visuelle 3D-Abnahme bleibt wegen fehlendem WebGL offen und ist
als eigener Folgeschritt dokumentiert. Keine der Gerätehinweis-Aufnahmen wird
als Front-/Rückansicht gerenderter Geometrie ausgegeben.
