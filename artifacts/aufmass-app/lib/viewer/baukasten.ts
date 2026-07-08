// Volumen-Baukasten (Etappe 2): reine Geometrie-Schicht ohne UI und ohne
// three.js. Baut aus dem Measurement-JSON (v1.2) das 3D-Modell des
// Hauptkörpers samt Satteldach (gable) und ordnet Flächen/Kanten/
// Öffnungen den Bauteil-IDs des Measurement-JSON zu (Eiserne Regel 3:
// dieselbe ID überall).
//
// Alle Koordinaten sind ungerundete Millimeter (Eiserne Regel 1).
//
// Weltkoordinaten: x = Hausbreite (0..B), y = Höhe (0..Ridge),
// z = Haustiefe – die Front-Elevation (front) liegt bei z = T, die
// Rückseite (back) bei z = 0. Der Ridge verläuft entlang der x-Achse
// bei z = T/2.
//
// Erweiterbarkeit: `hauptvolumenSatteldach` liefert ein Roh-Volumen
// (Flächen + Kanten mit semantischen Schlüsseln). Weitere Volumen
// (attachments – Gauben, Anbauten) können später als zusätzliche
// Roh-Volumen erzeugt und vor der ID-Zuordnung mit
// `kombiniereVolumen` zusammengeführt werden.
import type { Elevation, MeasureJson } from "../messung/schema";

export type Punkt3 = [number, number, number];

export interface ModellFlaeche {
  id: string; // z. B. "WL-1", "RF-1"
  faceClass: "wall" | "roof_face";
  fassade: string; // Elevation oder "roof"
  polygon: Punkt3[]; // planar, in mm
}

export interface ModellKante {
  id: string; // z. B. "E-1"
  edgeClass: string;
  fassade: string | null;
  start: Punkt3;
  ende: Punkt3;
  laengeMm: number; // aus der Geometrie, ungerundet
}

export interface ModellOeffnung {
  id: string; // z. B. "W-1", "D-1", "G-1"
  typ: "window" | "door" | "patio_door" | "garage_door" | "skylight" | "other";
  fassade: Elevation;
  polygon: Punkt3[]; // Rechteck, leicht vor der Fassadenebene
  breiteMm: number;
  hoeheMm: number;
}

export interface HausModell {
  flaechen: ModellFlaeche[];
  kanten: ModellKante[];
  oeffnungen: ModellOeffnung[];
  breiteMm: number;
  tiefeMm: number;
  eaveHoeheMm: number;
  ridgeHoeheMm: number;
}

// Öffnungen liegen minimal vor der Fassadenebene, damit sie im Viewer
// nicht mit der Wand flackern (nur Darstellung, kein Messwert).
const OEFFNUNGS_OFFSET_MM = 40;

// Blech-Kanten (flashing/step_flashing) sind Dachdetails ohne eigene
// Geometrie im Massenmodell der Etappe 2: Sie erscheinen in Listen und
// Summen, werden aber nicht als Linie im 3D-Modell gezeichnet.
const KANTEN_OHNE_GEOMETRIE = new Set(["flashing", "step_flashing"]);

interface FassadenSystem {
  ursprung: Punkt3; // linke untere Ecke der Fassade (von außen gesehen)
  richtungX: Punkt3; // Fassaden-x (von außen gesehen nach rechts)
  aussen: Punkt3; // Außennormale der Fassade
  breiteMm: number;
}

interface RohFlaeche {
  faceClass: "wall" | "roof_face";
  fassade: string;
  reihenfolge: number;
  polygon: Punkt3[];
}

interface RohKante {
  edgeClass: string;
  fassade: string | null;
  reihenfolge: number;
  start: Punkt3;
  ende: Punkt3;
}

export interface RohVolumen {
  flaechen: RohFlaeche[];
  kanten: RohKante[];
}

function punkt(x: number, y: number, z: number): Punkt3 {
  return [x, y, z];
}

function abstand(a: Punkt3, b: Punkt3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Fassaden-Koordinatensysteme: position_mm einer Öffnung ist x/y ab
// linker unterer Ecke der jeweiligen Elevation, von außen betrachtet.
function fassadenSysteme(
  breite: number,
  tiefe: number,
): Record<Elevation, FassadenSystem> {
  return {
    front: {
      ursprung: punkt(0, 0, tiefe),
      richtungX: punkt(1, 0, 0),
      aussen: punkt(0, 0, 1),
      breiteMm: breite,
    },
    back: {
      ursprung: punkt(breite, 0, 0),
      richtungX: punkt(-1, 0, 0),
      aussen: punkt(0, 0, -1),
      breiteMm: breite,
    },
    left: {
      ursprung: punkt(0, 0, 0),
      richtungX: punkt(0, 0, 1),
      aussen: punkt(-1, 0, 0),
      breiteMm: tiefe,
    },
    right: {
      ursprung: punkt(breite, 0, tiefe),
      richtungX: punkt(0, 0, -1),
      aussen: punkt(1, 0, 0),
      breiteMm: tiefe,
    },
  };
}

// Hauptkörper: aus dem Footprint extrudierte Wände plus Satteldach aus
// Eave- und Ridge-Höhe. Ridge entlang der x-Achse bei z = T/2.
function hauptvolumenSatteldach(
  breite: number,
  tiefe: number,
  eave: number,
  ridge: number,
): RohVolumen {
  const zm = tiefe / 2;

  const flaechen: RohFlaeche[] = [
    {
      faceClass: "wall",
      fassade: "front",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, tiefe),
        punkt(breite, 0, tiefe),
        punkt(breite, eave, tiefe),
        punkt(0, eave, tiefe),
      ],
    },
    {
      faceClass: "wall",
      fassade: "back",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, 0),
        punkt(breite, 0, 0),
        punkt(breite, eave, 0),
        punkt(0, eave, 0),
      ],
    },
    {
      // Giebelwand links: Rechteck + Giebeldreieck als ein Fünfeck
      faceClass: "wall",
      fassade: "left",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, 0),
        punkt(0, 0, tiefe),
        punkt(0, eave, tiefe),
        punkt(0, ridge, zm),
        punkt(0, eave, 0),
      ],
    },
    {
      faceClass: "wall",
      fassade: "right",
      reihenfolge: 0,
      polygon: [
        punkt(breite, 0, 0),
        punkt(breite, 0, tiefe),
        punkt(breite, eave, tiefe),
        punkt(breite, ridge, zm),
        punkt(breite, eave, 0),
      ],
    },
    {
      // Konvention: erste Dachfläche = front (RF-1)
      faceClass: "roof_face",
      fassade: "roof",
      reihenfolge: 0,
      polygon: [
        punkt(0, eave, tiefe),
        punkt(breite, eave, tiefe),
        punkt(breite, ridge, zm),
        punkt(0, ridge, zm),
      ],
    },
    {
      // zweite Dachfläche = back (RF-2)
      faceClass: "roof_face",
      fassade: "roof",
      reihenfolge: 1,
      polygon: [
        punkt(0, eave, 0),
        punkt(breite, eave, 0),
        punkt(breite, ridge, zm),
        punkt(0, ridge, zm),
      ],
    },
  ];

  const kanten: RohKante[] = [
    {
      edgeClass: "ridge",
      fassade: "roof",
      reihenfolge: 0,
      start: punkt(0, ridge, zm),
      ende: punkt(breite, ridge, zm),
    },
    {
      edgeClass: "eave",
      fassade: "front",
      reihenfolge: 0,
      start: punkt(0, eave, tiefe),
      ende: punkt(breite, eave, tiefe),
    },
    {
      edgeClass: "eave",
      fassade: "back",
      reihenfolge: 0,
      start: punkt(0, eave, 0),
      ende: punkt(breite, eave, 0),
    },
    // Rakes (Ortgänge): je Giebel zuerst der frontseitige, dann der
    // rückseitige (Konvention, siehe Fixture-Notes)
    {
      edgeClass: "rake",
      fassade: "left",
      reihenfolge: 0,
      start: punkt(0, eave, tiefe),
      ende: punkt(0, ridge, zm),
    },
    {
      edgeClass: "rake",
      fassade: "left",
      reihenfolge: 1,
      start: punkt(0, eave, 0),
      ende: punkt(0, ridge, zm),
    },
    {
      edgeClass: "rake",
      fassade: "right",
      reihenfolge: 0,
      start: punkt(breite, eave, tiefe),
      ende: punkt(breite, ridge, zm),
    },
    {
      edgeClass: "rake",
      fassade: "right",
      reihenfolge: 1,
      start: punkt(breite, eave, 0),
      ende: punkt(breite, ridge, zm),
    },
    // Außenecken im Uhrzeigersinn ab vorne-links (wie footprint.points):
    // vorne-links, vorne-rechts, hinten-rechts, hinten-links
    {
      edgeClass: "outside_corner",
      fassade: null,
      reihenfolge: 0,
      start: punkt(0, 0, tiefe),
      ende: punkt(0, eave, tiefe),
    },
    {
      edgeClass: "outside_corner",
      fassade: null,
      reihenfolge: 1,
      start: punkt(breite, 0, tiefe),
      ende: punkt(breite, eave, tiefe),
    },
    {
      edgeClass: "outside_corner",
      fassade: null,
      reihenfolge: 2,
      start: punkt(breite, 0, 0),
      ende: punkt(breite, eave, 0),
    },
    {
      edgeClass: "outside_corner",
      fassade: null,
      reihenfolge: 3,
      start: punkt(0, 0, 0),
      ende: punkt(0, eave, 0),
    },
  ];

  return { flaechen, kanten };
}

// Führt mehrere Roh-Volumen zusammen (für spätere Attachments/Gauben).
export function kombiniereVolumen(...volumen: RohVolumen[]): RohVolumen {
  return {
    flaechen: volumen.flatMap((v) => v.flaechen),
    kanten: volumen.flatMap((v) => v.kanten),
  };
}

function nummerVonId(id: string): number {
  return Number(id.slice(id.indexOf("-") + 1));
}

function flaechenSchluessel(faceClass: string, fassade: string | null | undefined) {
  return `${faceClass}|${fassade ?? "unknown"}`;
}

function kantenSchluessel(edgeClass: string, fassade: string | null | undefined) {
  return `${edgeClass}|${fassade ?? "-"}`;
}

// Ordnet die Roh-Flächen den Bauteil-IDs des Measurement-JSON zu:
// Gruppierung nach (face_class, elevation); innerhalb einer Gruppe
// zählen die IDs numerisch aufsteigend in der kanonischen Reihenfolge
// des Baukastens.
function ordneFlaechenZu(
  mess: MeasureJson,
  rohFlaechen: RohFlaeche[],
): ModellFlaeche[] {
  const fixtureGruppen = new Map<string, typeof mess.faces>();
  for (const face of mess.faces) {
    if (face.face_class !== "wall" && face.face_class !== "roof_face") {
      throw new Error(
        `Baukasten: face_class "${face.face_class}" (${face.id}) wird in Etappe 2 nicht unterstützt.`,
      );
    }
    const schluessel = flaechenSchluessel(face.face_class, face.elevation);
    const gruppe = fixtureGruppen.get(schluessel) ?? [];
    gruppe.push(face);
    fixtureGruppen.set(schluessel, gruppe);
  }
  for (const gruppe of fixtureGruppen.values()) {
    gruppe.sort((a, b) => nummerVonId(a.id) - nummerVonId(b.id));
  }

  const ergebnis: ModellFlaeche[] = [];
  const rohSortiert = [...rohFlaechen].sort(
    (a, b) => a.reihenfolge - b.reihenfolge,
  );
  const verbraucht = new Map<string, number>();
  for (const roh of rohSortiert) {
    const schluessel = flaechenSchluessel(roh.faceClass, roh.fassade);
    const gruppe = fixtureGruppen.get(schluessel);
    const index = verbraucht.get(schluessel) ?? 0;
    const face = gruppe?.[index];
    if (!face) {
      throw new Error(
        `Baukasten: keine Mess-Fläche für ${schluessel} (Nr. ${index + 1}) gefunden.`,
      );
    }
    verbraucht.set(schluessel, index + 1);
    ergebnis.push({
      id: face.id,
      faceClass: roh.faceClass,
      fassade: roh.fassade,
      polygon: roh.polygon,
    });
  }
  for (const [schluessel, gruppe] of fixtureGruppen) {
    const genutzt = verbraucht.get(schluessel) ?? 0;
    if (genutzt < gruppe.length) {
      throw new Error(
        `Baukasten: Mess-Fläche ${gruppe[genutzt]!.id} (${schluessel}) hat keine Geometrie im Volumen.`,
      );
    }
  }
  return ergebnis;
}

function ordneKantenZu(mess: MeasureJson, rohKanten: RohKante[]): ModellKante[] {
  const fixtureGruppen = new Map<string, typeof mess.edges>();
  for (const edge of mess.edges) {
    // Blech-Kanten haben in Etappe 2 keine Geometrie – nicht zuordnen.
    if (KANTEN_OHNE_GEOMETRIE.has(edge.edge_class)) continue;
    const schluessel = kantenSchluessel(
      edge.edge_class,
      edge.belongs_to_elevation,
    );
    const gruppe = fixtureGruppen.get(schluessel) ?? [];
    gruppe.push(edge);
    fixtureGruppen.set(schluessel, gruppe);
  }
  for (const gruppe of fixtureGruppen.values()) {
    gruppe.sort((a, b) => nummerVonId(a.id) - nummerVonId(b.id));
  }

  const ergebnis: ModellKante[] = [];
  const rohSortiert = [...rohKanten].sort(
    (a, b) => a.reihenfolge - b.reihenfolge,
  );
  const verbraucht = new Map<string, number>();
  for (const roh of rohSortiert) {
    const schluessel = kantenSchluessel(roh.edgeClass, roh.fassade);
    const gruppe = fixtureGruppen.get(schluessel);
    const index = verbraucht.get(schluessel) ?? 0;
    const edge = gruppe?.[index];
    if (!edge) {
      throw new Error(
        `Baukasten: keine Mess-Kante für ${schluessel} (Nr. ${index + 1}) gefunden.`,
      );
    }
    verbraucht.set(schluessel, index + 1);
    ergebnis.push({
      id: edge.id,
      edgeClass: roh.edgeClass,
      fassade: roh.fassade,
      start: roh.start,
      ende: roh.ende,
      laengeMm: abstand(roh.start, roh.ende),
    });
  }
  for (const [schluessel, gruppe] of fixtureGruppen) {
    const genutzt = verbraucht.get(schluessel) ?? 0;
    if (genutzt < gruppe.length) {
      throw new Error(
        `Baukasten: Mess-Kante ${gruppe[genutzt]!.id} (${schluessel}) hat keine Geometrie im Volumen.`,
      );
    }
  }
  return ergebnis;
}

function baueOeffnungen(
  mess: MeasureJson,
  systeme: Record<Elevation, FassadenSystem>,
): ModellOeffnung[] {
  return mess.openings.map((oeffnung) => {
    if (oeffnung.elevation === "unknown" || oeffnung.elevation === "roof") {
      throw new Error(
        `Baukasten: Öffnung ${oeffnung.id} hat die Elevation "${oeffnung.elevation}" und kann in Etappe 2 nicht platziert werden.`,
      );
    }
    const sys = systeme[oeffnung.elevation];
    const pos = oeffnung.position_mm;
    if (pos?.x === undefined || pos?.y === undefined) {
      throw new Error(
        `Baukasten: Öffnung ${oeffnung.id} hat kein position_mm (x/y).`,
      );
    }
    const b = oeffnung.width_mm.value;
    const h = oeffnung.height_mm.value;
    const ecke = (dx: number, dy: number): Punkt3 => [
      sys.ursprung[0] + sys.richtungX[0] * dx + sys.aussen[0] * OEFFNUNGS_OFFSET_MM,
      sys.ursprung[1] + dy + sys.aussen[1] * OEFFNUNGS_OFFSET_MM,
      sys.ursprung[2] + sys.richtungX[2] * dx + sys.aussen[2] * OEFFNUNGS_OFFSET_MM,
    ];
    return {
      id: oeffnung.id,
      typ: oeffnung.type,
      fassade: oeffnung.elevation,
      polygon: [
        ecke(pos.x, pos.y),
        ecke(pos.x + b, pos.y),
        ecke(pos.x + b, pos.y + h),
        ecke(pos.x, pos.y + h),
      ],
      breiteMm: b,
      hoeheMm: h,
    };
  });
}

export function baueHausModell(mess: MeasureJson): HausModell {
  if (mess.building.roof_type !== "gable") {
    throw new Error(
      `Baukasten: roof_type "${mess.building.roof_type}" wird in Etappe 2 nicht unterstützt (nur gable).`,
    );
  }
  const breite = mess.building.footprint?.width_mm?.value;
  const tiefe = mess.building.footprint?.depth_mm?.value;
  const eave = mess.building.heights?.eave_height_mm?.value;
  const ridge = mess.building.heights?.ridge_height_mm?.value;
  if (!breite || !tiefe || !eave || !ridge) {
    throw new Error(
      "Baukasten: footprint (width/depth) und heights (eave/ridge) müssen im Measurement-JSON gesetzt sein.",
    );
  }
  if (mess.attachments && mess.attachments.length > 0) {
    throw new Error(
      "Baukasten: Attachments werden in Etappe 2 noch nicht dargestellt.",
    );
  }

  // Später: weitere Volumen (Attachments/Gauben) hier erzeugen und mit
  // kombiniereVolumen(...) anfügen.
  const roh = hauptvolumenSatteldach(breite, tiefe, eave, ridge);
  const systeme = fassadenSysteme(breite, tiefe);

  return {
    flaechen: ordneFlaechenZu(mess, roh.flaechen),
    kanten: ordneKantenZu(mess, roh.kanten),
    oeffnungen: baueOeffnungen(mess, systeme),
    breiteMm: breite,
    tiefeMm: tiefe,
    eaveHoeheMm: eave,
    ridgeHoeheMm: ridge,
  };
}
