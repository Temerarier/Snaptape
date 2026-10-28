import { describe, expect, it } from "vitest";
import { computeDerived, type MeasurementInput } from "@workspace/measurement";
import { loadTestHouse, TEST_HOUSES } from "@/app/viewer-next/testHouses";
import { getSelectionDetails, snapMeasurePoint } from "../interaction";
import { modelFromModel3d } from "./fromModel3d";
import type { ViewerMeasurement } from "./input";
import type { Model3dData } from "@workspace/db";

const n = (v: unknown) => v && typeof v === "object" ? (v as { value?: number }).value ?? null : v ?? null;
const derivedFor = (m: unknown) => computeDerived(m as MeasurementInput);
describe("modelFromModel3d", () => {
  for (const house of TEST_HOUSES.slice(1)) {
    it(`${house.id}: real isolate geometry, IDs and measured display values`, async () => {
      const { measurement, model3d } = await loadTestHouse(house.id);
      expect(model3d).not.toBeNull();
      const m = measurement as ViewerMeasurement;
      const model = modelFromModel3d(model3d!, m, derivedFor(m));
      const all = [...model.walls, ...model.roofFaces, ...model.openings, ...model.attachments,
        ...model.edges, ...model.conditions];
      for (const group of ["flaechen", "oeffnungen", "anbauten", "kanten", "fallrohre", "schaeden"] as const) {
        for (const row of model3d![group]) expect(all.some(p => p.id === row.id_1_7)).toBe(true);
      }
      for (const wall of model.walls) {
        const face = m.faces?.find(f => f.id === wall.id);
        expect(wall.widthMm).toBe(n(face?.width_mm));
        expect(wall.heightMm).toBe(n(face?.height_mm));
        expect(wall.gableHeightMm).toBe(n(face?.gable_height_mm));
        expect(wall.areaMm2).toBe(n(face?.area_mm2));
        expect(wall.netAreaMm2).toBe(n(face?.net_area_mm2));
      }
      for (const roof of model.roofFaces) {
        const face = m.faces?.find(f => f.id === roof.id);
        expect(roof.areaMm2).toBe(n(face?.area_mm2));
        expect(roof.pitchRiseOver12).toBe(n(face?.pitch?.rise_over_12_snapped));
      }
      for (const opening of model.openings) {
        const measured = m.openings?.find(o => o.id === opening.id);
        expect(opening.widthMm).toBe(n(measured?.width_mm));
        expect(opening.heightMm).toBe(n(measured?.height_mm));
        expect(opening.areaMm2).toBe(n(measured?.area_mm2));
        expect(opening.type).toBe(measured?.type);
      }
      expect(all.every(p => p.corners.every(c => [c.x, c.y, c.z].every(Number.isFinite)))).toBe(true);
      expect(model.permanentDimensions.length?.valueMm).toBe(derivedFor(m).footprint.length_mm.value);
    }, 15000);
  }
  it("unknown measurement ID shows dashes, never a geometry-derived number", async () => {
    const { measurement, model3d } = await loadTestHouse("leipzig-villa");
    const input = structuredClone(model3d!);
    input.flaechen.push({ id_1_7: "UNKNOWN", art: "wand",
      ecken: [[0, 0, 0], [9999, 0, 0], [9999, 0, 8888], [0, 0, 8888]] });
    const model = modelFromModel3d(input, measurement as ViewerMeasurement, derivedFor(measurement));
    const wall = model.walls.find(w => w.id === "UNKNOWN")!;
    expect(wall.widthMm).toBeNull();
    expect(wall.heightMm).toBeNull();
    expect(getSelectionDetails(wall).dimensions).toEqual(["— × —"]);
    expect(getSelectionDetails(wall).value).toBe("— net");
  });
  it("retains split polygons under one ID and selects all their render targets", async () => {
    const { measurement, model3d } = await loadTestHouse("leipzig-villa");
    const input = structuredClone(model3d!);
    const first = input.flaechen.find(p => p.id_1_7 === "WL-1")!;
    input.flaechen.push(structuredClone(first));
    const model = modelFromModel3d(input, measurement as ViewerMeasurement, derivedFor(measurement));
    const split = model.walls.filter(p => p.id === "WL-1");
    expect(split.length).toBe(2);
    expect(split.every(p => p.widthMm === 14300 && p.heightMm === 8140)).toBe(true);
    expect(getSelectionDetails(split[0]!).dimensions).toEqual(["14,300 mm × 8,140 mm"]);
  });
  it("geometry perturbation cannot change displayed measurements or colors", async () => {
    const { measurement, model3d } = await loadTestHouse("leipzig-villa");
    const input = structuredClone(model3d!);
    for (const p of input.flaechen) {
      p.ecken = (p.ecken as number[][]).map(c => [c[0]! * 1.2, c[1]!, c[2]! * 1.3]);
      p.farbe = "#FF00FF";
    }
    const model = modelFromModel3d(input, measurement as ViewerMeasurement, derivedFor(measurement));
    const wall = model.walls.find(w => w.id === "WL-1")!;
    expect(wall.widthMm).toBe(14300);
    expect(wall.heightMm).toBe(8140);
    expect(wall.color.hex).toBe("#A59C7E");
    expect(wall.bounds.widthMm).not.toBe(wall.widthMm);
    expect(model.massing.every(p => !p.id.startsWith("WL-"))).toBe(true);
  });
  it("condition offset, downspout selection and farmhouse eave snapping use A geometry", async () => {
    const leipzig = await loadTestHouse("leipzig-villa");
    const model = modelFromModel3d(leipzig.model3d!, leipzig.measurement as ViewerMeasurement, derivedFor(leipzig.measurement));
    expect(model.edges.find(e => e.id === "DS-1")?.edgeClass).toBe("downspout");
    expect(model.conditions.find(c => c.id === "CA-1")?.parentFaceId).toBe("WL-3");
    const condition = model.conditions.find(c => c.id === "CA-1")!;
    const original = leipzig.model3d!.schaeden.find(c => c.id_1_7 === condition.id)!.ecken as number[][];
    expect(Math.hypot(condition.corners[0]!.x - original[0]![0]!,
      condition.corners[0]!.y - original[0]![1]!, condition.corners[0]!.z - original[0]![2]!)).toBeCloseTo(20);
    const house = await loadTestHouse("farmhouse-140040rk");
    const farmhouse = modelFromModel3d(house.model3d!, house.measurement as ViewerMeasurement, derivedFor(house.measurement));
    const eave = farmhouse.edges.find(e => e.edgeClass === "eave")!;
    const [a, b] = eave.corners;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    const snap = snapMeasurePoint(midpoint, farmhouse, { radiusMm: 1 });
    expect(snap.snapped).toBe(true);
    expect(snap.point).toEqual(midpoint);
  });
});
