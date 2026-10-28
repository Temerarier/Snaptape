# Interne Schritt-2-Übersicht

## Umsetzung

- `/admin/measurements`: zusätzliche Spalten 3D, Korrektur, Modell Schritt 2,
  Kosten Schritt 2 und Kosten gesamt. Die bestehende Zeile je Messlauf bleibt
  erhalten; 3D-Status und Gesamtkosten beziehen sich auf das jeweilige Projekt.
- GET-Filter `model3d=issues`: nur aktuelle 3D-Stufen `merken` oder `stopp`.
  `pending` übersteuert mögliche ältere Warnungen.
- `/admin/projekt/[id]`: neue serverseitig staffgeschützte 3D-Prüfung mit
  gruppierten Checkzeilen, Zählern, den drei Ergänzungs-/Konflikt-/Nicht-gebaut-
  Listen sowie dem standardmäßig eingeklappten Code des letzten Versuchs.
- `/admin/users`: unveränderte Schritt-1-Summe plus neue Gesamtkostenspalte,
  einschließlich aller gespeicherten Modellversuche.
- Kosten werden unabhängig je Schritt aggregiert und erst danach addiert.
  Dadurch keine Vervielfachung durch mehrfach passende Run-Zeilen.
  Fehlende Kosten werden als `≥ … (unvollständig)` kenntlich gemacht.
- Keine neuen Modellaktionen oder Modellumschalter, keine Änderungen an
  Modellen, Effort, Prüfgrenzen, Schema oder Credit-Ledger.
- Die bisherigen Cleanup-Aufrufe wurden aus den zwei Übersichtsseiten
  entfernt, damit ein lesender Aufruf keine Projektänderung oder Erstattung
  auslöst. Die bestehende explizite Guthabenbuchung wurde nicht verändert.

## Automatische Prüfung

- `pnpm test`: **413 Tests / 45 Dateien bestanden**.
- Produktionsbuild mit Typprüfung erfolgreich.
- Tests für Kosten mehrerer Versuche einschließlich Korrektur, unbekannte
  Kosten, Pending-/Unavailable-/Altprojektstatus und alle drei Checkgruppen.
- Der Nicht-Staff-Unit-Test verweigert die neue Projektseite **vor jeder
  Datenbankabfrage**.
- Server-Render-Test bestätigt gruppierte Zeilen, Zähler, Listen und
  standardmäßig geschlossenen Codeblock. Unvertrauenswürdiger Code wird als
  escapeter Text angezeigt, nicht als HTML oder ausführbares Skript.

## Echtes gespeichertes Projekt

Projekt `8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a`, ausschließlich gelesen:

| Merkmal | Gespeicherter Wert |
|---|---|
| 3D-Status / Stufe | ready / merken |
| Modell | claude-opus-5-5 |
| Anzahl Modellversuche | 1 |
| Kosten Schritt 1 | 2,003236 USD |
| Kosten Schritt 2 | 1,219384 USD |
| Kosten gesamt | 3,222620 USD |
| IDs gebaut / nicht gebaut / fehlen | 61 / 2 / 0 |
| Kanten | 37/37 gebaut, 35 passend |
| Fallrohre | 4/4 |
| Schadensflächen | 2/2 |
| Fehler / Warnungen | 0 / 11 |

Für das zugehörige Konto über alle gespeicherten Projekte: Schritt 1
3,460772 USD, Schritt 2 1,219384 USD, zusammen 4,680156 USD.
Dies sind gespeicherte geschätzte Laufkosten, keine abgeglichene
Anbieterrechnung und keine Credit-Buchungen.

Die Vorher-/Nachher-Prüfung läuft über
`scripts/inventory/admin-model3d-verify.ts` in einer explizit lesenden
DB-Transaktion. Rohbelege liegen im ignorierten Verzeichnis
`generated-artifacts/admin-model3d/`; es werden keine Kundennamen,
E-Mail-Adressen oder KI-Codeinhalte in den Beleg exportiert.

## Browserprüfung

Die Staff-Ansicht wurde mit der bereits freigegebenen Testidentität im selben
Browserprüfer geprüft:

- Echte Projektzeile: `merken`, Korrektur `no`, gespeichertes Modell,
  Schritt-2-Kosten `$1.219`, Gesamtkosten `$3.223`.
- Filter setzen per Checkbox und Anwenden: URL `model3d=issues`, genau eine
  passende Zeile, ausschließlich `merken` / `stopp`. Abwählen und Anwenden
  stellt die ungefilterte Liste wieder her.
- Der zusätzliche „Alle“-Link wird als normaler GET-Link ausgeführt, damit
  beim Zurücksetzen auch der unkontrollierte Checkboxzustand frisch geladen
  wird. Ein vorheriger clientseitiger Navigationsversuch war nicht zuverlässig.
- Detail: `stopp (0)`, `merken (11)`, `info (22)`, Check-IDs, Prüfnamen und
  Texte; alle oben dokumentierten Zähler sowie Ergänzungen 8, Konflikte 25,
  Nicht-gebaut 2.
- KI-Code anfangs geschlossen, nach Öffnen lesbares `function buildHouse`,
  nicht ausgeführt.
- Nutzerübersicht zeigt beim echten Projektkonto `$3.46` für Schritt 1 und
  `≥ $4.680 (partial)` gesamt. Das Konto hat mindestens einen Lauf mit
  unbekannten Kosten; 4,680156 USD ist daher der bekannte Teil, nicht eine
  behauptete vollständige Anbieterrechnung.
- Bestehendes Nicht-Staff-Konto: 404 auf Liste, gefilterter Liste,
  Projektdetail und Nutzerübersicht. Keine privaten Bericht-/Codefelder in
  den Antworten.
- Bestehender Kunde: eigener Viewer weiterhin 200 mit Messwerten und
  A-Modellquelle, keine Modellberichte, Codefelder oder buildHouse-Quelle im
  ausgelieferten HTML.
- Keine Testkonten/-projekte erzeugt, keine Projekt-/Kosten-/Ledgerdaten
  geändert, keine Modell-/Anbieteraufrufe und keine Credit-Formularaktionen.

Screenshot-Nachweise des Prüfers: `yjhmmq` (Liste), `t8x0v7` (Filter),
`jwtgxs` (Checkgruppen), `0y8t97` (Code geschlossen), `k38xxg` (Code offen),
`vzbdp9` (Nutzerkosten, Identifikatoren unkenntlich), `c3vfwm` (Nicht-Staff-404).

## Schreibschutz-Nachweis

Vor und nach der Browserprüfung identisch:

- Credit-Ledger: **8 Zeilen**.
- Digest über alle Ledger-Zeilen:
  `41d7513674fe1d0908393c987098a205`.
- Echte Projektkosten, Modellversuchsanzahl und Prüfwerte unverändert.
- SQL-Nachprüfung in `BEGIN READ ONLY`; keine Modell-/Anbieteraufrufe.

Nach Umstellung des zusätzlichen Reset-Links auf normales GET wurde der
Produktionsbuild einschließlich Typprüfung erneut erfolgreich abgeschlossen.
Die Änderung betrifft ausschließlich die Navigation zum ungefilterten
Listenpfad; der im Browser geprüfte Checkbox-/Anwenden-Filter bleibt unverändert.
