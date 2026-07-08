// Tests der WebGL-freien Viewer-Logik: Labeltext (ID + Länge) und
// Zoom-Ausdünnung der Maß-Labels. Die Werte entsprechen dem Test-Haus
// (fixtures/testhaus.json): Ridge/Eaves 10 m, Rakes ~4,72 m,
// Outside-Corners 5,50 m. Anzeige imperial (Schema v1.2, ft-in).
import { describe, expect, it } from "vitest";
import { formatFtIn } from "./anzeige";
import { istMassLabelSichtbar, massLabelText } from "./szene";

describe("massLabelText", () => {
  it("zeigt Component-ID und Länge im Format „E-9 · 18' 1\"“", () => {
    expect(massLabelText("E-9", 5500, formatFtIn)).toBe("E-9 · 18' 1\"");
  });

  it("rundet nur in der Anzeige (ungerundete mm bleiben Eingabe)", () => {
    // 4718,3 mm intern → Anzeige 15' 6" (Eiserne Regel 1)
    expect(massLabelText("E-4", 4718.3, formatFtIn)).toBe("E-4 · 15' 6\"");
  });
});

describe("istMassLabelSichtbar (Ausdünnung bei kleinem Zoom)", () => {
  it("zeigt in der Startansicht (~22 m Abstand) alle Kanten-Labels", () => {
    expect(istMassLabelSichtbar(10.0, 22)).toBe(true); // Ridge/Eave
    expect(istMassLabelSichtbar(5.5, 22)).toBe(true); // Outside-Corner
    expect(istMassLabelSichtbar(4.72, 22)).toBe(true); // Rake
  });

  it("blendet beim Herauszoomen kurze Kanten zuerst aus", () => {
    // Bei ~35 m: Rake (4,72 m) weg, Outside-Corner (5,50 m) noch da
    expect(istMassLabelSichtbar(4.72, 35)).toBe(false);
    expect(istMassLabelSichtbar(5.5, 35)).toBe(true);
    // Bei ~40 m: auch Outside-Corners weg, lange Kanten (10 m) bleiben
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
