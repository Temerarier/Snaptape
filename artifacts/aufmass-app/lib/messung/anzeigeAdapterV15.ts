// WEGWERF-Adapter (nur Anzeige): mappt gespeichertes v1.5-Measurement-
// JSON auf den v1.2-Vertrag, den der bestehende Viewer (v2) versteht.
// Das gespeicherte JSON und der Viewer selbst bleiben unangetastet –
// dieser Adapter fliegt raus, sobald der Viewer nativ v1.5 spricht.
//
// Der Etappe-2-Baukasten rendert ein VEREINFACHTES Giebeldach-Volumen
// und verlangt exakt diese Bauteil-Gruppen: je 1 Wand pro Elevation,
// 2 Dachflächen (elevation "roof"), 1 Ridge, je 1 Eave vorn/hinten,
// je 2 Rakes links/rechts, 4 Outside-Corners ohne Elevation. Der
// Adapter reduziert das reichere v1.5-Modell auf genau dieses Set
// (repräsentative Bauteile, Rest wird für die Anzeige weggelassen).
// Bei strukturell unbrauchbaren Daten wird geworfen – kein stiller
// Fallback.
import { measureJsonSchema, type MeasureJson } from "./schema";

// v1.2 kennt nur Wand-Substrate; v1.5-Dachbeläge (shingle_asphalt, …)
// fallen auf "other" zurück.
const V12_MATERIALIEN = new Set([
  "stucco",
  "brick",
  "siding",
  "wood",
  "concrete",
  "eifs",
  "other",
  "unknown",
]);

type RohFace = {
  face_class?: unknown;
  elevation?: unknown;
  material?: unknown;
};
type RohEdge = { edge_class?: unknown; belongs_to_elevation?: unknown };

// Nimmt die ersten `anzahl` Kanten einer Gruppe; zu wenige → so viele
// wie vorhanden (der Baukasten wirft dann sichtbar, kein stiller Fix).
function nimm<T>(liste: T[], anzahl: number): T[] {
  return liste.slice(0, anzahl);
}

export function adaptiereV15FuerAnzeige(roh: unknown): MeasureJson {
  if (roh === null || typeof roh !== "object") {
    throw new Error("Stored measurement is not an object");
  }
  const kopie = structuredClone(roh) as {
    meta?: Record<string, unknown>;
    faces?: RohFace[];
    edges?: RohEdge[];
    openings?: {
      elevation?: unknown;
      position_mm?: { x?: unknown; y?: unknown } | null;
    }[];
    attachments?: unknown;
  };
  if (kopie.meta && typeof kopie.meta === "object") {
    delete kopie.meta.schema_version;
  }

  // Flächen: je Elevation eine repräsentative Wand, genau zwei
  // Dachflächen mit elevation "roof" (Soffits/Fascias und weitere
  // Teilflächen kann der Baukasten nicht darstellen).
  if (Array.isArray(kopie.faces)) {
    const waende = new Map<string, RohFace>();
    const daecher: RohFace[] = [];
    for (const face of kopie.faces) {
      if (face?.face_class === "wall" && typeof face.elevation === "string") {
        if (!waende.has(face.elevation)) waende.set(face.elevation, face);
      } else if (face?.face_class === "roof_face" && daecher.length < 2) {
        daecher.push({ ...face, elevation: "roof" });
      }
    }
    const behalten = ["front", "back", "left", "right"]
      .map((e) => waende.get(e))
      .filter((f): f is RohFace => f !== undefined);
    kopie.faces = [...behalten, ...daecher];
    for (const face of kopie.faces) {
      if (
        typeof face.material === "string" &&
        !V12_MATERIALIEN.has(face.material)
      ) {
        face.material = "other";
      }
    }
  }

  // Kanten: exakt das Set des Giebel-Volumens; Blech-Kanten (flashing/
  // step_flashing) ignoriert der Baukasten selbst. Alles andere
  // (valleys, inside_corners, base, überzählige Rakes) weglassen.
  if (Array.isArray(kopie.edges)) {
    const proGruppe = (klasse: string, elevation?: unknown) =>
      kopie.edges!.filter(
        (e) =>
          e?.edge_class === klasse &&
          (elevation === undefined || e.belongs_to_elevation === elevation),
      );
    kopie.edges = [
      ...nimm(proGruppe("ridge"), 1),
      ...nimm(proGruppe("eave", "front"), 1),
      ...nimm(proGruppe("eave", "back"), 1),
      ...nimm(proGruppe("rake", "left"), 2),
      ...nimm(proGruppe("rake", "right"), 2),
      ...nimm(proGruppe("outside_corner"), 4).map((e) => ({
        ...e,
        belongs_to_elevation: null,
      })),
      ...proGruppe("flashing"),
      ...proGruppe("step_flashing"),
    ];
  }

  // Öffnungen kann der Baukasten nur mit konkreter Fassaden-Position
  // (position_mm x/y) und Wand-Elevation platzieren – alles andere
  // (Skylights, Öffnungen ohne Position) für die Anzeige weglassen.
  if (Array.isArray(kopie.openings)) {
    kopie.openings = kopie.openings.filter(
      (o) =>
        o?.elevation !== "roof" &&
        o?.elevation !== "unknown" &&
        typeof o?.position_mm?.x === "number" &&
        typeof o?.position_mm?.y === "number",
    );
  }

  // Anbauten werden in Etappe 2 nicht dargestellt (Baukasten wirft).
  delete kopie.attachments;

  return measureJsonSchema.parse(kopie);
}
