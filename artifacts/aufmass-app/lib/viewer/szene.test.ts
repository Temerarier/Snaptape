// Tests der WebGL-freien Viewer-Logik: Labeltext (ID + Länge) und
// Zoom-Ausdünnung der Maß-Labels. Die Werte entsprechen dem Test-Haus
// (fixtures/testhaus.json): First/Traufen 10 m, Ortgänge ~4,72 m,
// Außenecken 5,50 m.
import { describe, expect, it } from "vitest";
import { formatMeter } from "./anzeige";
import { istMassLabelSichtbar, massLabelText } from "./szene";

describe("massLabelText", () => {
  it("zeigt Bauteil-ID und Länge im Format „K-9 · 5,50 m“", () => {
    expect(massLabelText("K-9", 5500, formatMeter)).toBe("K-9 · 5,50 m");
  });

  it("rundet nur in der Anzeige (ungerundete mm bleiben Eingabe)", () => {
    // 4718,3 mm intern → Anzeige 4,72 m (Eiserne Regel 1)
    expect(massLabelText("K-4", 4718.3, formatMeter)).toBe("K-4 · 4,72 m");
  });
});

describe("istMassLabelSichtbar (Ausdünnung bei kleinem Zoom)", () => {
  it("zeigt in der Startansicht (~22 m Abstand) alle Kanten-Labels", () => {
    expect(istMassLabelSichtbar(10.0, 22)).toBe(true); // First/Traufe
    expect(istMassLabelSichtbar(5.5, 22)).toBe(true); // Außenecke
    expect(istMassLabelSichtbar(4.72, 22)).toBe(true); // Ortgang
  });

  it("blendet beim Herauszoomen kurze Kanten zuerst aus", () => {
    // Bei ~35 m: Ortgang (4,72 m) weg, Außenecke (5,50 m) noch da
    expect(istMassLabelSichtbar(4.72, 35)).toBe(false);
    expect(istMassLabelSichtbar(5.5, 35)).toBe(true);
    // Bei ~40 m: auch Außenecken weg, lange Kanten (10 m) bleiben
    expect(istMassLabelSichtbar(5.5, 40)).toBe(false);
    expect(istMassLabelSichtbar(10.0, 40)).toBe(true);
  });

  it("zeigt beim Hineinzoomen wieder alle Labels", () => {
    expect(istMassLabelSichtbar(4.72, 5)).toBe(true);
    expect(istMassLabelSichtbar(5.5, 5)).toBe(true);
  });

  it("ist robust gegen Abstand 0 (Kamera im Label)", () => {
    expect(istMassLabelSichtbar(5.5, 0)).toBe(true);
  });
});
