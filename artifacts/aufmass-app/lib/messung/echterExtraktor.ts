// Echte LLM-Extraktion (ersetzt den Stub): routet nach Upload-Typ,
// baut den Aufruf (Prompt verbatim + Katalog + Schema + optionale
// Nutzer-Referenz + Bilder mit Markern), parst tolerant, erlaubt EINEN
// Degeneriert-Retry und EINEN Repair-Aufruf, konsolidiert per
// portiertem compute.js und prüft per validate-assemble.js.
// Es gibt exakt drei mögliche LLM-Aufrufe: extract, (retry), (repair).
import type {
  FileClassificationEntry,
  ProjectClassification,
  ProjectFile,
} from "@workspace/db";
import { ladeObjekt } from "@/lib/storage/objectStorage";
import { verkleinereFuerKI } from "@/lib/upload/verarbeitung";
import {
  berechneKonsolidierung,
  validiereUndAssembliere,
} from "./berechnung";
import {
  MODELL_IDS,
  rufeExtraktionsModell,
  schaetzeKostenUsd,
  type BildTeil,
  type Qualitaet,
} from "./modelle";
import {
  baueRepairSystemText,
  baueSystemText,
  REPAIR_AUSGABE_MARKER,
  REPAIR_MAX_ZEICHEN,
  REPAIR_VORTEXT,
  type MessRoute,
  type NutzerReferenz,
} from "./prompts";

export interface ExtraktionsErgebnis {
  roh: unknown;
  model: string;
  route: MessRoute;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  retryUsed: boolean;
  repairUsed: boolean;
  // Warnungen aus validate-assemble (violations sind bereits in
  // quality.warnings gespiegelt; valid=false heißt trotzdem weiter zur
  // Ajv-Validierung – die entscheidet über model_ready/failed).
  zusammenfassung: string;
}

// Fehler der Extraktion, der die bis dahin angefallenen Metadaten
// (Modell, Route, Tokens, Kosten, Retry/Repair) mitführt – damit auch
// gescheiterte (und gerade die teuren) Läufe vollständig protokolliert
// werden.
export class ExtraktionsFehler extends Error {
  constructor(
    message: string,
    public readonly meta: Omit<ExtraktionsErgebnis, "roh" | "zusammenfassung">,
  ) {
    super(message);
    this.name = "ExtraktionsFehler";
  }
}

// Route strikt aus dem Klassifizierungs-Ergebnis (photo/plan/mixed).
export function bestimmeRoute(
  klassifizierung: ProjectClassification,
): MessRoute {
  const typ = klassifizierung.projectType;
  if (typ === "photo" || typ === "plan" || typ === "mixed") return typ;
  throw new Error(`Unbekannter projectType für Routing: ${String(typ)}`);
}

// Bildeinheiten: NUR nutzbare, für die Messung ausgewählte Fotos/Seiten
// (Klassifizierungs-Filter, max. 15 Planseiten bereits dort erzwungen).
// PDF-Seiten IMMER als vorgerenderte PNGs, nie das rohe PDF.
async function baueBildTeile(dateien: ProjectFile[]): Promise<BildTeil[]> {
  const geordnet = [...dateien].sort((a, b) => a.sortOrder - b.sortOrder);
  const teile: { marker: string; objectPath: string; endung: string }[] = [];
  let fotoNr = 0;
  for (const datei of geordnet) {
    const eintraege: FileClassificationEntry[] = datei.classification ?? [];
    if (datei.kind === "photo") {
      fotoNr += 1;
      const gewaehlt = eintraege.some((e) => e.selectedForMeasurement);
      if (!gewaehlt) continue;
      const endung = datei.originalName
        .slice(datei.originalName.lastIndexOf(".") + 1)
        .toLowerCase();
      teile.push({
        marker: `photo ${fotoNr}`,
        objectPath: datei.storagePath,
        endung,
      });
    } else {
      const seiten = datei.pageImagePaths ?? [];
      for (const eintrag of eintraege) {
        if (!eintrag.selectedForMeasurement) continue;
        const pfad = seiten[eintrag.page - 1];
        if (!pfad) {
          throw new Error(
            `PDF ${datei.originalName}: gerenderte Seite ${eintrag.page} fehlt.`,
          );
        }
        teile.push({
          marker: `${datei.originalName}, page ${eintrag.page}/${seiten.length}`,
          objectPath: pfad,
          endung: "png",
        });
      }
    }
  }
  if (teile.length === 0) {
    throw new Error("Keine für die Messung ausgewählten Bilder vorhanden.");
  }
  const bilder = await Promise.all(
    teile.map(async (t) => {
      const original = await ladeObjekt(t.objectPath);
      const jpeg = await verkleinereFuerKI(original, t.endung);
      return { marker: t.marker, jpegBase64: jpeg.toString("base64") };
    }),
  );
  return bilder;
}

// TRIAGE FACTS aus der Klassifizierung – die Prompts referenzieren sie
// (depth_basis, occluded_percent je Datei).
function baueTriageFakten(
  klassifizierung: ProjectClassification,
  dateien: ProjectFile[],
): string {
  const proEinheit = dateien.flatMap((d) =>
    (d.classification ?? [])
      .filter((e) => e.selectedForMeasurement)
      .map((e) => ({
        file: d.originalName,
        page: e.page,
        class: e.class,
        elevation: e.elevation,
        occluded_percent: e.occludedPercent,
        has_dimensions: e.hasDimensions,
      })),
  );
  return (
    "TRIAGE FACTS (stage 1 result):\n" +
    JSON.stringify(
      {
        project_type: klassifizierung.projectType,
        depth_basis: klassifizierung.depthBasis,
        expected_accuracy: klassifizierung.expectedAccuracy,
        reference_objects_found: klassifizierung.referenceObjectsFound,
        images: proEinheit,
      },
      null,
      1,
    )
  );
}

// Toleranter Parse: Markdown-Zäune entfernen; falls nötig führendes "{"
// voranstellen; sonst den Block vom ersten "{" bis zum letzten "}".
export function parseTolerant(text: string): unknown {
  const bereinigt = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const kandidaten = [bereinigt];
  if (!bereinigt.startsWith("{")) kandidaten.push(`{${bereinigt}`);
  const von = bereinigt.indexOf("{");
  const bis = bereinigt.lastIndexOf("}");
  if (von >= 0 && bis > von) kandidaten.push(bereinigt.slice(von, bis + 1));
  let letzterFehler = "";
  for (const kandidat of kandidaten) {
    try {
      const wert = JSON.parse(kandidat);
      if (wert && typeof wert === "object" && !Array.isArray(wert)) {
        return wert;
      }
      letzterFehler = "parsed value is not a JSON object";
    } catch (fehler) {
      letzterFehler = fehler instanceof Error ? fehler.message : String(fehler);
    }
  }
  throw new Error(`response is not parseable JSON: ${letzterFehler}`);
}

// Degeneriert = leer oder offensichtlich absurd: keinerlei Flächen,
// Kanten UND Öffnungen. (Feinere Plausibilität prüft validate-assemble.)
function istDegeneriert(roh: unknown): boolean {
  const r = roh as Record<string, unknown>;
  const laenge = (k: string) => (Array.isArray(r[k]) ? (r[k] as unknown[]).length : 0);
  return laenge("faces") === 0 && laenge("edges") === 0 && laenge("openings") === 0;
}

export async function extrahiereEcht(
  dateien: ProjectFile[],
  klassifizierung: ProjectClassification,
  optionen: { quality: Qualitaet; referenz: NutzerReferenz | null },
): Promise<ExtraktionsErgebnis> {
  const route = bestimmeRoute(klassifizierung);
  const system = baueSystemText(route, optionen.referenz);
  const bilder = await baueBildTeile(dateien);
  const triage = baueTriageFakten(klassifizierung, dateien);
  const model = MODELL_IDS[optionen.quality];

  let inputTokens = 0;
  let outputTokens = 0;
  let retryUsed = false;
  let repairUsed = false;

  const rufeAb = async (temperature: number) => {
    const antwort = await rufeExtraktionsModell(optionen.quality, {
      system,
      userText: triage,
      bilder,
      temperature,
    });
    inputTokens += antwort.inputTokens;
    outputTokens += antwort.outputTokens;
    return antwort.text;
  };

  // 1. Extraktion; degenerierte Ausgabe → EIN Retry mit frischem Sampling.
  let text = await rufeAb(0.2);
  let roh: unknown | null = null;
  let parseFehler: string | null = null;
  try {
    roh = parseTolerant(text);
  } catch (fehler) {
    parseFehler = fehler instanceof Error ? fehler.message : String(fehler);
  }
  if (roh !== null && istDegeneriert(roh)) {
    retryUsed = true;
    text = await rufeAb(1);
    roh = null;
    parseFehler = null;
    try {
      roh = parseTolerant(text);
    } catch (fehler) {
      parseFehler = fehler instanceof Error ? fehler.message : String(fehler);
    }
  }

  // Fehler immer mit den bis hierher angefallenen Metadaten werfen,
  // damit die Pipeline auch gescheiterte Läufe voll protokolliert.
  const wirfMitMeta = (nachricht: string): never => {
    throw new ExtraktionsFehler(nachricht, {
      model,
      route,
      inputTokens,
      outputTokens,
      costUsd: schaetzeKostenUsd(optionen.quality, inputTokens, outputTokens),
      retryUsed,
      repairUsed,
    });
  };

  // 2. Parse-Fehler → EIN Repair-Aufruf (gleiches Modell, ohne Bilder).
  if (roh === null) {
    repairUsed = true;
    const repairSystem = baueRepairSystemText();
    const repairText =
      `${REPAIR_VORTEXT}${parseFehler}\n\n${REPAIR_AUSGABE_MARKER}\n` +
      text.slice(0, REPAIR_MAX_ZEICHEN);
    const antwort = await rufeExtraktionsModell(optionen.quality, {
      system: repairSystem,
      userText: repairText,
      bilder: [],
      temperature: 0,
    });
    inputTokens += antwort.inputTokens;
    outputTokens += antwort.outputTokens;
    try {
      roh = parseTolerant(antwort.text);
    } catch (fehler) {
      // Auch der Repair-Versuch unbrauchbar → Lauf failed.
      wirfMitMeta(fehler instanceof Error ? fehler.message : String(fehler));
    }
  }
  if (roh !== null && istDegeneriert(roh)) {
    // Nach Retry bzw. Repair immer noch leer/absurd – expliziter
    // Fehler statt ein degeneriertes Modell zu speichern.
    wirfMitMeta("extraction returned a degenerate (empty) result");
  }

  // 3. compute.js + validate-assemble.js (1:1 portiert).
  const berechnet = berechneKonsolidierung({
    result: roh,
    model,
    repaired: repairUsed,
  });
  const geprueft = validiereUndAssembliere(berechnet);

  return {
    roh: geprueft.result,
    model,
    route,
    inputTokens,
    outputTokens,
    costUsd: schaetzeKostenUsd(optionen.quality, inputTokens, outputTokens),
    retryUsed,
    repairUsed,
    zusammenfassung: geprueft.summary,
  };
}
