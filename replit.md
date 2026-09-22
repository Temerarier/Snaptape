# Projekt: Snaptape (Fotos/Pläne rein → Messwerte + 3D-Modell raus)

## Stack (fix, nicht ändern)
- Next.js (App Router) + TypeScript, Tailwind
- PostgreSQL (Replit-DB), Replit Object Storage für Dateien
- three.js für den 3D-Viewer
- Anthropic API für Bildanalyse (Secret: ANTHROPIC_API_KEY)
- Stripe für Bezahlung (erst Etappe 6)
- Hosting/Datenspeicherung: US-Region (Zielmarkt USA)

## Eiserne Regeln
1. Alle Maße intern IMMER in Millimetern, ungerundet als Zahl speichern.
   Gerundet wird nur in der Anzeige. Keine Ausnahmen.
2. Der Vertrag zwischen Messung, Datenbank, Viewer und Report ist
   shared/schema/measurement-v1.7.json. Änderungen nur auf
   ausdrückliche Anweisung. (Historisch: schema/mess-schema.json v1.2 —
   nicht mehr verwenden.)
3. Jedes Bauteil hat eine feste ID (W-1 = Fenster/Window, D-1 =
   Tür/Door, G-1 = Garagentor, SK-1 = Skylight, E-1 = Kante/Edge,
   RF-1 = Dachfläche/Roof Face, WL-1 = Wand/Wall, SF-1 = Soffit,
   FC-1 = Fascia, AT-1 = Anbau/Attachment). Dieselbe ID überall:
   3D, Tabelle, PDF. ACHTUNG (Migration v1.0→v1.2): das neue „D-"
   ist eine Tür (alt: Dachfläche), das neue „W-" ein Fenster (alt:
   Wand). Alte und neue IDs niemals mischen.
4. Jeder Messwert trägt: value, confidence (high/medium/low), source
   (measured/scaled/estimated), reference_used.
5. Wo der Hinweis „Reference only, not for ordering" (deutsch
   „Richtmaß, kein Bestellmaß") angezeigt wird, ist die EINZIGE Quelle
   lib/config/hinweis.ts (HINWEIS_RICHTMASS_EN / HINWEIS_RICHTMASS_DE) –
   nirgends hart codieren. AUSNAHME: der neue Viewer (/viewer-next)
   zeigt ihn bewusst NICHT; dort gilt allein der Haftungssatz aus
   docs/viewer-spec.md, Abschnitt 12. Nicht nachrüsten.
6. Fehler dem Nutzer IMMER vor einer Bezahlung anzeigen, nie danach.
7. Berechnete Werte (brutto/netto, Verschnitt) leben in lib/berechnung/,
   nie im Mess-JSON.
8. UI-Texte zentral in den Sprachdateien unter i18n/ (en-US.ts +
   de-DE.ts, identische Struktur via Dictionary-Typ). Standard ist
   US-Englisch (en-US); Deutsch (de-DE) ist pro Nutzer umschaltbar
   (users.locale, überlebt Reload/Login). Datumsformat je Sprache
   (EN MM/DD/YYYY, DE DD.MM.YYYY); Einheiten bleiben in BEIDEN
   Sprachen imperial (Regel 9).
9. Elevations heißen front / back / left / right (von der Straße aus
   gesehen; front = zur Straße gerichtete Seite) – niemals
   Himmelsrichtungen raten. Die Himmelsrichtung kommt später
   deterministisch aus der Adresse. Anzeige imperial (ft-in wie
   „14' 11"", ganze ft², Pitch x/12); intern bleiben ungerundete mm.

## Design-System (Technical-Clean)
Zentrale Tokens in `artifacts/aufmass-app/app/globals.css` (`@theme`),
Fonts in `app/layout.tsx`, Basis-Komponenten in `components/ui/`
(Button, Card, Input, Badge, Modal). ALLE neuen Screens nutzen diese
Tokens/Komponenten – keine eigenen Hex-Farben oder Ad-hoc-Styles.

Werte (verbindlich):
- Hintergrund: #FAFBFC (`bg-hintergrund`)
- Fläche/Karte: #FFFFFF (`bg-flaeche`)
- Akzent: #2563EB (`bg-akzent` / `text-akzent`)
- Text primär: #16233A (`text-schrift`)
- Text sekundär: #43536E (`text-schrift-sekundaer`);
  gedämpft/tertiär: #6B7A93 (`text-schrift-tertiaer`)
- Rahmen/Hairline: #E3E8EF (`border-linie`)
- Schriften: IBM Plex Sans (UI + Überschriften, `font-sans`),
  IBM Plex Mono (Zahlen, IDs, Messwerte, `font-mono`)
- Eckenradius: 12px Bedienelemente/Inputs (`rounded-eingabe`),
  16–20px Karten (`rounded-karte` / `rounded-karte-gross`),
  999px Pills (`rounded-full`)
- Schatten: 0 4px 16px rgba(20,30,50,0.05) für Karten (`shadow-karte`);
  0 2px 8px rgba(37,99,235,0.25) auf Akzent-Buttons (`shadow-akzent`)
- Abstände: 4px-Raster – 8/12 eng, 16/20 Karten-Innenabstand,
  24–28 Abschnittsabstände
- Statusfarben (Text auf Fläche): ok #157F3D auf #E7F6EC
  (`text-ok` / `bg-ok-flaeche`), warn #B45309 auf #FDF3E1
  (`text-warnung` / `bg-warnung-flaeche`), error #B91C1C auf #FBE9E9
  (`text-fehler` / `bg-fehler-flaeche`)

## Architektur-Überblick
Upload → Qualitätscheck (Sonnet) → Messung (Fable, JSON, 2–3 Läufe) →
Edge-Case-Warnungen (Code) → 3D-Viewer + Report. Der Nutzer KANN
optional ein eigenes Referenzmaß angeben (übersteuert Annahmen), muss
aber nicht. Kein Pflicht-Review, kein Edit-Modus im MVP.

### Datei-Upload (Etappe 1, umgesetzt)
- Grenzen zentral in `lib/upload/regeln.ts`: max. 10 Dateien/Projekt,
  25 MB/Datei, jpg/jpeg/png/heic + pdf. Client und Server nutzen
  dieselben Regeln; verbindlich prüft der Server (Storage-Metadaten).
- Browser lädt per signierter PUT-URL DIREKT in den Object Storage
  (nie durch Server-Action-Bodies). Danach registriert eine Action die
  Datei und verarbeitet sofort: PDF → 1 PNG pro Seite (~3000 px lange
  Kante, pdftoppm), Foto → JPEG-Vorschau (vipsthumbnail, kann HEIC).
  Spätere KI-Aufrufe nutzen NUR Seitenbilder, nie das Roh-PDF.
- Objektpfade: `$PRIVATE_OBJECT_DIR/projekte/<projektId>/original|
  vorschau|seiten/…`. Auslieferung über `/dateien/<id>?v=…` (Route
  prüft Session + Eigentum). ACHTUNG: `/api/*` gehört auf dem geteilten
  Proxy dem separaten API-Server-Artefakt – in der Next-App niemals
  Routen unter `/api/…` anlegen.
- Status-Maschine: draft → files_uploaded (beim „Messung starten") →
  processing → model_ready | failed; alte Werte reviewing/ready bleiben
  vorerst. Werden alle Dateien entfernt, fällt files_uploaded auf draft
  zurück. Qualität (standard/premium) + optionales Referenzmaß werden
  erst beim Start gespeichert.
- System-Abhängigkeiten: poppler-utils (pdftoppm/pdfinfo) und vips
  sind deklariert (auch fürs Deployment nötig).

## Etappe 4: Neuer Viewer (Fahrplan — immer nur den aktuellen Schritt bauen)

Der neue Viewer entsteht auf `/viewer-next` in vier Schritten, jeder als
eigener Prompt. Der alte Viewer bleibt unberührt, bis 4d ihn löscht.

- **4a — Panel.** Die rechte Seite nach `docs/viewer-spec.md` und den
  Referenzen unter `docs/viewer-reference/`. 3D ist nur ein Platzhalter.
- **4b — 3D-Viewport.** Modell aus der Messung, Maßlinien, Auswahlkasten,
  Messlinie mit Snap.
- **4c — Rechen-Bubble** und Durchgang durch die komplette Spec.
- **4d — Alten Viewer löschen**, Links umbiegen, lib/viewer/,
  anzeigeAdapterV15.ts und lib/berechnung/flaechen.ts entfernen.

REGEL: immer nur bauen, was der laufende Prompt verlangt. Nichts aus
einem späteren Schritt vorbereiten, kein Gerüst, keine leeren Dateien,
keine „schon mal"-Komponenten. Was gerade nicht dran ist, bleibt
Platzhalter.

Panel-Inhalt ist auf allen Bildschirmgrößen gleich. Die aktuelle
Viewer-Polish-Vorgabe vom 18.09.2026 ersetzt die frühere Übernahme der
Tablet-Bedienelemente aufs Handy: unter 768px gelten runde Modell-Controls
und die unten angedockte Rechenleiste. Hochformat hat genau zwei Zustände
(geteilte Ansicht / ganzes Modell), keine ziehbare Panel-Höhe.
Token-Vertrag und Herkunftsnachweise: `docs/design/viewer-v4-tokens.md`.
