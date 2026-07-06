// Berechnungsschicht v1 (Eiserne Regel 7): Berechnete Werte (brutto/netto,
// Summen) leben ausschließlich hier – niemals im Mess-JSON.
// Alle Ein- und Ausgaben sind ungerundete mm bzw. mm² (Eiserne Regel 1).
import {
  FASSADEN,
  type Fassade,
  type MessJson,
  type Opening,
} from "../messung/schema";

export function oeffnungsFlaecheMm2(oeffnung: Opening): number {
  return oeffnung.breite_mm.wert * oeffnung.hoehe_mm.wert;
}

export function oeffnungsUmfangMm(oeffnung: Opening): number {
  return 2 * (oeffnung.breite_mm.wert + oeffnung.hoehe_mm.wert);
}

export interface FassadenFlaeche {
  fassade: Fassade;
  bruttoMm2: number;
  oeffnungenMm2: number;
  nettoMm2: number;
}

export function wandflaechenJeFassade(mess: MessJson): FassadenFlaeche[] {
  return FASSADEN.map((fassade) => {
    const bruttoMm2 = mess.faces
      .filter((f) => f.face_class === "wand" && f.fassade === fassade)
      .reduce((summe, f) => summe + f.flaeche_mm2.wert, 0);
    const oeffnungenMm2 = mess.openings
      .filter((o) => o.fassade === fassade)
      .reduce((summe, o) => summe + oeffnungsFlaecheMm2(o), 0);
    return {
      fassade,
      bruttoMm2,
      oeffnungenMm2,
      nettoMm2: bruttoMm2 - oeffnungenMm2,
    };
  });
}

export function dachflaecheGesamtMm2(mess: MessJson): number {
  return mess.faces
    .filter((f) => f.face_class === "dachflaeche")
    .reduce((summe, f) => summe + f.flaeche_mm2.wert, 0);
}

export interface KategorieSummen {
  dachMm2: number;
  waendeBruttoMm2: number;
  waendeNettoMm2: number;
  oeffnungenMm2: number;
  anzahlOeffnungen: number;
}

export function kategorieSummen(mess: MessJson): KategorieSummen {
  const waende = wandflaechenJeFassade(mess);
  const oeffnungenMm2 = mess.openings.reduce(
    (summe, o) => summe + oeffnungsFlaecheMm2(o),
    0,
  );
  return {
    dachMm2: dachflaecheGesamtMm2(mess),
    waendeBruttoMm2: waende.reduce((s, w) => s + w.bruttoMm2, 0),
    waendeNettoMm2: waende.reduce((s, w) => s + w.nettoMm2, 0),
    oeffnungenMm2,
    anzahlOeffnungen: mess.openings.length,
  };
}
