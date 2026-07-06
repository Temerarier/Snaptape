// Unit-Tests der Berechnungsschicht gegen die Handrechnung des Test-Hauses.
// Handrechnung (siehe Fixture-Hinweise):
//   Footprint 10000 x 8000, Traufe 5500, First 8000 -> Stich 2500 auf 4000
//   Sparren = sqrt(4000^2 + 2500^2) = 4716.990566028302 mm
//   Dach je Seite = 47.169905660283024 m^2, gesamt = 94.33981132056605 m^2
//   Waende brutto: strasse 55.0 / garten 55.0 / links 54.0 / rechts 54.0 = 218.0 m^2
//   Oeffnungen: strasse 10.48 (F-1 1.68 + F-2 1.2 + T-1 2.1 + G-1 5.5),
//               garten 2.88, links 2.88, rechts 2.88 = 19.12 m^2
//   Netto: strasse 44.52 / garten 52.12 / links 51.12 / rechts 51.12 = 198.88 m^2
import { describe, expect, it } from "vitest";
import { ladeTesthaus } from "../messung/testhaus";
import {
  dachflaecheGesamtMm2,
  kategorieSummen,
  oeffnungsFlaecheMm2,
  wandflaechenJeFassade,
} from "./flaechen";

const mess = ladeTesthaus();
const M2 = 1_000_000;

describe("Fixture-Vertrag", () => {
  it("validiert fehlerfrei gegen das Mess-Schema (wirft sonst)", () => {
    expect(mess.meta.einheit).toBe("mm");
    expect(mess.gebaeude.dachform).toBe("satteldach");
  });

  it("enthält 8 Fenster, 1 Tür, 1 Garagentor", () => {
    expect(mess.openings.filter((o) => o.typ === "fenster")).toHaveLength(8);
    expect(mess.openings.filter((o) => o.typ === "tuer")).toHaveLength(1);
    expect(mess.openings.filter((o) => o.typ === "garagentor")).toHaveLength(1);
  });

  it("trägt an jeder Öffnung den Hinweis „Richtmaß, kein Bestellmaß“ (Regel 5)", () => {
    for (const o of mess.openings) {
      expect(o.hinweis).toBe("Richtmaß, kein Bestellmaß");
    }
  });

  it("hält berechnete Werte aus dem Mess-JSON heraus (Regel 7)", () => {
    for (const f of mess.faces) {
      expect(f.flaeche_netto_mm2).toBeNull();
    }
    for (const o of mess.openings) {
      expect(o.flaeche_mm2).toBeNull();
      expect(o.umfang_mm).toBeNull();
    }
  });

  it("hat die Dachneigung ~32° exakt aus der Geometrie", () => {
    const erwartet = (Math.atan(2500 / 4000) * 180) / Math.PI;
    for (const dach of mess.faces.filter(
      (f) => f.face_class === "dachflaeche",
    )) {
      expect(dach.neigung?.original_grad).toBeCloseTo(erwartet, 9);
    }
  });
});

describe("Wandflächen je Fassade", () => {
  const wände = wandflaechenJeFassade(mess);
  const je = (fassade: string) => wände.find((w) => w.fassade === fassade)!;

  it("brutto stimmt mit der Handrechnung überein", () => {
    expect(je("strassenseite").bruttoMm2 / M2).toBeCloseTo(55.0, 9);
    expect(je("gartenseite").bruttoMm2 / M2).toBeCloseTo(55.0, 9);
    expect(je("links").bruttoMm2 / M2).toBeCloseTo(54.0, 9);
    expect(je("rechts").bruttoMm2 / M2).toBeCloseTo(54.0, 9);
  });

  it("Öffnungsabzug je Fassade stimmt", () => {
    expect(je("strassenseite").oeffnungenMm2 / M2).toBeCloseTo(10.48, 9);
    expect(je("gartenseite").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
    expect(je("links").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
    expect(je("rechts").oeffnungenMm2 / M2).toBeCloseTo(2.88, 9);
  });

  it("netto stimmt mit der Handrechnung überein", () => {
    expect(je("strassenseite").nettoMm2 / M2).toBeCloseTo(44.52, 9);
    expect(je("gartenseite").nettoMm2 / M2).toBeCloseTo(52.12, 9);
    expect(je("links").nettoMm2 / M2).toBeCloseTo(51.12, 9);
    expect(je("rechts").nettoMm2 / M2).toBeCloseTo(51.12, 9);
  });
});

describe("Dachfläche", () => {
  it("gesamt = 2 Seiten à Sparren x First", () => {
    const sparren = Math.sqrt(4000 ** 2 + 2500 ** 2);
    const erwartetMm2 = 2 * sparren * 10000;
    expect(dachflaecheGesamtMm2(mess)).toBeCloseTo(erwartetMm2, 3);
    expect(dachflaecheGesamtMm2(mess) / M2).toBeCloseTo(94.33981132056605, 6);
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
  it("F-1: 1200 x 1400 = 1,68 m²", () => {
    const f1 = mess.openings.find((o) => o.id === "F-1")!;
    expect(oeffnungsFlaecheMm2(f1)).toBe(1200 * 1400);
  });
});
