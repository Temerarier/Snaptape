# Schema 1.8 / Messprompts 1.8.3 — Abnahme

Stand: 28.10.2026.

## Umsetzung

- Schema 1.8 und die drei Extraktionsprompts unverändert aus
  `variante-a-paket/` übernommen.
- Die fünf `messung.json` aus dem Paket unverändert unter
  `test-fixtures/variante-a/<name>/` übernommen. Keine BuildHouse-/Viewer-Integration.
- `baueSystemText` und `baueRepairSystemText` verwenden Schema 1.8.
- Im Repair-Prompt ausschließlich die Platzhalterzeile von `__SCHEMA_V1_7__`
  auf `__SCHEMA__` geändert; der vorhandene Laufzeit-Kommentar blieb unverändert
  und wird weiterhin nicht Teil des erzeugten Prompts.
- Validator unterstützt jetzt 1.6, 1.7 und 1.8. Keine gespeicherten Messdaten
  migriert oder umgeschrieben.
- Modell-/Effort-Konfiguration, Pipeline-Ablauf, Extraktor, Null-Heilung,
  `buildModel`, `computeDerived`, Referenzkatalog und Credits unverändert.

## Byte-Identität

Die folgenden tatsächlichen Befehle erzeugten jeweils **keine Diff-Ausgabe**:

```sh
diff -u variante-a-paket/shared/schema/measurement-v1.8.json shared/schema/measurement-v1.8.json
diff -u variante-a-paket/docs/pipeline/extract-photo-prompt.md docs/pipeline/extract-photo-prompt.md
diff -u variante-a-paket/docs/pipeline/extract-plan-prompt.md docs/pipeline/extract-plan-prompt.md
diff -u variante-a-paket/docs/pipeline/extract-mixed-prompt.md docs/pipeline/extract-mixed-prompt.md
```

Auch die fünf kopierten Mess-Fixtures sind byte-identisch; die Tests vergleichen
ihre Bytes mit den Quelldateien. SHA-256-Vorher/Nachher-Prüfung bestätigte darüber
hinaus unveränderte Modell-, Pipeline-, Extraktor-, Null-Heilungs-, Viewer- und
Credit-Quelldateien sowie den Referenzkatalog.

## Erzeugte Prompts

Für `photo`, `plan` und `mixed`, jeweils ohne optionales Nutzerreferenzmaß:
Der erzeugte Systemtext endet mit dem **vollständigen, unveränderten Schema 1.8**.
Die bisherige Behandlung eines optionalen Nutzerreferenzmaßes bleibt erhalten.
Der Repair-Systemtext enthält ebenfalls das vollständige Schema 1.8 und keinen
unersetzten Schema-Platzhalter.

Die tatsächlich ausgegebenen ersten 200 Zeichen für `photo`:

```text
COMPLETENESS CONTRACT: your JSON must enumerate EVERY individually visible face, edge, opening, attachment and downspout across ALL photos - a partial, sampled or summarized list is a WRONG answer. Co
```

Die tatsächlich ausgegebenen letzten 200 Zeichen:

```text
  ]
        }
      }
    },
    "measurement_or_null": {
      "oneOf": [
        {
          "$ref": "#/$defs/measurement"
        },
        {
          "type": "null"
        }
      ]
    }
  }
}
```

Maschinenlesbarer Nachweis: `docs/schema18-verification.json`.

## Fixtures und Regressionen

| Fixture | Schema 1.8 gültig | computeDerived | buildModel, zusätzliche massing-Daten ignoriert |
| --- | --- | --- | --- |
| farmhouse-140040rk | Ja | bestanden | bestanden |
| farmhouse-test5-beispiel | Ja | bestanden | bestanden |
| leipzig-villa | Ja | bestanden | bestanden |
| triplex-40014db | Ja | bestanden | bestanden |
| tudor-93233el | Ja | bestanden | bestanden |

Zusätzlich geprüft:

- `parseTolerant` erhält das vollständige Messobjekt einschließlich `massing`.
- Heilung eines unabhängigen Null-Felds verändert gültiges `massing` nicht.
- Pipeline-Protokoll speichert `massing` und die deklarierte Version 1.8.
  Die Projektmessung wird im unveränderten Produktcode weiterhin als vollständiges
  Objekt übernommen, nicht feldweise zusammengestellt.
- `computeDerived` verändert keine Messdaten; mit und ohne den zusätzlichen
  `massing`-Schlüssel entstehen identische bisherige Ableitungen.
- `buildModel` bleibt unverändert und liefert ebenfalls identische bisherige
  Geometrie mit und ohne diesen zusätzlichen Schlüssel. Das ist keine Umsetzung
  des neuen Variante-A-Modellbauers.

## Abschlussprüfungen

- `pnpm typecheck`: bestanden.
- `pnpm test`: **36 Testdateien, 336 Tests bestanden**.
- Produktionsbuild: bestanden, Next.js 15.5.20.
- `git diff --check`: bestanden.
- Web-Workflow nach der zusammenhängenden Änderung neu gestartet.
- Keine weitere bezahlte Messung für Schema 1.8 gestartet; die optionale
  Modell-Abnahme ist ausdrücklich **nicht** als bestanden ausgewiesen.

## Ergebnis des zuvor freigegebenen Opus-Tests

Dieser Lauf wurde **vor** der Umstellung noch mit den bisherigen Prompts /
Schema 1.7 gestartet. Er ist kein Schema-1.8-Abnahmetest.

- Modell: `claude-opus-5-5`.
- Effort: `medium`.
- Dauer: 700305 ms, ungefähr 11 Minuten 40 Sekunden.
- Ausgang: failed.
- Gemeldeter Fehler: `Anthropic API returned no text content.`
- Input-/Output-Tokens und Kosten: nicht gespeichert, daher unbekannt/null.
- Ein abgebuchter Credit wurde automatisch genau einmal erstattet.
  Guthaben des isolierten Testkontos wieder 2.
- Kein weiterer Modellaufruf wurde zur Untersuchung oder Schema-Abnahme gestartet.

Der Fehler belegt, dass die bisherige Anbindung keinen Text aus der Modellantwort
erhielt. Der genaue Anbieter-Stopgrund wurde nicht aufgezeichnet; daraus werden
weder ein erfolgreicher Messabschluss noch Nullkosten abgeleitet.
Die Modell-Anbindung bleibt gemäß Auftrag unangetastet.

Maschinenlesbarer Lauf-/Ledger-Nachweis:
`docs/credits-real-retry-verification.json`.
