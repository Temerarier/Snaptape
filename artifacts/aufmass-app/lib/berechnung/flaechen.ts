// Berechnungsschicht v1 (Eiserne Regel 7): Berechnete Werte (brutto/netto,
// Summen) leben ausschließlich hier – niemals im Measurement-JSON.
// Alle Ein- und Ausgaben sind ungerundete mm bzw. mm² (Eiserne Regel 1).
import {
  ELEVATIONS,
  type Elevation,
  type MeasureJson,
  type Opening,
} from "../messung/schema";

export function oeffnungsFlaecheMm2(oeffnung: Opening): number {
  return oeffnung.width_mm.value * oeffnung.height_mm.value;
}

export function oeffnungsUmfangMm(oeffnung: Opening): number {
  return 2 * (oeffnung.width_mm.value + oeffnung.height_mm.value);
}

export interface FassadenFlaeche {
  fassade: Elevation;
  bruttoMm2: number;
  oeffnungenMm2: number;
  nettoMm2: number;
}

export function wandflaechenJeFassade(mess: MeasureJson): FassadenFlaeche[] {
  return ELEVATIONS.map((fassade) => {
    const bruttoMm2 = mess.faces
      .filter((f) => f.face_class === "wall" && f.elevation === fassade)
      .reduce((summe, f) => summe + f.area_mm2.value, 0);
    const oeffnungenMm2 = mess.openings
      .filter((o) => o.elevation === fassade)
      .reduce((summe, o) => summe + oeffnungsFlaecheMm2(o), 0);
    return {
      fassade,
      bruttoMm2,
      oeffnungenMm2,
      nettoMm2: bruttoMm2 - oeffnungenMm2,
    };
  });
}

export function dachGesamtMm2(mess: MeasureJson): number {
  return mess.faces
    .filter((f) => f.face_class === "roof_face")
    .reduce((summe, f) => summe + f.area_mm2.value, 0);
}

export interface KategorieSummen {
  dachMm2: number;
  waendeBruttoMm2: number;
  waendeNettoMm2: number;
  oeffnungenMm2: number;
  anzahlOeffnungen: number;
}

export function kategorieSummen(mess: MeasureJson): KategorieSummen {
  const waende = wandflaechenJeFassade(mess);
  const oeffnungenMm2 = mess.openings.reduce(
    (summe, o) => summe + oeffnungsFlaecheMm2(o),
    0,
  );
  return {
    dachMm2: dachGesamtMm2(mess),
    waendeBruttoMm2: waende.reduce((s, w) => s + w.bruttoMm2, 0),
    waendeNettoMm2: waende.reduce((s, w) => s + w.nettoMm2, 0),
    oeffnungenMm2,
    anzahlOeffnungen: mess.openings.length,
  };
}
