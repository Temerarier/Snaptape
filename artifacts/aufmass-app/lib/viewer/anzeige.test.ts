// Tests der imperialen Anzeige-Formatierung (Schema v1.2, US-Markt).
// Eiserne Regel 1: Eingaben sind ungerundete mm/mm², gerundet wird
// ausschließlich in der Anzeige.
import { describe, expect, it } from "vitest";
import {
  formatBreiteHoeheFtIn,
  formatFtIn,
  formatGrad,
  formatMm2Roh,
  formatMmRoh,
  formatPitch,
  formatQuadratfuss,
} from "./anzeige";

describe("formatFtIn", () => {
  it("formatiert Fuß und Zoll, z. B. 4551 mm → 14' 11\"", () => {
    expect(formatFtIn(4551)).toBe("14' 11\"");
  });

  it("rundet auf ganze Zoll (5500 mm → 18' 1\")", () => {
    expect(formatFtIn(5500)).toBe("18' 1\"");
  });

  it("verarbeitet ungerundete interne mm (4718,3 mm → 15' 6\")", () => {
    expect(formatFtIn(4718.3)).toBe("15' 6\"");
  });

  it("zeigt glatte Fuß mit 0 Zoll (304,8 mm → 1' 0\")", () => {
    expect(formatFtIn(304.8)).toBe("1' 0\"");
  });

  it("zeigt unter einem Fuß nur Zoll (254 mm → 10\")", () => {
    expect(formatFtIn(254)).toBe('10"');
  });
});

describe("formatBreiteHoeheFtIn", () => {
  it("formatiert B × H (1200 × 1400 mm → 3' 11\" × 4' 7\")", () => {
    expect(formatBreiteHoeheFtIn(1200, 1400)).toBe("3' 11\" × 4' 7\"");
  });
});

describe("formatQuadratfuss", () => {
  it("rundet auf ganze ft² (1 ft² = 92903,04 mm²)", () => {
    expect(formatQuadratfuss(92903.04)).toBe("1 ft²");
    expect(formatQuadratfuss(185806.08)).toBe("2 ft²");
  });

  it("Dachfläche des Testhauses: 94,34 m² → 1.015 ft²", () => {
    expect(formatQuadratfuss(94339811.32056605)).toBe("1.015 ft²");
  });
});

describe("formatPitch", () => {
  it("zeigt den US-Pitch mit Punkt (7.5/12)", () => {
    expect(formatPitch(7.5)).toBe("7.5/12");
    expect(formatPitch(4)).toBe("4/12");
  });
});

describe("Roh-Formate für Tooltips (ungerundete interne Werte)", () => {
  it("formatGrad zeigt den exakten Gradwert", () => {
    expect(formatGrad(32.005383208083494)).toBe("32,005383°");
  });

  it("formatMmRoh/formatMm2Roh zeigen ungerundete mm/mm²", () => {
    expect(formatMmRoh(4718.3)).toBe("4.718,3 mm");
    expect(formatMm2Roh(1680000)).toBe("1.680.000 mm²");
  });
});
