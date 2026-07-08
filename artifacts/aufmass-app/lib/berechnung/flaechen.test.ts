// Unit-Tests der Berechnungsschicht gegen die Handrechnung des Test-Hauses.
// Handrechnung (siehe Fixture-Hinweise):
//   Footprint 10000 x 8000, Eave 5500, Ridge 8000 -> Stich 2500 auf 4000
//   Sparren = sqrt(4000^2 + 2500^2) = 4716.990566028302 mm
//   Dach je Seite = 47.169905660283024 m^2, gesamt = 94.33981132056605 m^2
//   Waende brutto: front 55.0 / back 55.0 / left 54.0 / right 54.0 = 218.0 m^2
//   Oeffnungen: front 10.48 (W-1 1.68 + W-2 1.2 + D-1 2.1 + G-1 5.5),
//               back 2.88, left 2.88, right 2.88 = 19.12 m^2
//   Netto: front 44.52 / back 52.12 / left 51.12 / right 51.12 = 198.88 m^2
import { describe, expect, it } from "vitest";
import { ladeTesthaus } from "../messung/testhaus";
import {
  dachGesamtMm2,
  kategorieSummen,
  oeffnungsFlaecheMm2,
  wandflaechenJeFassade,
} from "./flaechen";

const mess = ladeTesthaus();
const M2 = 1_000_000;

describe("Fixture-Vertrag", () => {
  it("validiert fehlerfrei gegen das Mess-Schema (wirft sonst)", () => {
    expect(mess.meta.unit).toBe("mm");
    expect(mess.building.roof_type).toBe("gable");
  });

  it("enthält 8 Fenster, 1 Tür, 1 Garagentor", () => {
    expect(mess.openings.filter((o) => o.type === "window")).toHaveLength(8);
    expect(mess.openings.filter((o) => o.type === "door")).toHaveLength(1);
    expect(mess.openings.filter((o) => o.type === "garage_door")).toHaveLength(
      1,
    );
  });

  it("trägt an jeder Öffnung den Hinweis „Reference only, not for ordering“ (Regel 5)", () => {
    for (const o of mess.openings) {
      expect(o.note).toBe("Reference only, not for ordering");
    }
  });

  it("hält berechnete Werte aus dem Measurement-JSON heraus (Regel 7)", () => {
    for (const f of mess.faces) {
      expect(f.net_area_mm2).toBeNull();
    }
    for (const o of mess.openings) {
      expect(o.area_mm2).toBeNull();
      expect(o.perimeter_mm).toBeNull();
    }
  });

  it("hat die Dachneigung ~32° exakt aus der Geometrie", () => {
    const erwartet = (Math.atan(2500 / 4000) * 180) / Math.PI;
    for (const dach of mess.faces.filter(
      (f) => f.face_class === "roof_face",
    )) {
      expect(dach.pitch?.degrees_original).toBeCloseTo(erwartet, 9);
    }
  });
});

describe("Wandflächen je Elevation", () => {
  const wände = wandflaechenJeFassade(mess);
  const je = (fassade: string) => wände.find((w) => w.fassade === fassade)!;

  it("brutto stimmt mit der Handrechnung überein", () => {
    expect(je("front").bruttoMm2 / M2).toBeCloseTo(55.0, 9);
    expect(je("back").bruttoMm2 / M2).toBeCloseTo(55.0, 9);
    expect(je("left").bruttoMm2 / M2).toBeCloseTo(54.0, 9);
    expect(je("right").bruttoMm2 / M2).toBeCloseTo(54.0, 9);
  });

  it("Öffnungsabzug je Elevation stimmt", () => {
    expect(je("front").oeffnungenMm2 / M2).toBeCloseTo(10.48, 9);
    expect(je("back").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
    expect(je("left").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
    expect(je("right").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
  });

  it("netto stimmt mit der Handrechnung überein", () => {
    expect(je("front").nettoMm2 / M2).toBeCloseTo(44.52, 9);
    expect(je("back").nettoMm2 / M2).toBeCloseTo(52.12, 9);
    expect(je("left").nettoMm2 / M2).toBeCloseTo(51.12, 9);
    expect(je("right").nettoMm2 / M2).toBeCloseTo(51.12, 9);
  });
});

describe("Dachfläche", () => {
  it("gesamt = 2 Seiten à Sparren x Ridge", () => {
    const sparren = Math.sqrt(4000 ** 2 + 2500 ** 2);
    const erwartetMm2 = 2 * sparren * 10000;
    expect(dachGesamtMm2(mess)).toBeCloseTo(erwartetMm2, 3);
    expect(dachGesamtMm2(mess) / M2).toBeCloseTo(94.33981132056605, 6);
  });
});

describe("Kategoriesummen", () => {
  const summen = kategorieSummen(mess);

  it("Wände brutto 218,0 m² / netto 198,88 m²", () => {
    expect(summen.waendeBruttoMm2 / M2).toBeCloseTo(218.0, 9);
    expect(summen.waendeNettoMm2 / M2).toBeCloseTo(198.88, 9);
  });

  it("Öffnungen 19,12 m² bei 10 Stück", () => {
    expect(summen.oeffnungenMm2 / M2).toBeCloseTo(19.12, 9);
    expect(summen.anzahlOeffnungen).toBe(10);
  });

  it("Dach 94,34 m²", () => {
    expect(summen.dachMm2 / M2).toBeCloseTo(94.33981132056605, 6);
  });
});

describe("Einzel-Öffnung", () => {
  it("W-1: 1200 x 1400 = 1,68 m²", () => {
    const w1 = mess.openings.find((o) => o.id === "W-1")!;
    expect(oeffnungsFlaecheMm2(w1)).toBe(1200 * 1400);
  });
});
