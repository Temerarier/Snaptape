// Klassifizierungs-Schritt (Qualitäts-Gate vor der Messung):
// Alle Fotos und alle gerenderten PDF-Seiten gehen in EINEM Aufruf an
// Claude Sonnet (Prompt: docs/pipeline/classify-prompt.md, VERBATIM).
// Ergebnis: Klasse + Elevation pro Bildeinheit, Projekt-Typ
// (photo/plan/mixed) und die Entscheidung ok/rejected.
// Fehler (API, JSON, fehlende Bilder) werfen – der Aufrufer meldet sie
// explizit; es gibt keinen stillen Fallback.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { FileClassificationEntry, ProjectFile } from "@workspace/db";
import { ladeObjekt } from "@/lib/storage/objectStorage";
import { verkleinereFuerKI } from "@/lib/upload/verarbeitung";

const MODELL = "claude-sonnet-4-5";
const MAX_PLAN_SEITEN = 15;

// Der Prompt wird zur Laufzeit VERBATIM aus dem Repo gelesen (nicht
// kopiert/umformuliert). Next läuft mit cwd=artifacts/aufmass-app,
// deshalb beide Kandidaten prüfen.
function ladePrompt(): string {
  const kandidaten = [
    join(process.cwd(), "docs/pipeline/classify-prompt.md"),
    join(process.cwd(), "../../docs/pipeline/classify-prompt.md"),
  ];
  for (const pfad of kandidaten) {
    if (existsSync(pfad)) return readFileSync(pfad, "utf8");
  }
  throw new Error("classify-prompt.md nicht gefunden.");
}

// Eine Bildeinheit = ein Foto oder eine PDF-Seite.
interface BildEinheit {
  dateiId: string;
  page: number; // 1-basiert (Fotos immer 1)
  istPdfSeite: boolean;
  marker: string;
  objectPath: string;
  endung: string;
}

export interface KlassifizierungsEinheit extends FileClassificationEntry {
  dateiId: string;
}

export interface KlassifizierungsErgebnis {
  overall: "ok" | "rejected";
  rejectionReason: string | null;
  projectType: string;
  depthBasis: string;
  expectedAccuracy: string;
  referenceObjectsFound: string[];
  einheiten: KlassifizierungsEinheit[];
  planSeitenNutzbar: number;
  planSeitenGewaehlt: number;
  raw: unknown;
}

function baueEinheiten(dateien: ProjectFile[]): BildEinheit[] {
  const einheiten: BildEinheit[] = [];
  let fotoNr = 0;
  for (const datei of dateien) {
    if (datei.kind === "photo") {
      fotoNr += 1;
      const endung = datei.originalName
        .slice(datei.originalName.lastIndexOf(".") + 1)
        .toLowerCase();
      einheiten.push({
        dateiId: datei.id,
        page: 1,
        istPdfSeite: false,
        marker: `photo ${fotoNr}`,
        objectPath: datei.storagePath,
        endung,
      });
    } else {
      const seiten = datei.pageImagePaths ?? [];
      if (seiten.length === 0) {
        throw new Error(
          `PDF ${datei.originalName} hat keine gerenderten Seiten.`,
        );
      }
      seiten.forEach((pfad, i) => {
        einheiten.push({
          dateiId: datei.id,
          page: i + 1,
          istPdfSeite: true,
          marker: `${datei.originalName}, page ${i + 1}/${seiten.length}`,
          objectPath: pfad,
          endung: "png",
        });
      });
    }
  }
  return einheiten;
}

interface RohBild {
  class?: unknown;
  usable?: unknown;
  elevation?: unknown;
  occluded_percent?: unknown;
  has_dimensions?: unknown;
}

interface RohAntwort {
  project_type?: unknown;
  overall?: unknown;
  rejection_reason?: unknown;
  images?: unknown;
  reference_objects_found?: unknown;
  depth_basis?: unknown;
  expected_accuracy?: unknown;
}

function parseAntwort(text: string): RohAntwort {
  const bereinigt = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(bereinigt) as RohAntwort;
  } catch {
    throw new Error("Klassifizierer-Antwort ist kein gültiges JSON.");
  }
}

// Rangfolge der 15-Seiten-Auswahl: bemaßte Ansichten > bemaßte
// Grundrisse > sonstige nutzbare Planseiten. (PDF-Seiten kommen laut
// Prompt mit elevation/floor_plan/…, Task-1-Klassen mit plan_*.)
function planRang(e: KlassifizierungsEinheit): number {
  const istAnsicht = e.class === "elevation" || e.class === "plan_elevation";
  const istGrundriss =
    e.class === "floor_plan" || e.class === "plan_floorplan";
  if (istAnsicht && e.hasDimensions) return 0;
  if (istGrundriss && e.hasDimensions) return 1;
  return 2;
}

export async function klassifiziereDateien(
  dateien: ProjectFile[],
): Promise<KlassifizierungsErgebnis> {
  const geordnet = [...dateien].sort((a, b) => a.sortOrder - b.sortOrder);
  const einheiten = baueEinheiten(geordnet);
  const prompt = ladePrompt();

  // Bilder laden und für den KI-Aufruf verkleinern (JPEG ~1400 px).
  const bilder = await Promise.all(
    einheiten.map(async (e) => {
      const original = await ladeObjekt(e.objectPath);
      return verkleinereFuerKI(original, e.endung);
    }),
  );

  const content: Anthropic.ContentBlockParam[] = [];
  einheiten.forEach((e, i) => {
    content.push({ type: "text", text: e.marker });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: bilder[i].toString("base64"),
      },
    });
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const antwort = await client.messages.create({
    model: MODELL,
    max_tokens: 4096,
    system: prompt,
    messages: [{ role: "user", content }],
  });
  const textBlock = antwort.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Klassifizierer hat keinen Text geliefert.");
  }

  // Strikte Validierung: fehlerhafte/unerwartete Modell-Ausgabe wirft –
  // niemals still zu Standardwerten greifen (könnte ein unbrauchbares
  // Set fälschlich passieren lassen).
  const roh = parseAntwort(textBlock.text);
  if (roh.overall !== "ok" && roh.overall !== "rejected") {
    throw new Error(`Ungültiges overall: ${String(roh.overall)}`);
  }
  const overall = roh.overall;
  if (
    roh.project_type !== "photo" &&
    roh.project_type !== "plan" &&
    roh.project_type !== "mixed"
  ) {
    throw new Error(`Ungültiger project_type: ${String(roh.project_type)}`);
  }
  if (roh.depth_basis !== "ok" && roh.depth_basis !== "oblique_only") {
    throw new Error(`Ungültige depth_basis: ${String(roh.depth_basis)}`);
  }
  if (
    roh.expected_accuracy !== "high" &&
    roh.expected_accuracy !== "medium" &&
    roh.expected_accuracy !== "limited"
  ) {
    throw new Error(
      `Ungültige expected_accuracy: ${String(roh.expected_accuracy)}`,
    );
  }
  const bilderRoh = Array.isArray(roh.images) ? (roh.images as RohBild[]) : [];
  if (bilderRoh.length !== einheiten.length) {
    throw new Error(
      `Klassifizierer lieferte ${bilderRoh.length} Einträge für ${einheiten.length} Bilder.`,
    );
  }

  // Zuordnung strikt über die Reihenfolge (ein Eintrag pro Eingabebild).
  const ergebnisse: KlassifizierungsEinheit[] = einheiten.map((e, i) => {
    const b = bilderRoh[i];
    if (typeof b.class !== "string" || b.class.length === 0) {
      throw new Error(`Bild ${i + 1}: fehlende Klasse.`);
    }
    if (typeof b.usable !== "boolean") {
      throw new Error(`Bild ${i + 1}: fehlendes usable-Flag.`);
    }
    return {
      dateiId: e.dateiId,
      page: e.page,
      class: b.class,
      usable: b.usable,
      elevation: typeof b.elevation === "string" ? b.elevation : null,
      occludedPercent:
        typeof b.occluded_percent === "number" ? b.occluded_percent : null,
      hasDimensions:
        typeof b.has_dimensions === "boolean" ? b.has_dimensions : null,
      selectedForMeasurement: false,
    };
  });

  // Auswahl fürs Messen: nutzbare Fotos immer; nutzbare Planseiten
  // maximal 15, nach Relevanz. Nie eine Ablehnung wegen zu vieler Seiten.
  const nutzbarePlanSeiten = ergebnisse.filter(
    (e) =>
      e.usable && e.class !== "photo_exterior" && e.class !== "no_building",
  );
  const gewaehlte = new Set(
    [...nutzbarePlanSeiten]
      .map((e, i) => ({ e, i }))
      .sort((a, b) => planRang(a.e) - planRang(b.e) || a.i - b.i)
      .slice(0, MAX_PLAN_SEITEN)
      .map(({ e }) => e),
  );
  for (const e of ergebnisse) {
    e.selectedForMeasurement =
      overall === "ok" &&
      e.usable &&
      (e.class === "photo_exterior" || gewaehlte.has(e));
  }

  return {
    overall,
    rejectionReason:
      typeof roh.rejection_reason === "string" ? roh.rejection_reason : null,
    projectType: roh.project_type,
    depthBasis: roh.depth_basis,
    expectedAccuracy: roh.expected_accuracy,
    referenceObjectsFound: Array.isArray(roh.reference_objects_found)
      ? roh.reference_objects_found.filter(
          (r): r is string => typeof r === "string",
        )
      : [],
    einheiten: ergebnisse,
    planSeitenNutzbar: nutzbarePlanSeiten.length,
    planSeitenGewaehlt: Math.min(nutzbarePlanSeiten.length, MAX_PLAN_SEITEN),
    raw: roh,
  };
}
