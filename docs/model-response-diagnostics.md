# Diagnose von Modellantworten

## Verhalten

Eine abgeschlossene Modellantwort wird auch dann protokolliert, wenn sie keinen
Text enthält. Die Anbindung übernimmt ausschließlich folgende Metadaten:

- Antwort-ID, tatsächliches Antwortmodell und Abbruchgrund (`stop_reason`).
- Inhaltstypen in ihrer Reihenfolge, **keine Inhalte**.
- Input-/Output-Tokens und vorhandene Cache-Tokenzahlen.
- Extraktionsphase: `extract`, `retry` oder `repair`.
- Konfigurierter Effort und Kennzeichnung vollständiger/unvollständiger Usage.

Keine Prompts, Fotos, Base64-Bilddaten, Antworttexte, Thinking-Texte oder
Signaturen werden in diesen Diagnoseblock übernommen.

Die Metadaten bleiben bei Fehlern im ersten Aufruf, Retry, Repair, JSON-Parsing
und anschließender Berechnung erhalten. Bei einer fehlgeschlagenen Antwort ohne
Text werden vorhandene Tokens addiert und die bisherige Kostenschätzung
weiterverwendet. Kein zusätzlicher Retry wurde eingeführt.

Bei einem Verbindungsfehler ohne abschließende Antwort bleiben Gesamttokens und
Gesamtkosten **null/unbekannt**. Schon vorhandene Antworten mit ihren bekannten
Tokenzahlen bleiben einzeln erhalten; ihre Teilsumme wird nicht als vollständiger
Gesamtverbrauch ausgegeben. Kostenschätzungen bleiben Schätzungen, keine
Anbieterrechnungen; intern vom SDK wiederholte/verlorene Anfragen lassen sich
daraus nicht vollständig abrechnen.

## Speicherung und Anzeige

Ein zusätzliches nullable JSONB-Feld `measure_runs.model_diagnostics` speichert
den strukturierten Diagnoseblock. Die Entwicklungsschema-Änderung ist angewendet.
Bestehende Einträge bleiben unverändert/null; verlorene historische Metadaten
lassen sich dadurch nicht nachträglich rekonstruieren.

Staff kann den Block unter **Admin → Measurements → Model response diagnostics**
bzw. **Diagnose der Modellantworten** aufklappen. Bei unvollständiger Usage wird
ausdrücklich auf unbekannte Gesamttokens/Kosten hingewiesen. Die bestehende
Staff-Prüfung bleibt erhalten; die Diagnosedaten werden nicht in die
Kundenfehlermeldung übernommen.

Modell, Effort, `max_tokens=64000`, Preise, Prompt-Texte, Schema 1.8, Viewer und
Credit-Regeln wurden nicht verändert. Fehlgeschlagene aktuelle Messungen werden
weiterhin genau einmal erstattet.

## Verifikation ohne bezahlte Aufrufe

- `pnpm typecheck`: bestanden.
- `pnpm test`: **37 Dateien / 352 Tests bestanden**.
- Produktionsbuild: bestanden.
- Drei echte PostgreSQL-Roundtrips: vollständige Diagnose, unvollständige Usage,
  nullable Alteintrag. Sämtliche künstlichen Daten wurden zurückgerollt.
- **0 echte Modellaufrufe**, keine Test-Credits abgebucht.

Reproduzierbarer Datenbanktest:

```sh
pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json artifacts/aufmass-app/scripts/verify-model-diagnostics.ts
```

Ergebnis:

```json
{"postgresRoundtripsPassed":3,"syntheticRowsRolledBack":true,"realModelCalls":0}
```

Simulierte Fälle: normale/multiple Textblöcke; nur Thinking; leere Inhaltsliste;
redacted_thinking; verschiedene Abbruchgründe; Fehler beim ersten Aufruf, Retry
oder Repair; Parse-/Berechnungsfehler; Netzwerkfehler vor/nach bekannten Antworten;
unveränderte Erstattungs-Guards; keine vertraulichen Inhalte in der Diagnose.

Diese Prüfungen belegen die Diagnose- und Speicherstrecke, **nicht** die Ursache
des früheren Opus-Fehlers oder einen erfolgreichen echten Messlauf. Für einen
weiteren bezahlten Test ist eine ausdrückliche Freigabe erforderlich.
