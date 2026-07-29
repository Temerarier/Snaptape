// Extraktor der Messpipeline: Standard ist die echte LLM-Extraktion
// (echterExtraktor.ts). Der alte Stub bleibt hinter dem Dev-Schalter
// EXTRAKTOR_STUB=1 erhalten (feste Wartezeit, v1.5-Fixture) – nützlich
// für UI-Tests ohne Modellkosten.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectClassification, ProjectFile } from "@workspace/db";
import {
  bestimmeRoute,
  extrahiereEcht,
  type ExtraktionsErgebnis,
} from "./echterExtraktor";
import type { NutzerReferenz } from "./prompts";

export interface ExtraktorOptionen {
  quality: "standard" | "premium";
  referenz: NutzerReferenz | null;
}

export type { ExtraktionsErgebnis };

// Vertrag: bekommt Dateien + Klassifizierung, liefert rohes (noch
// unvalidiertes) Measurement-JSON samt Lauf-Metadaten oder wirft.
export type Extraktor = (
  dateien: ProjectFile[],
  klassifizierung: ProjectClassification,
  optionen: ExtraktorOptionen,
) => Promise<ExtraktionsErgebnis>;

const STUB_VERZOEGERUNG_MS = 10_000;
const FIXTURE_DATEI = "garage-house.json";

// Fixture liegt im Repo-Root unter fixtures/; der Next-Prozess läuft je
// nach Start-Art mit cwd = Artefakt-Ordner oder Repo-Root.
function ladeFixture(): unknown {
  const kandidaten = [
    join(process.cwd(), "fixtures", FIXTURE_DATEI),
    join(process.cwd(), "..", "..", "fixtures", FIXTURE_DATEI),
  ];
  const pfad = kandidaten.find((k) => existsSync(k));
  if (!pfad) {
    throw new Error(
      `Extractor fixture not found (looked in: ${kandidaten.join(", ")})`,
    );
  }
  return JSON.parse(readFileSync(pfad, "utf8"));
}

const stubExtraktor: Extraktor = async (
  _dateien,
  klassifizierung,
  _optionen,
) => {
  await new Promise((aufloesen) => setTimeout(aufloesen, STUB_VERZOEGERUNG_MS));
  let fixture = ladeFixture();

  // Testschalter: EXTRAKTOR_STUB_KAPUTT=1 liefert absichtlich invalides
  // JSON, um den failed-Pfad der Pipeline durchzuspielen.
  if (process.env.EXTRAKTOR_STUB_KAPUTT === "1") {
    const kaputt = structuredClone(fixture) as Record<string, unknown>;
    delete kaputt.faces;
    fixture = kaputt;
  }
  return {
    roh: fixture,
    model: "stub",
    route: bestimmeRoute(klassifizierung),
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    retryUsed: false,
    repairUsed: false,
    zusammenfassung: "stub fixture",
  };
};

export const standardExtraktor: Extraktor = async (
  dateien,
  klassifizierung,
  optionen,
) => {
  if (process.env.EXTRAKTOR_STUB === "1") {
    return stubExtraktor(dateien, klassifizierung, optionen);
  }
  return extrahiereEcht(dateien, klassifizierung, optionen);
};
