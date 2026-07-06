import { describe, expect, it } from "vitest";
import { ladeTesthaus } from "../messung/testhaus";
import { baueHausModell } from "./baukasten";

// Erwartete Sparrenlänge: sqrt(4000² + 2500²) – ungerundet (Regel 1)
const SPARREN_MM = Math.hypot(4000, 2500);

describe("baueHausModell (Testhaus)", () => {
  const modell = baueHausModell(ladeTesthaus());

  it("ordnet alle Flächen-IDs zu (W-1..W-4, D-1, D-2)", () => {
    expect(modell.flaechen.map((f) => f.id).sort()).toEqual([
      "D-1",
      "D-2",
      "W-1",
      "W-2",
      "W-3",
      "W-4",
    ]);
  });

  it("legt D-1 strassenseitig (z = Tiefe) und D-2 gartenseitig (z = 0)", () => {
    const d1 = modell.flaechen.find((f) => f.id === "D-1")!;
    const d2 = modell.flaechen.find((f) => f.id === "D-2")!;
    // Traufkante von D-1 liegt bei z = 8000, die von D-2 bei z = 0
    expect(d1.polygon.some(([, , z]) => z === 8000)).toBe(true);
    expect(d2.polygon.some(([, , z]) => z === 0)).toBe(true);
    // beide enden am First (z = 4000, y = 8000)
    for (const dach of [d1, d2]) {
      expect(
        dach.polygon.some(([, y, z]) => y === 8000 && z === 4000),
      ).toBe(true);
    }
  });

  it("ordnet alle Kanten-IDs zu und berechnet die Längen aus der Geometrie", () => {
    const laengen = new Map(modell.kanten.map((k) => [k.id, k.laengeMm]));
    expect([...laengen.keys()].sort()).toEqual([
      "K-1",
      "K-10",
      "K-11",
      "K-2",
      "K-3",
      "K-4",
      "K-5",
      "K-6",
      "K-7",
      "K-8",
      "K-9",
    ]);
    // First und Traufen: 10 m
    expect(laengen.get("K-1")).toBe(10000);
    expect(laengen.get("K-2")).toBe(10000);
    expect(laengen.get("K-3")).toBe(10000);
    // Ortgänge: exakte Sparrenlänge, ungerundet
    for (const id of ["K-4", "K-5", "K-6", "K-7"]) {
      expect(laengen.get(id)).toBe(SPARREN_MM);
    }
    // Außenecken: Traufhöhe 5,5 m
    for (const id of ["K-8", "K-9", "K-10", "K-11"]) {
      expect(laengen.get(id)).toBe(5500);
    }
  });

  it("platziert Ortgänge auf der richtigen Seite (K-4 strassenseitig links)", () => {
    const k4 = modell.kanten.find((k) => k.id === "K-4")!;
    // links (x = 0), strassenseitig (Start bei z = 8000)
    expect(k4.start[0]).toBe(0);
    expect(k4.ende[0]).toBe(0);
    expect(Math.max(k4.start[2], k4.ende[2])).toBe(8000);
    const k5 = modell.kanten.find((k) => k.id === "K-5")!;
    expect(Math.min(k5.start[2], k5.ende[2])).toBe(0);
  });

  it("platziert alle 10 Öffnungen leicht vor der jeweiligen Fassadenebene", () => {
    expect(modell.oeffnungen).toHaveLength(10);
    for (const oeffnung of modell.oeffnungen) {
      for (const [x, , z] of oeffnung.polygon) {
        switch (oeffnung.fassade) {
          case "strassenseite":
            expect(z).toBe(8040);
            break;
          case "gartenseite":
            expect(z).toBe(-40);
            break;
          case "links":
            expect(x).toBe(-40);
            break;
          case "rechts":
            expect(x).toBe(10040);
            break;
        }
      }
    }
  });

  it("übernimmt B × H der Öffnungen unverändert in die Geometrie", () => {
    const f1 = modell.oeffnungen.find((o) => o.id === "F-1")!;
    expect(f1.breiteMm).toBe(1200);
    expect(f1.hoeheMm).toBe(1400);
    const xs = f1.polygon.map(([x]) => x);
    const ys = f1.polygon.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1200);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(1400);
  });

  it("wirft bei nicht unterstützter Dachform einen klaren Fehler", () => {
    const mess = ladeTesthaus();
    mess.gebaeude.dachform = "flachdach";
    expect(() => baueHausModell(mess)).toThrowError(/Dachform/);
  });

  it("wirft, wenn eine Mess-Fläche keine Geometrie erhält", () => {
    const mess = ladeTesthaus();
    mess.faces.push({ ...mess.faces[0]!, id: "W-99" });
    expect(() => baueHausModell(mess)).toThrowError(/W-99/);
  });
});
