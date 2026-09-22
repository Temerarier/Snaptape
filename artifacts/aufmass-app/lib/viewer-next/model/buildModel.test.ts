import { describe, expect, it } from "vitest";
import { computeDerived, validateMeasurement } from "@workspace/measurement";
import type { MeasurementInput } from "@workspace/measurement";
import fixture from "../../../../../fixtures/garage-house.json";
import realExport from "../../../../../export-messungen/neuengamme-mixed.json";
import { buildModel } from "./index";
import type { ViewerMeasurement } from "./index";
import type { Point3, ViewerModel } from "./types";

const EPSILON = 1e-6;

function allModelPoints(model: ViewerModel): Point3[] {
  return [
    ...model.walls,
    ...model.roofFaces,
    ...model.openings,
    ...model.attachments,
    ...model.conditions,
    ...model.massing,
  ].flatMap(part => [...part.corners]);
}

function assertFiniteModel(model: ViewerModel): void {
  for (const item of allModelPoints(model)) {
    expect(Number.isFinite(item.x)).toBe(true);
    expect(Number.isFinite(item.y)).toBe(true);
    expect(Number.isFinite(item.z)).toBe(true);
  }
  for (const edge of model.edges) {
    for (const item of edge.corners) {
      expect(Number.isFinite(item.x)).toBe(true);
      expect(Number.isFinite(item.y)).toBe(true);
      expect(Number.isFinite(item.z)).toBe(true);
    }
  }
}

function modelSignatures(model: ViewerModel, key: "walls" | "roofFaces" | "edges" | "openings" | "attachments" | "conditions" | "massing"): string[] {
  return model[key]
    .map(item => `${item.id}:${item.corners.map(point => `${point.x},${point.y},${point.z}`).join(";")}`)
    .sort();
}

function hasWallRoofContact(
  roof: { corners: readonly Point3[] },
  wall: { corners: readonly Point3[]; bounds: { min: Point3; max: Point3 } },
): boolean {
  return roof.corners.some(point =>
    wall.corners.some(corner =>
      Math.abs(point.x - corner.x) <= EPSILON &&
      Math.abs(point.y - corner.y) <= EPSILON &&
      Math.abs(point.z - corner.z) <= EPSILON,
    ) ||
    Math.abs(point.z - wall.bounds.max.z) <= EPSILON &&
    point.x >= wall.bounds.min.x - EPSILON &&
    point.x <= wall.bounds.max.x + EPSILON &&
    point.y >= wall.bounds.min.y - EPSILON &&
    point.y <= wall.bounds.max.y + EPSILON,
  );
}

function samePoint(a: Point3, b: Point3): boolean {
  return Math.abs(a.x - b.x) <= EPSILON &&
    Math.abs(a.y - b.y) <= EPSILON &&
    Math.abs(a.z - b.z) <= EPSILON;
}

function hasPolygonEdge(
  polygon: { corners: readonly Point3[] },
  start: Point3,
  end: Point3,
): boolean {
  return polygon.corners.some((corner, index) => {
    const next = polygon.corners[(index + 1) % polygon.corners.length];
    return (samePoint(corner, start) && samePoint(next, end)) ||
      (samePoint(corner, end) && samePoint(next, start));
  });
}

function segmentLength(segment: { start: Point3; end: Point3 }): number {
  const dx = segment.start.x - segment.end.x;
  const dy = segment.start.y - segment.end.y;
  const dz = segment.start.z - segment.end.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function containsCorners(parent: { corners: readonly Point3[]; normal: Point3 }, child: { corners: readonly Point3[] }): boolean {
  const normal = parent.normal;
  const project = (point: Point3): [number, number] =>
    Math.abs(normal.z) > Math.abs(normal.y) && Math.abs(normal.z) > Math.abs(normal.x)
      ? [point.x, point.y]
      : Math.abs(normal.x) > Math.abs(normal.y)
        ? [point.y, point.z]
        : [point.x, point.z];
  const polygon = parent.corners.map(project);
  return child.corners.every(point => {
    const target = project(point);
    let sign = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const cross = (b[0] - a[0]) * (target[1] - a[1]) - (b[1] - a[1]) * (target[0] - a[0]);
      if (Math.abs(cross) <= EPSILON) continue;
      const nextSign = Math.sign(cross);
      if (sign === 0) sign = nextSign;
      else if (nextSign !== sign) return false;
    }
    return true;
  });
}

describe("viewer-next pure model", () => {
  it("builds the complete garage fixture at measured scale", () => {
    const model = buildModel(
      fixture,
      computeDerived(fixture as unknown as MeasurementInput),
    );

    expect(model.roofFaces).toHaveLength(6);
    expect(model.walls).toHaveLength(6);
    expect(model.openings).toHaveLength(20);
    expect(model.attachments).toHaveLength(6);
    expect(model.attachments.some(attachment => attachment.id === "AT-7")).toBe(false);
    expect(model.massing.some(part => part.id === "SF-1" || part.id === "FC-1")).toBe(false);
    expect(model.diagnostics.some(diagnostic =>
      diagnostic.code === "geometry_omitted" && diagnostic.ids.includes("AT-7"),
    )).toBe(true);
    expect(model.bounds.main.widthMm).toBeCloseTo(12192, 6);
    expect(model.bounds.overall.widthMm).toBeCloseTo(18897.6, 6);
    expect(model.permanentDimensions.length?.valueMm).toBeCloseTo(12192, 6);
    expect(model.permanentDimensions.length?.label).toBe(`40' 0"`);
    expect(model.permanentDimensions.depth?.valueMm).toBeCloseTo(8534.4, 6);
    expect(model.permanentDimensions.depth?.label).toBe(`28' 0"`);
    expect(model.permanentDimensions.eaveHeight?.valueMm).toBeCloseTo(5486.4, 6);
    expect(model.permanentDimensions.eaveHeight?.label).toBe(`18' 0"`);
    for (const dimension of [
      model.permanentDimensions.length,
      model.permanentDimensions.depth,
      model.permanentDimensions.eaveHeight,
    ]) {
      expect(dimension).not.toBeNull();
      if (!dimension) continue;
      expect(dimension.segments.length).toBeGreaterThan(0);
      expect(dimension.segments.reduce((sum, segment) => sum + segmentLength(segment), 0))
        .toBeCloseTo(dimension.valueMm, 6);
    }
    expect(model.notes.some(note => note.includes("permanent width dimension remains"))).toBe(true);

    for (const opening of model.openings) {
      const parent = [...model.walls, ...model.roofFaces].find(face => face.id === opening.parentFaceId);
      expect(parent, opening.id).toBeDefined();
      expect(containsCorners(parent!, opening), opening.id).toBe(true);
    }
    const garage = model.openings.find(opening => opening.id === "G-1");
    expect(garage?.parentFaceId).toBe("WL-5");
    for (const attachment of model.attachments) {
      expect(attachment.segments).toHaveLength(12);
      for (const segment of attachment.segments ?? []) {
        expect(attachment.corners.some(corner => samePoint(corner, segment.start))).toBe(true);
        expect(attachment.corners.some(corner => samePoint(corner, segment.end))).toBe(true);
        expect(samePoint(segment.start, segment.end)).toBe(false);
      }
    }
    assertFiniteModel(model);
  });

  it("omits an unknown footprint depth instead of using model bounds", () => {
    const withoutDepth = {
      ...fixture,
      building: {
        ...fixture.building,
        footprint: {
          ...fixture.building.footprint,
          points: undefined,
          depth_mm: null,
        },
      },
    };
    const derived = computeDerived(withoutDepth as unknown as MeasurementInput);
    const model = buildModel(withoutDepth, derived);

    expect(derived.footprint.depth_mm.value).toBeNull();
    expect(model.bounds.main.depthMm).toBeGreaterThan(0);
    expect(model.permanentDimensions.depth).toBeNull();
    expect(model.permanentDimensions.length?.label).toBe(`40' 0"`);
    expect(model.permanentDimensions.eaveHeight?.label).toBe(`18' 0"`);
  });

  it("accepts a real older v1.5 export and reports degraded geometry", () => {
    const validation = validateMeasurement(realExport);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error =>
      error.instancePath === "/meta/schema_version" && error.keyword === "const",
    )).toBe(true);
    expect(() => buildModel(realExport)).not.toThrow();
    const model = buildModel(realExport);

    expect(model.walls.length).toBeGreaterThan(0);
    expect(model.roofFaces.length).toBeGreaterThan(0);
    expect(model.openings.length).toBeGreaterThan(0);
    expect(model.notes.length).toBeGreaterThan(0);
    expect(model.notes.some(note => note.includes("v1.5 export accepted"))).toBe(true);
    expect(model.notes.some(note => note.includes('Roof type "other"'))).toBe(true);
    expect(model.walls.some(wall => wall.color.neutral)).toBe(true);
    expect(model.massing.some(part => part.id === "SF-1" || part.id === "FC-1")).toBe(false);
    expect(model.notes.some(note => note.includes("SF-1") && note.includes("omitted"))).toBe(true);
    expect(model.notes.some(note => note.includes("FC-1") && note.includes("omitted"))).toBe(true);
    expect(model.diagnostics.some(diagnostic =>
      diagnostic.code === "geometry_omitted" && diagnostic.ids.includes("SF-1"),
    )).toBe(true);
    assertFiniteModel(model);
  });

  it("degrades a required-fields-only measurement to neutral massing", () => {
    const minimal = {
      meta: { country: "US", unit: "mm", schema_version: "1.7" },
      building: { roof_type: "other" },
      references: [],
      faces: [
        { id: "RF-1", face_class: "roof_face", area_mm2: { value: 10000000, confidence: "high", source: "measured" } },
        { id: "WL-1", face_class: "wall", area_mm2: { value: 10000000, confidence: "high", source: "measured" } },
      ],
      edges: [],
      openings: [],
    };
    expect(validateMeasurement(minimal).valid).toBe(true);
    const model = buildModel(minimal);

    expect(model.massing.length).toBeGreaterThan(0);
    expect(model.notes.length).toBeGreaterThan(0);
    expect(model.roofFaces[0]?.color.neutral).toBe(true);
    expect(model.walls[0]?.color.neutral).toBe(true);
    expect(model.bounds.main.widthMm).toBeGreaterThan(0);
    assertFiniteModel(model);
  });

  it("omits one malformed part without discarding usable geometry", () => {
    const wall = fixture.faces.find(face => face.id === "WL-1")!;
    const partial = {
      ...fixture,
      faces: [fixture.faces[0], null, wall],
      openings: [fixture.openings[0], "unreadable", fixture.openings[1]],
      edges: [fixture.edges[0], { ...fixture.edges[1], id: 42 }],
    };

    expect(() => buildModel(partial as unknown as ViewerMeasurement)).not.toThrow();
    const model = buildModel(partial as unknown as ViewerMeasurement);

    expect(model.roofFaces.some(face => face.id === fixture.faces[0].id)).toBe(true);
    expect(model.walls.some(item => item.id === wall.id)).toBe(true);
    expect(model.openings.some(opening => opening.id === fixture.openings[0].id)).toBe(true);
    expect(model.notes).toEqual(expect.arrayContaining([
      "face-2: malformed face entry omitted.",
      "opening-2: malformed opening entry omitted.",
      "edge-2: malformed id ignored; generated a stable display id.",
    ]));
    assertFiniteModel(model);
  });

  it("keeps geometry invariant when measurement arrays are permuted", () => {
    const permuted = {
      ...fixture,
      faces: [...fixture.faces].reverse(),
      edges: [...fixture.edges].reverse(),
      openings: [...fixture.openings].reverse(),
      attachments: [...fixture.attachments].reverse(),
      condition_areas: [...fixture.condition_areas].reverse(),
    };
    const original = buildModel(fixture);
    const reordered = buildModel(permuted);

    for (const key of ["walls", "roofFaces", "edges", "openings", "attachments", "conditions", "massing"] as const) {
      expect(modelSignatures(reordered, key), key).toEqual(modelSignatures(original, key));
    }
    expect(reordered.notes).toEqual(original.notes);
  });

  it("keeps every measured roof facet in contact with its wall envelope", () => {
    const model = buildModel(fixture);
    const wall = (id: string) => model.walls.find(item => item.id === id)!;
    const roof = (id: string) => model.roofFaces.find(item => item.id === id)!;

    expect(wall("WL-6").bounds.min.x).toBeCloseTo(18897.6, 6);
    expect(wall("WL-6").bounds.max.x).toBeCloseTo(18897.6, 6);
    expect(hasWallRoofContact(roof("RF-1"), wall("WL-1"))).toBe(true);
    expect(hasWallRoofContact(roof("RF-2"), wall("WL-2"))).toBe(true);
    expect(hasWallRoofContact(roof("RF-3"), wall("WL-1"))).toBe(true);
    expect(hasWallRoofContact(roof("RF-4"), wall("WL-1"))).toBe(true);
    expect(hasWallRoofContact(roof("RF-5"), wall("WL-5"))).toBe(true);
    expect(hasWallRoofContact(roof("RF-6"), wall("WL-6"))).toBe(true);
  });

  it("orients the garage ridge along its measured right gable profile", () => {
    const model = buildModel(fixture);
    const gable = model.walls.find(wall => wall.id === "WL-6")!;
    const garageRoofs = model.roofFaces.filter(face => face.id === "RF-5" || face.id === "RF-6");
    const ridgeLength = 18897.6 - 12192;
    const ridgeY = 6705.6 / 2;
    const ridgeZ = gable.bounds.max.z;
    const gableProfile = [
      { x: 18897.6, y: 0, z: gable.bounds.max.z - gable.gableHeightMm },
      { x: 18897.6, y: ridgeY, z: ridgeZ },
      { x: 18897.6, y: 6705.6, z: gable.bounds.max.z - gable.gableHeightMm },
    ];

    expect(garageRoofs).toHaveLength(2);
    for (const roof of garageRoofs) {
      const ridgeCorners = roof.corners.filter(corner => Math.abs(corner.z - ridgeZ) <= EPSILON);
      expect(ridgeCorners).toHaveLength(2);
      expect(Math.abs(ridgeCorners[0].y - ridgeCorners[1].y)).toBeLessThanOrEqual(EPSILON);
      expect(Math.min(...ridgeCorners.map(corner => corner.x))).toBeCloseTo(12192, 6);
      expect(Math.max(...ridgeCorners.map(corner => corner.x))).toBeCloseTo(18897.6, 6);
      expect(Math.abs(ridgeCorners[0].x - ridgeCorners[1].x)).toBeCloseTo(ridgeLength, 6);
      expect(ridgeCorners.some(corner => samePoint(corner, { x: 18897.6, y: ridgeY, z: ridgeZ }))).toBe(true);
    }
    for (const profilePoint of gableProfile) {
      expect(garageRoofs.some(roof => roof.corners.some(corner => samePoint(corner, profilePoint)))).toBe(true);
    }
    expect(garageRoofs.flatMap(roof =>
      roof.corners.filter(corner => Math.abs(corner.x - 18897.6) <= EPSILON),
    )).toHaveLength(4);
    expect(garageRoofs.flatMap(roof =>
      roof.corners.filter(corner => samePoint(corner, gableProfile[1])),
    )).toHaveLength(2);
    expect(hasPolygonEdge(garageRoofs[0], gableProfile[0], gableProfile[1])).toBe(true);
    expect(hasPolygonEdge(garageRoofs[1], gableProfile[1], gableProfile[2])).toBe(true);
  });

  it("places matched edges at measured geometry and omits uncertain edges", () => {
    const model = buildModel(fixture);
    const edge = (id: string) => model.edges.find(item => item.id === id);
    const garageEave = edge("E-9");
    expect(garageEave?.lengthMm).toBeCloseTo(6705.6, 6);
    expect(garageEave?.corners[0].x).toBeCloseTo(12192, 6);
    expect(garageEave?.corners[1].x).toBeCloseTo(18897.6, 6);
    expect(edge("E-8")).toBeUndefined();
    expect(model.notes.some(note => note.includes("E-8") && note.includes("omitted"))).toBe(true);
  });

  it("matches an older roof skylight to a roof parent rather than a wall", () => {
    const model = buildModel(realExport);
    const skylight = model.openings.find(opening => opening.id === "SK-1");

    expect(skylight).toBeDefined();
    expect(skylight?.parentFaceId).toMatch(/^RF-/);
    expect(model.walls.some(wall => wall.id === skylight?.parentFaceId)).toBe(false);
  });
});
