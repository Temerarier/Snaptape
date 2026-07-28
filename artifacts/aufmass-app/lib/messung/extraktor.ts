// Extraktor für die Messpipeline (Etappe 2, Skelett): austauschbare
// Schnittstelle, damit die echte LLM-Extraktion später nur diese eine
// Funktion ersetzen muss. Der Stub liefert nach fester Wartezeit das
// v1.5-Fixture aus dem Repo – keine echte Messung.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectClassification, ProjectFile } from "@workspace/db";

export interface ExtraktorOptionen {
  quality: "standard" | "premium";
}

// Vertrag: bekommt Dateien + Klassifizierung, liefert rohes (noch
// unvalidiertes) Measurement-JSON oder wirft einen Fehler.
export type Extraktor = (
  dateien: ProjectFile[],
  klassifizierung: ProjectClassification,
  optionen: ExtraktorOptionen,
) => Promise<unknown>;

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

export const standardExtraktor: Extraktor = async (
  _dateien,
  _klassifizierung,
  _optionen,
) => {
  await new Promise((aufloesen) => setTimeout(aufloesen, STUB_VERZOEGERUNG_MS));
  const fixture = ladeFixture();

  // Testschalter: EXTRAKTOR_STUB_KAPUTT=1 liefert absichtlich invalides
  // JSON, um den failed-Pfad der Pipeline durchzuspielen.
  if (process.env.EXTRAKTOR_STUB_KAPUTT === "1") {
    const kaputt = structuredClone(fixture) as Record<string, unknown>;
    delete kaputt.faces;
    return kaputt;
  }
  return fixture;
};
