import { describe, expect, it } from "vitest";
import { ladeTesthaus } from "../messung/testhaus";
import { baueHausModell } from "./baukasten";

// Erwartete Sparrenlänge: sqrt(4000² + 2500²) – ungerundet (Regel 1)
const SPARREN_MM = Math.hypot(4000, 2500);

describe("baueHausModell (Testhaus)", () => {
  const modell = baueHausModell(ladeTesthaus());

  it("ordnet alle Flächen-IDs zu (WL-1..WL-4, RF-1, RF-2)", () => {
    expect(modell.flaechen.map((f) => f.id).sort()).toEqual([
      "RF-1",
      "RF-2",
      "WL-1",
      "WL-2",
      "WL-3",
      "WL-4",
    ]);
  });

  it("legt RF-1 frontseitig (z = Tiefe) und RF-2 rückseitig (z = 0)", () => {
    const rf1 = modell.flaechen.find((f) => f.id === "RF-1")!;
    const rf2 = modell.flaechen.find((f) => f.id === "RF-2")!;
    // Eave-Kante von RF-1 liegt bei z = 8000, die von RF-2 bei z = 0
    expect(rf1.polygon.some(([, , z]) => z === 8000)).toBe(true);
    expect(rf2.polygon.some(([, , z]) => z === 0)).toBe(true);
    // beide enden am Ridge (z = 4000, y = 8000)
    for (const dach of [rf1, rf2]) {
      expect(
        dach.polygon.some(([, y, z]) => y === 8000 && z === 4000),
      ).toBe(true);
    }
  });

  it("ordnet alle Kanten-IDs zu und berechnet die Längen aus der Geometrie", () => {
    const laengen = new Map(modell.kanten.map((k) => [k.id, k.laengeMm]));
    expect([...laengen.keys()].sort()).toEqual([
      "E-1",
      "E-10",
      "E-11",
      "E-2",
      "E-3",
      "E-4",
      "E-5",
      "E-6",
      "E-7",
      "E-8",
      "E-9",
    ]);
    // Ridge und Eaves: 10 m
    expect(laengen.get("E-1")).toBe(10000);
    expect(laengen.get("E-2")).toBe(10000);
    expect(laengen.get("E-3")).toBe(10000);
    // Rakes: exakte Sparrenlänge, ungerundet
    for (const id of ["E-4", "E-5", "E-6", "E-7"]) {
      expect(laengen.get(id)).toBe(SPARREN_MM);
    }
    // Outside-Corners: Eave-Höhe 5,5 m
    for (const id of ["E-8", "E-9", "E-10", "E-11"]) {
      expect(laengen.get(id)).toBe(5500);
    }
  });

  it("platziert Rakes auf der richtigen Seite (E-4 frontseitig links)", () => {
    const e4 = modell.kanten.find((k) => k.id === "E-4")!;
    // links (x = 0), frontseitig (Start bei z = 8000)
    expect(e4.start[0]).toBe(0);
    expect(e4.ende[0]).toBe(0);
    expect(Math.max(e4.start[2], e4.ende[2])).toBe(8000);
    const e5 = modell.kanten.find((k) => k.id === "E-5")!;
    expect(Math.min(e5.start[2], e5.ende[2])).toBe(0);
  });

  it("platziert alle 10 Öffnungen leicht vor der jeweiligen Fassadenebene", () => {
    expect(modell.oeffnungen).toHaveLength(10);
    for (const oeffnung of modell.oeffnungen) {
      for (const [x, , z] of oeffnung.polygon) {
        switch (oeffnung.fassade) {
          case "front":
            expect(z).toBe(8040);
            break;
          case "back":
            expect(z).toBe(-40);
            break;
          case "left":
            expect(x).toBe(-40);
            break;
          case "right":
            expect(x).toBe(10040);
            break;
        }
      }
    }
  });

  it("übernimmt B × H der Öffnungen unverändert in die Geometrie", () => {
    const w1 = modell.oeffnungen.find((o) => o.id === "W-1")!;
    expect(w1.breiteMm).toBe(1200);
    expect(w1.hoeheMm).toBe(1400);
    const xs = w1.polygon.map(([x]) => x);
    const ys = w1.polygon.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1200);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(1400);
  });

  it("wirft bei nicht unterstütztem roof_type einen klaren Fehler", () => {
    const mess = ladeTesthaus();
    mess.building.roof_type = "flat";
    expect(() => baueHausModell(mess)).toThrowError(/roof_type/);
  });

  it("wirft, wenn eine Mess-Fläche keine Geometrie erhält", () => {
    const mess = ladeTesthaus();
    mess.faces.push({ ...mess.faces[0]!, id: "WL-99" });
    expect(() => baueHausModell(mess)).toThrowError(/WL-99/);
  });
});
