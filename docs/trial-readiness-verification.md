# SnapTape — Testkunden-Abnahme, 28.10.2026

## Ergebnis

Die vier Änderungen sind umgesetzt: Clerk Auth (ausdrücklich gewählte Alternative
zu Replit-Konten), Credit-Ledger, ein Messmodell und 60-Minuten-Bereinigung.
**Noch keine vollständige Freigabe für Testkunden:** Die Selbstregistrierung
benötigt eine menschliche Cloudflare-Prüfung; der einzige echte Opus-Abnahmelauf
wurde durch einen Workspace-Neustart unterbrochen und anschließend erstattet.
Es wurde kein zweiter echter Messlauf gestartet.

## A — Anmeldung mit Clerk

- Replit-managed Clerk eingerichtet; offizielles Next.js-App-Router-SDK,
  Middleware und eingebettete, gebrandete Sign-in/Sign-up-Seiten.
- `/login`: ein Button „Sign in or create account“. `/register` leitet dorthin.
  Root-Weiterleitung bleibt erhalten; geschützte Seiten merken eine sichere,
  lokale Rücksprungadresse.
- Lokale Nutzer-UUIDs und Projektzuordnungen bleiben bestehen.
  `replit_user_id` enthält aus Kompatibilitätsgründen jetzt die Clerk-ID.
  Ein altes Konto wird nur über eine von Clerk **bestätigte** primäre E-Mail
  verknüpft. Fehlende E-Mail wird durch Name, externe ID oder UUID ersetzt.
- `last_login_at` wird bei einer neuen Clerk-Sitzung aktualisiert, nicht bei
  jedem Seitenaufruf.
- Lokale Passwort-Actions/Formulare, bcrypt-Abhängigkeit und Sessions-Tabelle
  entfernt. Bestehende Passwort-Hashes sind nullable Altdaten und authentifizieren
  nicht mehr. Abmeldung und Passwortzurücksetzen erfolgen über Clerk.
- Staff weiterhin ausschließlich über `STAFF_EMAILS`, case-insensitive; ohne
  bestätigte E-Mail kein Staff.
- Produktions-Frontend-API-Proxy im Express-Server vor Body-Parsern eingebunden.
  Keine Veröffentlichung oder Prüfung eines Produktions-Tenants vorgenommen.

### Aktive Anbieter und manuelle Schalter

Die tatsächliche Entwicklungs-UI zeigte **Google und E-Mail/Passwort**.
GitHub, Apple und X wurden nicht angezeigt und werden nicht als aktiv behauptet.
Das verfügbare Provisionierungswerkzeug stellt keine Anbieter-Schalter bereit.

Exakter dokumentierter Klickpfad:

1. **Tools → Users & Auth → Configure**.
2. **Development** wählen.
3. **SSO providers** öffnen, **GitHub**, **Apple**, **X** aktivieren.
4. Für die spätere Veröffentlichung im separaten **Production**-Umfeld wiederholen.

Development und Production haben getrennte Konten.

### Registrierung: ehrliche Prüfgrenze

Die E-Mail-Bestätigung wurde akzeptiert. Ein älteres Clerk-SDK blieb anschließend
bei `missing_requirements` trotz leerer Listen fehlender/unbestätigter Felder.
Nach Aktualisierung auf die durch die Release-Age-Regel zugelassenen Versionen
(`@clerk/nextjs` 7.9.21, localizations 4.24.2) war die verbleibende Anforderung
sichtbar: `missing_fields: ["protect_check"]`, Cloudflare „Verify you are human“.

Der Test hat diese Prüfung weder gelöst noch umgangen oder abgeschaltet.
**Die vollständige Selbstregistrierung ist daher nicht browser-verifiziert.**
Für die weiteren Tests wurde über Clerks offizielle Backend-Admin-API ein
Entwicklungskonto ohne Rollen angelegt und über die echte sichtbare
Passwort-Reset-/Login-UI angemeldet. Das belegt Login und Nutzerverknüpfung,
nicht den Abschluss der Selbstregistrierung.

Ein zwischenzeitlicher Provider-Kontextfehler nach dem SDK-Major-Update
verschwand nach vollständigem Neuladen mit deaktiviertem HTTP-Cache. Ein frischer
Browser zeigte ebenfalls das Formular korrekt.

## B — Credits und UI

- Guthaben ausschließlich `SUM(credit_ledger.delta)`, keine Balance-Spalte.
- Serverprüfung vor jeder bezahlten Klassifizierung, auch für Staff.
- Nach bestandenem Klassifizierungsgate: Nutzerzeile sperren, Guthaben erneut
  prüfen, -1 buchen und Processing-Run innerhalb derselben Transaktion übernehmen.
  Scheitert ein Guard, wird auch die Abbuchung zurückgerollt.
- Laufabschluss, Protokoll und berechtigte Rückerstattung sind atomar.
  Erfolgreiche und veraltete Läufe erstatten nicht.
- Zusätzliche technische Verknüpfungen `current_credit_ledger_id` und `refund_of`
  sichern den Bezug zum tatsächlichen Debit. Ein Unique-Index verhindert
  doppelte Erstattungen, ohne die geforderten Notizen zu verändern.
- Ohne tatsächliche Abbuchung keine erfundene Erstattung historischer Läufe.
- `/admin/users`: echte Staff-Prüfung, Nutzerübersicht, Salden, Messungszahlen,
  Kosten, Zeitpunkte, ausklappbares Ledger und Projektlinks.
  Buchung mit Ganzzahl -100 bis 100, nicht 0, Pflichtnotiz; Staff-ID serverseitig.
- Optionaler Support-Link nur bei gesetzter `SUPPORT_EMAIL`, keine Platzhalter.
- Kundenseiten zeigen keine Modellauswahl oder API-Kosten.

Im Browser tatsächlich geprüft:

- Neues Konto auf `/app`: **Credits: 0**, Willkommenshinweis.
- Upload mit 0 Credits: Hinweis und deaktiviertes
  **Start measurement · 1 credit**; kein Start-/Klassifizierungsrequest.
- Nicht-Staff erhält bei `/admin/users` eine echte 404 ohne Admin-Daten.
- Abmeldung und erneute Anmeldung über Clerk funktionieren.
- Über das echte Admin-Formular **+2 staff_grant**, Notiz `trial` gebucht;
  Ledger und Kontostand 2 sichtbar. Nach Reload war Start aktiviert.
- Staff hat beim einzigen tatsächlichen Start ebenfalls einen Credit bezahlt.

Die temporäre Staff-Testfreigabe galt nur im laufenden Testprozess. Keine
persistente Secret-/Konfigurationsänderung. Nach Workspace-Neustart und normalem
Workflow-Start ist diese Laufzeitfreigabe entfernt.

### Kein Credit: Servernachweis

Der Action-Test ersetzt den Klassifizierer durch einen Mock und prüft, dass bei
Guthaben 0 weder Klassifizierung noch Projektzugriff stattfinden.
Der Serverpfad protokolliert:

```text
Measurement start blocked: no credits; classification not called
```

Der deaktivierte Browserbutton sendet selbst keinen Serverrequest. Deshalb wird
hier kein angeblich im Live-Server beobachteter Request behauptet.

## C — Ein Messmodell

- `MESS_MODELL`, Default `claude-opus-5-5`.
- `MESS_EFFORT`, Default `medium`, validiert gegen low/medium/high/xhigh/max.
- Anthropic-SDK-Streaming, `max_tokens: 64000`, `output_config.effort`.
  Kein Sampling-Parameter, kein manuell konfiguriertes Thinking.
- Retry-/Repair-Ablauf erhalten, nur die Modellaufruf-Signatur angepasst.
- Thinking-Tokens sind bereits in `usage.output_tokens` enthalten.
- Schätzung $4 Input / $20 Output pro Million Tokens, Preisstand 25.10.2026;
  keine Anbieterrechnung.
- Neue Projekte/Läufe speichern aus Historienkompatibilität `quality=premium`.
  Kein Fallback auf frühere Modelle.

## D — Timeout und Null-Invariante

- Neue Messstarts setzen `processing_since`, reguläre Abschlüsse löschen es.
- Kundenliste und Projektdetail bereinigen eigene Projekte; Admin-Messungen und
  Admin-Nutzer alle Nutzer. Kein Cronjob oder Produkt-Hintergrundworker.
- Älter als 60 Minuten: failed, Guard und Timestamp gelöscht, ein fehlgeschlagener
  Lauf und eine tatsächliche Debit-Erstattung mit Notiz `timeout`.
- Zweiter Sweep ändert nichts; späte Pipeline-Ergebnisse können den Status nicht
  überschreiben oder ein zweites Mal erstatten.
- `model_ready` mit Measurement null wird nicht mehr geschrieben.
  Bestehende solche Projekte werden ohne erfundene Credits auf failed gesetzt.
- Historischen Processing-Zeilen ohne Startzeit wird kein geratener Timestamp
  zugewiesen. Sie bleiben als bekannte Altlast separat behandelbar.

## Echte PostgreSQL-Prüfungen ohne Modellaufrufe

### Parallelität

```sh
pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json scripts/credits-concurrency.ts
```

Tatsächliche Ausgabe:

```json
{"successfulStarts":1,"insufficientCreditErrors":1,"measurementLedgerRows":1,"finalBalance":0}
```

Isolierter Testnutzer und dessen Testdaten wurden anschließend gelöscht.

### Fehler / Timeout / Idempotenz

```sh
EXTRAKTOR_STUB=1 EXTRAKTOR_STUB_KAPUTT=1 pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json artifacts/aufmass-app/scripts/verify-credits.ts --isolated
```

Ergebnisse in `docs/credits-db-verification.json`:

- Kaputter Stub: failed; -1 measurement und +1 refund / `measurement failed`.
- Zwei-Stunden-Fixture: failed, exakter 60-Minuten-Fehler, genau ein Lauf und
  eine Erstattung / `timeout`, auch nach zwei Sweeps.
- Jüngere Processing-Fixture bleibt aktiv; anschließend durch kaputten Stub
  abgeschlossen, damit kein Testcredit verbraucht bleibt.
- model_ready/null-Fixture wird failed, ohne erfundene Erstattung.
- Guthaben vor/nach allen Fällen **1 / 1**; isolierte Testdaten bereinigt.

Diese PostgreSQL-Tests rufen denselben Cleanup-Service auf wie die Produktseiten.
Die direkten Service-Aufrufe werden nicht als Browser-Seitenaufruf ausgegeben.

## Einziger echter Braamheide-Test: unterbrochen und erstattet

Im Browser wurden alle sieben Dateien hochgeladen (6 JPEGs und 1 PDF).
Nach abgeschlossener Verarbeitung wurde Start **genau einmal** angeklickt.

- Nutzer-UUID: `ed9b751e-4b07-43fa-8193-7d88d00f3d32`
- Projekt-UUID: `dbc4aede-680e-4747-992e-0d69a19e1cfa`
- Processing seit 28.10.2026, 15:14:01.775 UTC.
- -1 measurement verbindlich gebucht; Restguthaben zunächst 1.
- Konfiguration: claude-opus-5-5, effort medium.

Während der Abschlussprüfung startete der **gesamte Workspace** neu. Das
Plattformereignis meldete beide laufenden Shell-Jobs als `lost`; die Prozesse und
deren temporäre Logs waren danach verschwunden. Der Auslöser ist nicht sicher
belegt; es wird insbesondere kein nachgewiesener OOM behauptet.

Der verlorene Modellstream ist nicht wiederaufnehmbar. Der eigene Testlauf wurde
guarded und transaktional auf failed gesetzt, mit:

```text
Measurement interrupted by workspace restart during verification
```

Ein +1 refund / `measurement failed` stellt das Guthaben wieder auf **2**.
Keine zweite Messung wurde gestartet. Nachweis:
`docs/credits-real-verification.json`.

Der Protokolleintrag wurde durch die Recovery erstellt, **nicht** aus einer
vollständigen Modellantwort:

- Modell: claude-opus-5-5; Ausgang failed.
- 394094 ms von Start bis Recovery, **keine reine Modelllaufzeit**.
- Input-/Output-Tokens und Kosten **unbekannt/null**, nicht erfunden.
- `model_ready` ist mit diesem Abnahmelauf **nicht nachgewiesen**.
- Ein weiterer bezahlter Abnahmelauf benötigt eine neue Freigabe.

## Prüfungen und Quelltextgrenzen

- Drizzle-Push angewendet, ohne Nutzer-/Projekt-Truncation; nur die ausdrücklich
  zu entfernende lokale Sessions-Tabelle wurde gelöscht.
- Workspace-Typecheck bestanden.
- **33 Testdateien / 301 Tests bestanden**, keine echten API-Aufrufe in Vitest.
- Abschließender Produktionsbuild nach SDK-Upgrade erfolgreich, bei gestopptem
  Webserver mit `NODE_OPTIONS=--max-old-space-size=1536`.
- React/ReactDOM nur innerhalb 19.1 auf 19.1.4 für Clerk-Peer-Kompatibilität
  aktualisiert; Next.js bleibt 15.5.20.
- Web- und API-Workflow anschließend normal gestartet.
- Keine Änderungen an docs/pipeline, shared/schema, lib/measurement,
  Klassifizierungsservice, Billing-Reconciliation oder Viewer-Quelltext.
- Variante A nicht integriert; beide vorgegebenen SHA-256 unverändert.

Bewusste, offen ausgewiesene Ausnahmen:

1. Die Anforderungen „grep vollständig leer“ und „lib/billing unberührt“ sind
   widersprüchlich: Die historische Billing-Reconciliation liest weiterhin
   `KIMI_API_KEY`, Billing-Testdaten enthalten den alten Modellnamen.
   Diese Dateien wurden ausdrücklich nicht verändert. Der Messpfad enthält
   keine alten Provider/Modell-IDs mehr.
2. Historische Browser-Hilfsskripte verwenden noch die entfernte Sessions-Tabelle.
   Sie wurden nicht als Teil einer Viewer-/Billing-Überarbeitung geändert.
3. Der frühere unauthentifizierte `/dev/extraktion-test`-Endpunkt liefert jetzt
   404, weil er sonst Eigentum, bezahltes Gate und Credits umgehen könnte.

## Browserbelege

Beobachtungs-IDs des benannten Tests `auth-credits`:

- `630wjj`: Credits 0 / Willkommenszustand.
- `s1yjkt`: echte Nicht-Staff-404.
- `1kyvhc`: +2 Grant / Ledger / Erfolg.
- `qse931`: Upload nach Reload mit aktiviertem Start.
- `d6tvod`: alle sieben Braamheide-Dateien fertig.
- `97tfjh`: einziger echter Lauf in Processing.
- `sd7iha`: menschliche Cloudflare-Prüfung bei Selbstregistrierung.

Dies sind Browser-Beobachtungs-IDs, keine behaupteten lokalen Screenshot-Dateien.
