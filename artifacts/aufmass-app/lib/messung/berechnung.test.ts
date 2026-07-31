// Unit-Tests des Fix-Packs A0-A7/B1-B3 gegen den 1:1-Port in
// berechnung.ts (Vorlage: docs/pipeline/compute.js und
// validate-assemble.js – Logik muss identisch bleiben).
import { describe, expect, it } from "vitest";
import {
  berechneKonsolidierung,
  heileNullFelder,
  validiereUndAssembliere,
} from "./berechnung";

const mess = (value: number, confidence = "high", source = "measured") => ({
  value,
  confidence,
  source,
  reference_used: "test",
  low_reason: null,
});

describe("A0: footprint.points null -> [] im Produktions-Validierungspfad", () => {
  // echterExtraktor ruft validiereUndAssembliere auf und persistiert
  // geprueft.result – points: null darf dort nie ankommen.
  it("normalisiert points: null zu [], bevor das Ergebnis gespeichert wird", () => {
    const out = validiereUndAssembliere({
      result: {
        meta: { country: "DE" },
        building: {
          roof_type: "gable",
          footprint: { points: null, width_mm: mess(10_000), depth_mm: mess(8_000) },
        },
        references: [],
        faces: [{ id: "WL-1", face_class: "wall", elevation: "front", area_mm2: mess(50_000_000) }],
        edges: [{ id: "E-1", edge_class: "eave", length_mm: mess(10_000) }],
        openings: [],
      },
    } as any);
    expect(out.result.building.footprint.points).toEqual([]);
    expect(out.violations).not.toContain("building.footprint.points is not an array");
  });

  it("normalisiert auch fehlende points zu [] und meldet Nicht-Arrays als Verstoß", () => {
    const basis = (points: unknown, mitPoints: boolean) => ({
      result: {
        meta: { country: "DE" },
        building: {
          roof_type: "gable",
          footprint: mitPoints ? { points } : {},
        },
        references: [],
        faces: [{ id: "WL-1", face_class: "wall", elevation: "front", area_mm2: mess(50_000_000) }],
        edges: [{ id: "E-1", edge_class: "eave", length_mm: mess(10_000) }],
        openings: [],
      },
    });
    const ohne = validiereUndAssembliere(basis(undefined, false) as any);
    expect(ohne.result.building.footprint.points).toEqual([]);
    const falsch = validiereUndAssembliere(basis("keine Liste", true) as any);
    expect(falsch.result.building.footprint.points).toEqual([]);
    expect(falsch.violations).toContain("building.footprint.points is not an array");
  });
});

describe("A1: heileNullFelder (eine Heilungsrunde vor der zweiten Validierung)", () => {
  it("entfernt null-Eigenschaften bei 'must be number' und ersetzt Arrays durch []", () => {
    const doc: any = {
      faces: [{ id: "RF-1", pitch: { degrees_original: 35, rise_over_12_snapped: null } }],
      downspouts: null,
    };
    const healed = heileNullFelder(doc, [
      { instancePath: "/faces/0/pitch/rise_over_12_snapped", message: "must be number" },
      { instancePath: "/downspouts", message: "must be array" },
    ]);
    expect(healed).toBe(2);
    expect("rise_over_12_snapped" in doc.faces[0].pitch).toBe(false);
    expect(doc.downspouts).toEqual([]);
  });

  it("heilt benachbarte null-Array-Elemente ohne Index-Verschiebung", () => {
    const doc: any = { edges: [null, null, { id: "E-1" }] };
    const healed = heileNullFelder(doc, [
      { instancePath: "/edges/0", message: "must be object" },
      { instancePath: "/edges/1", message: "must be object" },
    ]);
    expect(healed).toBe(2);
    expect(doc.edges).toEqual([{ id: "E-1" }]);
  });

  it("lässt nicht-null-Werte und fremde Fehlermeldungen unangetastet", () => {
    const doc: any = { building: { roof_type: 42 } };
    const healed = heileNullFelder(doc, [
      { instancePath: "/building/roof_type", message: "must be string" }, // Wert ist 42, nicht null
      { instancePath: "/building", message: "must have required property 'footprint'" },
    ]);
    expect(healed).toBe(0);
    expect(doc.building.roof_type).toBe(42);
  });
});

describe("A3: Ridge-Klemmung bei mehreren Firstkanten", () => {
  const basis = (edges: any[]) => ({
    result: {
      building: {
        roof_type: "hip",
        footprint: { width_mm: mess(10_000), depth_mm: mess(8_000) },
      },
      edges,
      quality: { warnings: [] },
    },
  });

  it("skaliert bei zwei Firsten NICHT mehr die Summe herunter", () => {
    // Summe 17500 > 10000 * 1.05 – früher wurden BEIDE Kanten reskaliert.
    const p = berechneKonsolidierung(basis([
      { id: "E-1", edge_class: "ridge", length_mm: mess(9_500) },
      { id: "E-2", edge_class: "ridge", length_mm: mess(8_000) },
    ]) as any);
    expect(p.result.edges[0].length_mm.value).toBe(9_500);
    expect(p.result.edges[1].length_mm.value).toBe(8_000);
    expect(p.result.quality.warnings).toEqual([]);
  });

  it("klemmt eine einzelne zu lange Firstkante auf Footprint-Max x 1,05 mit Warnung je Kante", () => {
    const p = berechneKonsolidierung(basis([
      { id: "E-1", edge_class: "ridge", length_mm: mess(12_000) },
      { id: "E-2", edge_class: "ridge", length_mm: mess(8_000) },
    ]) as any);
    expect(p.result.edges[0].length_mm.value).toBe(10_500); // 10000 * 1.05
    expect(p.result.edges[1].length_mm.value).toBe(8_000);
    const warnungen = p.result.quality.warnings as string[];
    expect(warnungen).toHaveLength(1);
    expect(warnungen[0]).toContain("E-1");
    expect(warnungen[0]).toContain("clamped in code");
  });

  it("behält die Summen-Klemmung für den Einzel-First-Fall bei", () => {
    const p = berechneKonsolidierung(basis([
      { id: "E-1", edge_class: "ridge", length_mm: mess(12_000) },
    ]) as any);
    expect(p.result.edges[0].length_mm.value).toBe(10_000); // auf maxWT reskaliert
    expect((p.result.quality.warnings as string[])[0]).toContain("exceeds footprint max");
  });
});

describe("A4: Konfidenz nach Ausreißer-Entfernung höchstens 'low'", () => {
  it("deckelt die Konsolidierungs-Konfidenz auf low, wenn Ausreißer entfernt wurden", () => {
    const p = berechneKonsolidierung({
      result: {
        quality: {
          warnings: [],
          raw_estimates: [
            { target: "total_width", estimate_mm: 10_000, reliability: "high", photo_index: 1 },
            { target: "total_width", estimate_mm: 10_100, reliability: "high", photo_index: 2 },
            { target: "total_width", estimate_mm: 14_000, reliability: "high", photo_index: 3 }, // Ausreißer >10 %
          ],
        },
      },
    } as any);
    const breite = p.result.building.footprint.width_mm;
    expect(breite.confidence).toBe("low");
    expect(breite.low_reason).toContain("outlier");
    expect((p.result.quality.warnings as string[]).some(w => w.includes("outlier"))).toBe(true);
  });

  it("bleibt ohne Ausreißer bei enger Streuung 'high'", () => {
    const p = berechneKonsolidierung({
      result: {
        quality: {
          warnings: [],
          raw_estimates: [
            { target: "total_width", estimate_mm: 10_000, reliability: "high", photo_index: 1 },
            { target: "total_width", estimate_mm: 10_100, reliability: "high", photo_index: 2 },
          ],
        },
      },
    } as any);
    expect(p.result.building.footprint.width_mm.confidence).toBe("high");
  });
});

describe("B1: Flache Flächen (<10°) verfälschen die Pitch-Statistik nicht", () => {
  it("löst mit flachem Anbau (2°) neben 35°/42°-Flächen keine Unequal-Pitch-Anpassung mehr aus", () => {
    // Gable 10000 x 8000, First 10000 – konsistent. Früher machte die
    // 2°-Fläche pMax-pMin > 8 und erzeugte falsche Ridge-Warnungen.
    const out = validiereUndAssembliere({
      result: {
        meta: { country: "DE" },
        building: {
          roof_type: "gable",
          footprint: { width_mm: mess(10_000), depth_mm: mess(8_000) },
          heights: { eave_height_mm: mess(5_500), ridge_height_mm: mess(8_000) },
        },
        references: [],
        faces: [
          { id: "RF-1", face_class: "roof_face", pitch: { degrees_original: 35 } },
          { id: "RF-2", face_class: "roof_face", pitch: { degrees_original: 35 } },
          { id: "RF-3", face_class: "roof_face", pitch: { degrees_original: 2 } }, // flacher Anbau
          { id: "WL-1", face_class: "wall", elevation: "front", area_mm2: mess(50_000_000) },
        ],
        edges: [{ id: "E-1", edge_class: "ridge", length_mm: mess(10_000) }],
        openings: [],
      },
    } as any);
    const warnungen = out.result.quality.warnings as string[];
    expect(warnungen.some(w => w.includes("unequal facet pitches"))).toBe(false);
    expect(warnungen.some(w => w.includes("geometry check ridge length"))).toBe(false);
  });
});

describe("B2: Öffnungen über der Traufe reduzieren die Wandfläche nicht", () => {
  it("schließt Gauben-Fenster (Brüstung >= Traufhöhe) aus Brutto-minus-Öffnungen aus", () => {
    const p = berechneKonsolidierung({
      result: {
        building: { heights: { eave_height_mm: mess(6_450) } },
        faces: [
          { id: "WL-1", face_class: "wall", elevation: "back", area_mm2: mess(50_000_000) },
        ],
        openings: [
          { id: "W-1", elevation: "back", width_mm: mess(1_000), height_mm: mess(2_000), sill_height_mm: mess(900) },
          { id: "W-2", elevation: "back", width_mm: mess(1_500), height_mm: mess(2_000), sill_height_mm: mess(7_350) }, // Gaube über Traufe
        ],
        quality: { warnings: [] },
      },
    } as any);
    // Nur W-1 (2 m²) wird abgezogen, W-2 (3 m²) nicht.
    expect(p.result.faces[0].net_area_mm2.value).toBe(48_000_000);
  });

  it("nutzt die per_elevation-Traufhöhe, wenn vorhanden", () => {
    const p = berechneKonsolidierung({
      result: {
        building: {
          heights: {
            eave_height_mm: mess(6_450),
            per_elevation: [{ elevation: "back", eave_height_mm: mess(4_000) }],
          },
        },
        faces: [
          { id: "WL-1", face_class: "wall", elevation: "back", area_mm2: mess(50_000_000) },
        ],
        openings: [
          // Brüstung 4500 liegt über der elevationsspezifischen Traufe (4000),
          // aber unter der globalen (6450) – muss ausgeschlossen werden.
          { id: "W-1", elevation: "back", width_mm: mess(1_000), height_mm: mess(2_000), sill_height_mm: mess(4_500) },
        ],
        quality: { warnings: [] },
      },
    } as any);
    expect(p.result.faces[0].net_area_mm2.value).toBe(50_000_000);
  });
});
