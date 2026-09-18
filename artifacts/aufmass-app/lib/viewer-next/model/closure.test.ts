import { describe, expect, it } from "vitest";
import fixture from "../../../../../fixtures/garage-house.json";
import { buildModel, buildPresentationClosure } from "./index";
import type {
  Bounds3,
  ModelAttachment,
  ModelColor,
  ModelPolygon,
  Point3,
  Triangle,
  ViewerModel,
} from "./types";

const COLOR: ModelColor = {
  hex: "rgb(128 128 128)",
  secondaryHex: null,
  confidence: null,
  neutral: true,
};

function bounds(corners: readonly Point3[]): Bounds3 {
  const min = {
    x: Math.min(...corners.map(point => point.x)),
    y: Math.min(...corners.map(point => point.y)),
    z: Math.min(...corners.map(point => point.z)),
  };
  const max = {
    x: Math.max(...corners.map(point => point.x)),
    y: Math.max(...corners.map(point => point.y)),
    z: Math.max(...corners.map(point => point.z)),
  };
  return {
    min,
    max,
    widthMm: max.x - min.x,
    depthMm: max.y - min.y,
    heightMm: max.z - min.z,
  };
}

function roof(id: string, x0: number, y0: number, x1: number, y1: number): ModelPolygon {
  const corners = [
    { x: x0, y: y0, z: 10 },
    { x: x1, y: y0, z: 10 },
    { x: x1, y: y1, z: 10 },
    { x: x0, y: y1, z: 10 },
  ];
  const triangles: readonly Triangle[] = [
    [corners[0], corners[1], corners[2]],
    [corners[0], corners[2], corners[3]],
  ];
  return {
    id,
    corners,
    triangles,
    normal: { x: 0, y: 0, z: 1 },
    frame: {
      origin: corners[0],
      tangent: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: 0, z: 1 },
    },
    bounds: bounds(corners),
    color: COLOR,
    elevation: "roof",
  };
}

function addition(id: string, x0: number, y0: number, x1: number, y1: number): ModelAttachment {
  const bottom = [
    { x: x0, y: y0, z: 0 },
    { x: x1, y: y0, z: 0 },
    { x: x1, y: y1, z: 0 },
    { x: x0, y: y1, z: 0 },
  ] as const;
  const top = bottom.map(item => ({ ...item, z: 5 }));
  const corners = [...bottom, ...top];
  return {
    ...roof(id, x0, y0, x1, y1),
    corners,
    triangles: [],
    bounds: bounds(corners),
    type: "addition",
    widthMm: x1 - x0,
    depthMm: y1 - y0,
    heightMm: 5,
    parentFaceId: null,
  };
}

function syntheticModel(roofs: readonly ModelPolygon[], attachments: readonly ModelAttachment[] = []): ViewerModel {
  const all = [...roofs, ...attachments];
  const overall = bounds(all.flatMap(item => [...item.corners]));
  return {
    walls: [],
    roofFaces: roofs as ViewerModel["roofFaces"],
    roofs: roofs as ViewerModel["roofFaces"],
    edges: [],
    openings: [],
    attachments,
    conditions: [],
    massing: [],
    bounds: {
      main: overall,
      overall,
      widthMm: overall.widthMm,
      depthMm: overall.depthMm,
      heightMm: overall.heightMm,
      overallWidthMm: overall.widthMm,
      overallDepthMm: overall.depthMm,
    },
    permanentDimensions: {
      width: { kind: "width", valueMm: 0, label: "", segments: [] },
      ridge: { kind: "ridge", valueMm: 0, label: "", segments: [] },
      ridgeAggregate: { kind: "ridge", valueMm: 0, label: "", segments: [] },
      eaveHeight: { kind: "eave_height", valueMm: 0, label: "", segments: [] },
    },
    diagnostics: [],
    notes: [],
  };
}

function horizontalArea(polygons: readonly ModelPolygon[]): number {
  return polygons
    .filter(polygon => Math.abs(polygon.normal.z) > 0.99)
    .flatMap(polygon => polygon.triangles)
    .reduce((sum, [a, b, c]) =>
      sum + Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2, 0);
}

describe("viewer presentation volume closure", () => {
  it("caps the fixture's concave main-plus-garage outline without filling its bounding-box notch", () => {
    const model = buildModel(fixture);
    const before = JSON.stringify({
      walls: model.walls.map(wall => [wall.id, wall.areaMm2, wall.netAreaMm2]),
      roofs: model.roofFaces.map(roofFace => [roofFace.id, roofFace.areaMm2]),
      dimensions: model.permanentDimensions,
    });

    const closure = buildPresentationClosure(model);
    const caps = closure.filter(polygon => polygon.id.startsWith("presentation-cap-"));
    const seams = closure.filter(polygon => polygon.id.startsWith("presentation-seam-"));
    const garageSeams = seams.filter(seam =>
      Math.abs(seam.bounds.min.y - 6_705.6) < 1e-6 &&
      Math.abs(seam.bounds.max.y - 6_705.6) < 1e-6);
    const crossGableSeams = seams.filter(seam =>
      Math.abs(seam.bounds.min.y) < 1e-6 &&
      Math.abs(seam.bounds.max.y) < 1e-6 &&
      seam.bounds.min.z >= 5_486.4 - 1e-3);

    expect(horizontalArea(caps)).toBeCloseTo(149_016_476.16, 5);
    expect(horizontalArea(caps)).toBeCloseTo(
      12_192 * 8_534.4 + 6_705.6 * 6_705.6,
      5,
    );
    expect(caps.some(cap =>
      cap.bounds.min.x >= 12_192 &&
      cap.bounds.min.y >= 6_705.6)).toBe(false);
    expect(garageSeams).toHaveLength(1);
    expect(garageSeams[0].bounds.min.x).toBeCloseTo(12_192, 6);
    expect(garageSeams[0].bounds.max.x).toBeCloseTo(18_897.6, 6);
    expect(garageSeams[0].bounds.min.z).toBe(0);
    expect(garageSeams[0].bounds.max.z).toBeCloseTo(2_743.2, 3);
    expect(crossGableSeams).toHaveLength(2);
    expect(seams).toHaveLength(3);
    expect(JSON.stringify({
      walls: model.walls.map(wall => [wall.id, wall.areaMm2, wall.netAreaMm2]),
      roofs: model.roofFaces.map(roofFace => [roofFace.id, roofFace.areaMm2]),
      dimensions: model.permanentDimensions,
    })).toBe(before);
  });

  it("preserves concave and disconnected roof footprints numerically", () => {
    const model = syntheticModel([
      roof("left-column", 0, 0, 10, 20),
      roof("lower-right", 10, 0, 20, 10),
      roof("disconnected", 30, 0, 40, 10),
    ]);

    const closure = buildPresentationClosure(model);
    const caps = closure.filter(polygon => polygon.id.startsWith("presentation-cap-"));

    expect(horizontalArea(caps)).toBeCloseTo(400, 8);
    expect(caps.some(cap => cap.bounds.min.x >= 10 && cap.bounds.min.y >= 10 && cap.bounds.max.x <= 20))
      .toBe(false);
    expect(caps.some(cap => cap.bounds.min.x >= 30)).toBe(true);
  });

  it("adds a grounded attachment footprint but not its enclosing bounding rectangle", () => {
    const model = syntheticModel(
      [roof("main", 0, 0, 10, 10)],
      [addition("wing", 10, 0, 15, 5)],
    );

    const closure = buildPresentationClosure(model);
    const caps = closure.filter(polygon => polygon.id.startsWith("presentation-cap-"));

    expect(horizontalArea(caps)).toBeCloseTo(125, 8);
    expect(caps.some(cap => cap.bounds.min.x >= 10 && cap.bounds.min.y >= 5)).toBe(false);
  });
});