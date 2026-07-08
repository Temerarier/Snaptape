# Projekt: Aufmaß-App (Fotos/Pläne rein → Messwerte + 3D-Modell raus)

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
2. Die Datei schema/mess-schema.json (v1.2, englisch) ist der Vertrag
   zwischen Messung, Datenbank, Viewer und Report. Änderungen nur auf
   ausdrückliche Anweisung.
3. Jedes Bauteil hat eine feste ID (W-1 = Fenster/Window, D-1 =
   Tür/Door, G-1 = Garagentor, SK-1 = Skylight, E-1 = Kante/Edge,
   RF-1 = Dachfläche/Roof Face, WL-1 = Wand/Wall, SF-1 = Soffit,
   FC-1 = Fascia, AT-1 = Anbau/Attachment). Dieselbe ID überall:
   3D, Tabelle, PDF. ACHTUNG (Migration v1.0→v1.2): das neue „D-"
   ist eine Tür (alt: Dachfläche), das neue „W-" ein Fenster (alt:
   Wand). Alte und neue IDs niemals mischen.
4. Jeder Messwert trägt: value, confidence (high/medium/low), source
   (measured/scaled/estimated), reference_used.
5. Öffnungsmaße zeigen immer den Hinweis „Reference only, not for
   ordering" (deutsch angezeigt als „Richtmaß, kein Bestellmaß").
6. Fehler dem Nutzer IMMER vor einer Bezahlung anzeigen, nie danach.
7. Berechnete Werte (brutto/netto, Verschnitt) leben in lib/berechnung/,
   nie im Mess-JSON.
8. UI-Texte zentral in einer Sprachdatei (Start: Deutsch; Englisch
   vorbereitet, da Zielmarkt USA).
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
