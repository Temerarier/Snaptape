// Volumen-Baukasten (Etappe 2): reine Geometrie-Schicht ohne UI und ohne
// three.js. Baut aus dem Mess-JSON das 3D-Modell des Hauptkörpers samt
// Satteldach und ordnet Flächen/Kanten/Öffnungen den Bauteil-IDs des
// Mess-JSON zu (Eiserne Regel 3: dieselbe ID überall).
//
// Alle Koordinaten sind ungerundete Millimeter (Eiserne Regel 1).
//
// Weltkoordinaten: x = Hausbreite (0..B), y = Höhe (0..First),
// z = Haustiefe – die Strassenseite liegt bei z = T, die Gartenseite
// bei z = 0. Der First verläuft entlang der x-Achse bei z = T/2.
//
// Erweiterbarkeit: `hauptvolumenSatteldach` liefert ein Roh-Volumen
// (Flächen + Kanten mit semantischen Schlüsseln). Weitere Volumen
// (Anbauten, Gauben – anbauten-Liste im Schema) können später als
// zusätzliche Roh-Volumen erzeugt und vor der ID-Zuordnung mit
// `kombiniereVolumen` zusammengeführt werden.
import type { Fassade, MessJson } from "../messung/schema";

export type Punkt3 = [number, number, number];

export interface ModellFlaeche {
  id: string; // z. B. "W-1", "D-1"
  faceClass: "wand" | "dachflaeche";
  fassade: string;
  polygon: Punkt3[]; // planar, in mm
}

export interface ModellKante {
  id: string; // z. B. "K-1"
  edgeClass: string;
  fassade: string | null;
  start: Punkt3;
  ende: Punkt3;
  laengeMm: number; // aus der Geometrie, ungerundet
}

export interface ModellOeffnung {
  id: string; // z. B. "F-1", "T-1", "G-1"
  typ: "fenster" | "tuer" | "garagentor" | "sonstige";
  fassade: Fassade;
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
  traufhoeheMm: number;
  firsthoeheMm: number;
}

// Öffnungen liegen minimal vor der Fassadenebene, damit sie im Viewer
// nicht mit der Wand flackern (nur Darstellung, kein Messwert).
const OEFFNUNGS_OFFSET_MM = 40;

interface FassadenSystem {
  ursprung: Punkt3; // linke untere Ecke der Fassade (von außen gesehen)
  richtungX: Punkt3; // Fassaden-x (von außen gesehen nach rechts)
  aussen: Punkt3; // Außennormale der Fassade
  breiteMm: number;
}

interface RohFlaeche {
  faceClass: "wand" | "dachflaeche";
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
// linker unterer Ecke der jeweiligen Fassade, von außen betrachtet.
function fassadenSysteme(
  breite: number,
  tiefe: number,
): Record<Fassade, FassadenSystem> {
  return {
    strassenseite: {
      ursprung: punkt(0, 0, tiefe),
      richtungX: punkt(1, 0, 0),
      aussen: punkt(0, 0, 1),
      breiteMm: breite,
    },
    gartenseite: {
      ursprung: punkt(breite, 0, 0),
      richtungX: punkt(-1, 0, 0),
      aussen: punkt(0, 0, -1),
      breiteMm: breite,
    },
    links: {
      ursprung: punkt(0, 0, 0),
      richtungX: punkt(0, 0, 1),
      aussen: punkt(-1, 0, 0),
      breiteMm: tiefe,
    },
    rechts: {
      ursprung: punkt(breite, 0, tiefe),
      richtungX: punkt(0, 0, -1),
      aussen: punkt(1, 0, 0),
      breiteMm: tiefe,
    },
  };
}

// Hauptkörper: aus dem Footprint extrudierte Wände plus Satteldach aus
// Trauf- und Firsthöhe. First entlang der x-Achse bei z = T/2.
function hauptvolumenSatteldach(
  breite: number,
  tiefe: number,
  traufe: number,
  first: number,
): RohVolumen {
  const zm = tiefe / 2;

  const flaechen: RohFlaeche[] = [
    {
      faceClass: "wand",
      fassade: "strassenseite",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, tiefe),
        punkt(breite, 0, tiefe),
        punkt(breite, traufe, tiefe),
        punkt(0, traufe, tiefe),
      ],
    },
    {
      faceClass: "wand",
      fassade: "gartenseite",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, 0),
        punkt(breite, 0, 0),
        punkt(breite, traufe, 0),
        punkt(0, traufe, 0),
      ],
    },
    {
      // Giebelwand links: Rechteck + Giebeldreieck als ein Fünfeck
      faceClass: "wand",
      fassade: "links",
      reihenfolge: 0,
      polygon: [
        punkt(0, 0, 0),
        punkt(0, 0, tiefe),
        punkt(0, traufe, tiefe),
        punkt(0, first, zm),
        punkt(0, traufe, 0),
      ],
    },
    {
      faceClass: "wand",
      fassade: "rechts",
      reihenfolge: 0,
      polygon: [
        punkt(breite, 0, 0),
        punkt(breite, 0, tiefe),
        punkt(breite, traufe, tiefe),
        punkt(breite, first, zm),
        punkt(breite, traufe, 0),
      ],
    },
    {
      // Konvention: erste Dachfläche = strassenseitig (D-1)
      faceClass: "dachflaeche",
      fassade: "dach",
      reihenfolge: 0,
      polygon: [
        punkt(0, traufe, tiefe),
        punkt(breite, traufe, tiefe),
        punkt(breite, first, zm),
        punkt(0, first, zm),
      ],
    },
    {
      // zweite Dachfläche = gartenseitig (D-2)
      faceClass: "dachflaeche",
      fassade: "dach",
      reihenfolge: 1,
      polygon: [
        punkt(0, traufe, 0),
        punkt(breite, traufe, 0),
        punkt(breite, first, zm),
        punkt(0, first, zm),
      ],
    },
  ];

  const kanten: RohKante[] = [
    {
      edgeClass: "first",
      fassade: "dach",
      reihenfolge: 0,
      start: punkt(0, first, zm),
      ende: punkt(breite, first, zm),
    },
    {
      edgeClass: "traufe",
      fassade: "strassenseite",
      reihenfolge: 0,
      start: punkt(0, traufe, tiefe),
      ende: punkt(breite, traufe, tiefe),
    },
    {
      edgeClass: "traufe",
      fassade: "gartenseite",
      reihenfolge: 0,
      start: punkt(0, traufe, 0),
      ende: punkt(breite, traufe, 0),
    },
    // Ortgänge: je Giebel zuerst der strassenseitige, dann der
    // gartenseitige (Konvention, siehe Fixture-Hinweise)
    {
      edgeClass: "ortgang",
      fassade: "links",
      reihenfolge: 0,
      start: punkt(0, traufe, tiefe),
      ende: punkt(0, first, zm),
    },
    {
      edgeClass: "ortgang",
      fassade: "links",
      reihenfolge: 1,
      start: punkt(0, traufe, 0),
      ende: punkt(0, first, zm),
    },
    {
      edgeClass: "ortgang",
      fassade: "rechts",
      reihenfolge: 0,
      start: punkt(breite, traufe, tiefe),
      ende: punkt(breite, first, zm),
    },
    {
      edgeClass: "ortgang",
      fassade: "rechts",
      reihenfolge: 1,
      start: punkt(breite, traufe, 0),
      ende: punkt(breite, first, zm),
    },
    // Außenecken im Uhrzeigersinn ab vorne-links (wie footprint.punkte):
    // vorne-links, vorne-rechts, hinten-rechts, hinten-links
    {
      edgeClass: "aussenecke",
      fassade: null,
      reihenfolge: 0,
      start: punkt(0, 0, tiefe),
      ende: punkt(0, traufe, tiefe),
    },
    {
      edgeClass: "aussenecke",
      fassade: null,
      reihenfolge: 1,
      start: punkt(breite, 0, tiefe),
      ende: punkt(breite, traufe, tiefe),
    },
    {
      edgeClass: "aussenecke",
      fassade: null,
      reihenfolge: 2,
      start: punkt(breite, 0, 0),
      ende: punkt(breite, traufe, 0),
    },
    {
      edgeClass: "aussenecke",
      fassade: null,
      reihenfolge: 3,
      start: punkt(0, 0, 0),
      ende: punkt(0, traufe, 0),
    },
  ];

  return { flaechen, kanten };
}

// Führt mehrere Roh-Volumen zusammen (für spätere Anbauten/Gauben).
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
  return `${faceClass}|${fassade ?? "unbekannt"}`;
}

function kantenSchluessel(edgeClass: string, fassade: string | null | undefined) {
  return `${edgeClass}|${fassade ?? "-"}`;
}

// Ordnet die Roh-Flächen den Bauteil-IDs des Mess-JSON zu: Gruppierung
// nach (face_class, fassade); innerhalb einer Gruppe zählen die IDs
// numerisch aufsteigend in der kanonischen Reihenfolge des Baukastens.
function ordneFlaechenZu(
  mess: MessJson,
  rohFlaechen: RohFlaeche[],
): ModellFlaeche[] {
  const fixtureGruppen = new Map<string, typeof mess.faces>();
  for (const face of mess.faces) {
    if (face.face_class !== "wand" && face.face_class !== "dachflaeche") {
      throw new Error(
        `Baukasten: face_class "${face.face_class}" (${face.id}) wird in Etappe 2 nicht unterstützt.`,
      );
    }
    const schluessel = flaechenSchluessel(face.face_class, face.fassade);
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

function ordneKantenZu(mess: MessJson, rohKanten: RohKante[]): ModellKante[] {
  const fixtureGruppen = new Map<string, typeof mess.edges>();
  for (const edge of mess.edges) {
    const schluessel = kantenSchluessel(edge.edge_class, edge.gehoert_zu_fassade);
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
  mess: MessJson,
  systeme: Record<Fassade, FassadenSystem>,
): ModellOeffnung[] {
  return mess.openings.map((oeffnung) => {
    if (oeffnung.fassade === "unbekannt") {
      throw new Error(
        `Baukasten: Öffnung ${oeffnung.id} hat die Fassade "unbekannt" und kann nicht platziert werden.`,
      );
    }
    const sys = systeme[oeffnung.fassade];
    const pos = oeffnung.position_mm;
    if (pos?.x === undefined || pos?.y === undefined) {
      throw new Error(
        `Baukasten: Öffnung ${oeffnung.id} hat kein position_mm (x/y).`,
      );
    }
    const b = oeffnung.breite_mm.wert;
    const h = oeffnung.hoehe_mm.wert;
    const ecke = (dx: number, dy: number): Punkt3 => [
      sys.ursprung[0] + sys.richtungX[0] * dx + sys.aussen[0] * OEFFNUNGS_OFFSET_MM,
      sys.ursprung[1] + dy + sys.aussen[1] * OEFFNUNGS_OFFSET_MM,
      sys.ursprung[2] + sys.richtungX[2] * dx + sys.aussen[2] * OEFFNUNGS_OFFSET_MM,
    ];
    return {
      id: oeffnung.id,
      typ: oeffnung.typ,
      fassade: oeffnung.fassade,
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

export function baueHausModell(mess: MessJson): HausModell {
  if (mess.gebaeude.dachform !== "satteldach") {
    throw new Error(
      `Baukasten: Dachform "${mess.gebaeude.dachform}" wird in Etappe 2 nicht unterstützt (nur Satteldach).`,
    );
  }
  const breite = mess.gebaeude.footprint?.breite_mm?.wert;
  const tiefe = mess.gebaeude.footprint?.tiefe_mm?.wert;
  const traufe = mess.gebaeude.hoehen?.traufhoehe_mm?.wert;
  const first = mess.gebaeude.hoehen?.firsthoehe_mm?.wert;
  if (!breite || !tiefe || !traufe || !first) {
    throw new Error(
      "Baukasten: footprint (breite/tiefe) und hoehen (traufe/first) müssen im Mess-JSON gesetzt sein.",
    );
  }
  if (mess.anbauten && mess.anbauten.length > 0) {
    throw new Error(
      "Baukasten: Anbauten werden in Etappe 2 noch nicht dargestellt.",
    );
  }

  // Später: weitere Volumen (Anbauten/Gauben) hier erzeugen und mit
  // kombiniereVolumen(...) anfügen.
  const roh = hauptvolumenSatteldach(breite, tiefe, traufe, first);
  const systeme = fassadenSysteme(breite, tiefe);

  return {
    flaechen: ordneFlaechenZu(mess, roh.flaechen),
    kanten: ordneKantenZu(mess, roh.kanten),
    oeffnungen: baueOeffnungen(mess, systeme),
    breiteMm: breite,
    tiefeMm: tiefe,
    traufhoeheMm: traufe,
    firsthoeheMm: first,
  };
}
