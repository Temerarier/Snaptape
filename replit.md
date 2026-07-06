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
2. Die Datei schema/mess-schema.json ist der Vertrag zwischen Messung,
   Datenbank, Viewer und Report. Änderungen nur auf ausdrückliche
   Anweisung.
3. Jedes Bauteil hat eine feste ID (F-1 = Fenster, T-1 = Tür, K-1 =
   Kante, D-1 = Dachfläche). Dieselbe ID überall: 3D, Tabelle, PDF.
4. Jeder Messwert trägt: wert, confidence (high/medium/low), source
   (measured/scaled/estimated), reference_used.
5. Öffnungsmaße zeigen immer den Hinweis „Richtmaß, kein Bestellmaß".
6. Fehler dem Nutzer IMMER vor einer Bezahlung anzeigen, nie danach.
7. Berechnete Werte (brutto/netto, Verschnitt) leben in lib/berechnung/,
   nie im Mess-JSON.
8. UI-Texte zentral in einer Sprachdatei (Start: Deutsch; Englisch
   vorbereitet, da Zielmarkt USA).
9. Fassaden heißen strassenseite / gartenseite / links / rechts (von
   der Straße aus gesehen) – niemals Himmelsrichtungen raten. Die
   Himmelsrichtung kommt später deterministisch aus der Adresse.

## Architektur-Überblick

Upload → Qualitätscheck (Sonnet) → Messung (Fable, JSON, 2–3 Läufe) →
Edge-Case-Warnungen (Code) → 3D-Viewer + Report. Der Nutzer KANN
optional ein eigenes Referenzmaß angeben (übersteuert Annahmen), muss
aber nicht. Kein Pflicht-Review, kein Edit-Modus im MVP.

## Projektstruktur & Betrieb

Die Next.js-App lebt als eigenes Paket im pnpm-Monorepo unter
`artifacts/aufmass-app/`:

- `app/` — Next.js App Router (aktuell: Healthcheck-Seite unter `/`)
- `lib/berechnung/` — berechnete Werte (brutto/netto, Verschnitt)
- `lib/messung/` — Mess-Pipeline (später)
- `lib/storage/` — Replit Object Storage Client (Sidecar-Auth)
- `schema/` — `mess-schema.json` (Vertrag, noch leer)
- `components/` — React-Komponenten
- `i18n/` — zentrale Sprachdatei(en), Start: `de.ts`

Befehle:

- `pnpm --filter @workspace/aufmass-app run dev` — Dev-Server starten (Workflow "artifacts/aufmass-app: web")
- `pnpm --filter @workspace/aufmass-app run build` / `run start` — Produktion
- `pnpm --filter @workspace/db run push` — DB-Schema-Änderungen pushen (Drizzle, Dev)
- DB-Zugriff über `@workspace/db` (Drizzle + pg, `DATABASE_URL`)

Hinweis: Die Workspace-Pakete `artifacts/api-server` und
`artifacts/mockup-sandbox` gehören nicht zur Aufmaß-App.

## User preferences

- Setup-Anweisung des Users: nur Setup + replit.md, danach NICHTS
  weiterbauen (keine Mess-Pipeline, kein 3D-Viewer, keine Anthropic-Calls,
  kein Stripe).
- Stack ist fix und darf nicht geändert werden.
- Kommunikation auf Deutsch.
