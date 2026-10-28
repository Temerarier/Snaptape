# SnapTape: Trial-Oberfläche – Abnahme

Stand: 28. Oktober 2026. Keine neuen Modelle, Zahlungen, E-Mails oder
serverseitige PDF-Erzeugung. Keine Änderung an Messformeln, 3D-Geometrie,
Credit-Buchungen, Effort oder Tokenlimits.

## Umsetzung

- `/`: englische, servergerenderte Landingpage für anonyme Besucher. Angemeldete
  Nutzer werden weiterhin nach `/app` geleitet. Vorgegebene Texte, Reihenfolge,
  Beispielpreise und ausschließlich die erlaubten Haus-Beispielwerte.
- `/legal/notice`, `/legal/privacy`, `/legal/terms`: sichere Darstellung der
  Markdown-Dateien aus `docs/legal/`, mit unveränderten Platzhaltern.
- Gemeinsamer Footer auf Landingpage, Anmeldung, App und Rechtstextseiten.
  Ein zusätzlicher AGB-Link steht direkt beim Startknopf im Upload.
- Öffentliche Seiten laden keinen Clerk-Client. Übergänge zwischen öffentlichen
  Seiten und Anmeldung erfolgen als vollständige Navigation, damit Next.js nicht
  das falsche Root-Provider-Layout aus einem früheren Seitenwechsel beibehält.
- `/app/projekt/[id]/print`: eigentümer- bzw. staffgeschütztes, eigenständiges
  HTML-Messblatt. Verwendet die vorhandene Messvorbereitung und Viewer-Karten:
  keine zweite Berechnung. Kein App-/RSC-Datenpaket, Modellname oder Kostenblock.
- Druckknöpfe im Projektüberblick und im Viewer öffnen ein neues Fenster.
  Standardmäßig einmaliger Druckaufruf nach Laden; `?preview=1` unterbindet nur
  den automatischen Aufruf. Der manuelle Druckknopf bleibt verfügbar.
- Druck-CSS: weißer Hintergrund, Tabellen, Abschnittsumbrüche, keine Navigation
  und Knöpfe, Seitenzahlen über CSS-Seitenränder, soweit vom Browser unterstützt.
- „Add photo“ im Viewer-Kopf und in einer nicht erfassten Fassadenzeile verwenden
  das vorhandene Projekt-Upload-Ziel statt einer Hinweismeldung.
- Mobile CSS begrenzt die Kopfzeile und reserviert im WebGL-Ausfallzustand
  rechts Platz für die schwebenden Bedienelemente. Keine Renderer-Änderung.

## Automatische Prüfungen

- `pnpm typecheck`: bestanden.
- `pnpm test`: **432 Tests in 49 Dateien bestanden**.
- Produktionsbuild: bestanden, einschließlich erneutem Build nach der letzten
  mobilen CSS-Korrektur.
- Lighthouse 13.0.1 im Dev-Preview, Kategorie Accessibility: **96/100**.
  Es bleibt ein Farbkontrast-Hinweis; die geforderte Mindestwertung 90 ist erfüllt.
- Web-Workflow nach Änderungen neu gestartet, Anwendung erreichbar.
- Ledger-Abgleich: weiterhin **8 Einträge**, identische Prüfsumme
  `41d7513674fe1d0908393c987098a205`.

## Browserabnahme

- Anonyme Landingpage HTTP 200, ein H1, alle geprüften SSR-Abschnitte vorhanden.
  Rechtstextseiten HTTP 200; Platzhalter und Footerlinks vorhanden.
- Kein beobachteter externer Clerk-Script-Tag bzw. Script-Request auf den
  öffentlichen Seiten. Ein erstmaliger Clerk-Request war eine Dokumentnavigation,
  kein geladenes Script.
- Anmeldung funktioniert; angemeldeter Eigentümer landet von `/` auf `/app`.
- Eigentümer und Staff können das Messblatt lesen; fremder Nutzer erhält 404,
  anonyme Besucher werden zur Anmeldung geleitet.
- Der reale Viewer-Kopfknopf führt zum richtigen Upload, ohne Upload oder
  Messung zu starten.
- Die Fassaden-CTA war in den vorhandenen realen Projekten nicht vorhanden.
  Deshalb zusätzlich ein gezielter Komponententest mit der unveränderten
  Produktionskomponente und einer ausdrücklich synthetischen „nicht erfasst“-
  Zeile: sowohl Kopfknopf als auch der Klickhandler der tatsächlichen Zeile
  rufen dasselbe Projekt-Upload-Ziel auf. Zwei Komponententests bestanden;
  kein behaupteter Browserklick auf eine reale fehlende Fassade.
- Garage-House: **9 Karten, 188 formatierte Einträge einschließlich zweier leerer
  Einheiten; 186/186 nichtleere Einträge** im erweiterten Viewer und Druckblatt
  als Multimenge identisch.
- Druckaufruf: Standard einmal automatisch, Vorschau nicht automatisch,
  manueller Knopf einmal. Browserdruck: **12 Letter-Seiten**.
- Extrahierter PDF-Text ohne die geprüften Modell-/Credit-/Kostentokens,
  Druckknöpfe und rechtliche Navigationslinks. Erste PDF-Seite visuell geprüft.
- Breitenvergleich bei 375/390 px: Landingpage, Anmeldung, alle drei
  Rechtstextseiten, Messblatt und Viewer ohne horizontalen Überlauf.
  SwiftShader konnte auf dem echten Projekt einen WebGL-Kontext erzeugen; die
  normale Viewer-Breite bestand ebenfalls. Keine neue geometrische Abnahme behauptet.
- Im ersten Durchgang überdeckten schwebende Knöpfe den WebGL-Hinweis trotz
  korrekter Gesamtbreite. Anschließend nur per CSS korrigiert.
  Fokussierte Browser-Nachprüfung bestanden: vollständiger Text vorhanden,
  keine Überschneidung der Text-Range-Rechtecke mit den vier Schaltflächen.
  Bei 375 px Viewport: Scroll-/Clientbreite **360/360**, bei 390 px:
  **375/375**; die Differenz zur Viewportbreite ist die vertikale Scrollbar.
  Belege in `browser-results.json` und den beiden korrigierten PNGs.

Die Garage-House-Druckbelege stammen vom **Produktionsrenderer mit der
Testfixture**, nicht von einem neu angelegten Datenbankprojekt. Keine Testdaten
wurden in die Datenbank geschrieben.

## Klassifizierungsmodell

Read-only-Abfrage von Anthropic `GET /v1/models`:
Der Kurzname `claude-sonnet-4-5` ist nicht selbst der Listeneintrag.
`GET /v1/models/claude-sonnet-4-5` löst ihn jedoch erfolgreich auf
`claude-sonnet-4-5-20250929` auf, das in der Modellliste enthalten ist.
Damit ist die konfigurierte Modellkennung weiterhin verfügbar.

**Service unverändert, kein Modellwechsel, keine Klassifizierung und kein
kostenpflichtiger Vergleichslauf gestartet.** Ergebnis in
`classification-model.json`, Generierungsaufrufe: 0.

## Begrenzte Hydrierungsdiagnose

Auf einer bestehenden fehlgeschlagenen Projektansicht bei 375 px wurde eine
React-Warnung in `AppLayout > HeaderSuche` beobachtet: leeres
`style={{}}`-Attribut auf der Serverseite der Hydrierungsprüfung, im
React-Client nicht gesetzt. Der Quellcode dieses Suchfelds setzt kein
Inline-`style`. Eine Ursache durch Datum oder Locale ist damit nicht belegt.

Der Ursprung des zusätzlich beobachteten Attributes wurde nicht sicher
nachgewiesen. Keine pauschale Unterdrückung mit `suppressHydrationWarning` und
kein Refactoring auf Verdacht. Die Warnung gilt ausdrücklich **nicht als behoben**.
Die genaue Beobachtung und ein eventueller Roh-HTML/DOM-Abgleich werden im
Browserprotokoll festgehalten.

## Rechtstext-Provenienz und Freigabegrenze

Die drei Vorlagentexte wurden wortgetreu einschließlich der ursprünglichen
Zeilenumbrüche und eckigen Platzhalter übernommen. SHA-256:

- `notice.md`: `29f6dcc76a890828da81cdfb1a71b57d79a0c1bdce0d3b16713c95c5aa324b33`
- `privacy.md`: `ce51317030d2f1d3244d4e4cce22d0ae0ce6620238dc80e6d9ff0fb9ceccd29f`
- `terms.md`: `e51b3663dce49012fce297bba235db58e272feea6c92e6adcdcc880ed67bcae6`

**Keine juristische Freigabe.** Vor öffentlicher Kundennutzung müssen insbesondere
Kontakt-/Register-/Datumsplatzhalter ergänzt und Aussagen zu Authentifizierung,
Cookies, US-Speicherung, Löschung, Backups und Aufbewahrung am tatsächlichen
Betrieb überprüft werden. Die Texte bleiben auftragsgemäß unveränderte Entwürfe;
vor bezahlter Nutzung ist anwaltliche Prüfung vorgesehen.

## Belege

Unter `generated-artifacts/trial-readiness/` (nicht im Git/Deployment):
`browser-results.json`, `lighthouse-accessibility.json`, `classification-model.json`,
Landingpage-Screenshots 1440/390, AGB 390, Garage-House-Druckvorschau 1440,
Browser-PDF und erste PDF-Seite. Die Fixture-HTML-Dateien sind ausschließlich
Abnahmebelege, keine öffentliche Sample-Report-Seite.
