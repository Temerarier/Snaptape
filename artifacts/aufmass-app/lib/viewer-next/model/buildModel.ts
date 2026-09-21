import type {
  MeasurementAttachmentLike,
  MeasurementConditionLike,
  MeasurementEdgeLike,
  MeasurementFaceLike,
  MeasurementOpeningLike,
  MeasurementValueLike,
  ViewerMeasurement,
} from "./input";
import type {
  Bounds3,
  DimensionSegment,
  Frame3,
  ModelAttachment,
  ModelColor,
  ModelConditionArea,
  ModelDiagnostic,
  ModelDiagnosticCategory,
  ModelDimensions,
  ModelEdge,
  ModelOpening,
  ModelPolygon,
  ModelRoofFace,
  ModelSegment,
  ModelWall,
  PermanentDimension,
  Point3,
  Triangle,
  Vector3,
  ViewerModel,
} from "./types";
import type { DerivedMeasurement } from "@workspace/measurement";
import { viewerTokens } from "../tokens";

const EPSILON = 1e-6;
const NEUTRAL_HEX: string = viewerTokens.modelNeutral;
const CONDITION_HEX: string = viewerTokens.modelConditionFallback;
const FRONT = "front";
const BACK = "back";
const LEFT = "left";
const RIGHT = "right";
const ROOF = "roof";
const ELEVATIONS = [FRONT, BACK, LEFT, RIGHT] as const;

interface FootprintSize {
  width: number;
  depth: number;
}

interface WallSurface {
  readonly face: MeasurementFaceLike;
  readonly id: string;
  readonly elevation: string;
  readonly start: number;
  readonly span: number;
  readonly xCoord: number;
  readonly baseHeight: number;
  readonly height: number;
  readonly gableHeight: number;
  readonly model: ModelWall;
  readonly color: ModelColor;
}

interface RoofSurface {
  readonly face: MeasurementFaceLike;
  readonly id: string;
  readonly model: ModelRoofFace;
  readonly p00: Point3;
  readonly axisU: Vector3;
  readonly axisV: Vector3;
  readonly spanU: number;
  readonly spanV: number;
}

interface Point2 {
  readonly x: number;
  readonly y: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function valueOf(value: MeasurementValueLike | number | null | undefined): number | null {
  if (finite(value)) return value;
  if (!value || !finite(value.value)) return null;
  return value.value;
}

function nonNegative(value: number | null): number {
  return value !== null && value >= 0 ? value : 0;
}

function point(x: number, y: number, z: number): Point3 {
  return {
    x: finite(x) ? x : 0,
    y: finite(y) ? y : 0,
    z: finite(z) ? z : 0,
  };
}

function vector(x: number, y: number, z: number): Vector3 {
  return point(x, y, z);
}

function add(a: Point3, b: Vector3): Point3 {
  return point(a.x + b.x, a.y + b.y, a.z + b.z);
}

function subtract(a: Point3, b: Point3): Vector3 {
  return vector(a.x - b.x, a.y - b.y, a.z - b.z);
}

function multiply(a: Vector3, scalar: number): Vector3 {
  return vector(a.x * scalar, a.y * scalar, a.z * scalar);
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return vector(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(a: Vector3): number {
  return Math.sqrt(dot(a, a));
}

function unit(a: Vector3, fallback: Vector3 = vector(1, 0, 0)): Vector3 {
  const length = magnitude(a);
  return length > EPSILON ? multiply(a, 1 / length) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point3, b: Point3): number {
  return magnitude(subtract(a, b));
}

function colorFor(face: MeasurementFaceLike | null | undefined): ModelColor {
  const color = face?.color ?? {};
  const confident = color?.confidence !== "low";
  const hex = typeof color?.hex === "string" && /^#[0-9a-f]{6}$/i.test(color.hex)
    ? color.hex
    : null;
  if (!hex || !confident) {
    return {
      hex: NEUTRAL_HEX,
      secondaryHex: null,
      confidence: color?.confidence ?? null,
      neutral: true,
    };
  }
  const secondaryHex = typeof color.secondary_hex === "string" &&
    /^#[0-9a-f]{6}$/i.test(color.secondary_hex)
    ? color.secondary_hex
    : null;
  return {
    hex,
    secondaryHex,
    confidence: color?.confidence ?? null,
    neutral: false,
  };
}

function normalForElevation(elevation: string): Vector3 {
  switch (elevation) {
    case BACK:
      return vector(0, 1, 0);
    case LEFT:
      return vector(-1, 0, 0);
    case RIGHT:
      return vector(1, 0, 0);
    case FRONT:
    default:
      return vector(0, -1, 0);
  }
}

function tangentForElevation(elevation: string): Vector3 {
  switch (elevation) {
    case BACK:
      return vector(-1, 0, 0);
    case LEFT:
      return vector(0, -1, 0);
    case RIGHT:
      return vector(0, 1, 0);
    case FRONT:
    default:
      return vector(1, 0, 0);
  }
}

function frameFor(corners: readonly Point3[], expectedNormal?: Vector3): Frame3 {
  const origin = corners[0] ?? point(0, 0, 0);
  const tangent = unit(
    corners.length > 1 ? subtract(corners[1], origin) : vector(1, 0, 0),
  );
  const up = vector(0, 0, 1);
  const computed = unit(cross(tangent, up), expectedNormal ?? vector(0, -1, 0));
  const normal = expectedNormal && dot(computed, expectedNormal) < 0
    ? multiply(computed, -1)
    : expectedNormal ?? computed;
  return { origin, tangent, up, normal: unit(normal, vector(0, -1, 0)) };
}

function boundsFor(corners: readonly Point3[]): Bounds3 {
  const safe = corners.length > 0 ? corners : [point(0, 0, 0)];
  const min = point(
    Math.min(...safe.map(item => item.x)),
    Math.min(...safe.map(item => item.y)),
    Math.min(...safe.map(item => item.z)),
  );
  const max = point(
    Math.max(...safe.map(item => item.x)),
    Math.max(...safe.map(item => item.y)),
    Math.max(...safe.map(item => item.z)),
  );
  return {
    min,
    max,
    widthMm: max.x - min.x,
    depthMm: max.y - min.y,
    heightMm: max.z - min.z,
  };
}

function triangulate(corners: readonly Point3[]): readonly Triangle[] {
  if (corners.length < 3) return [];
  const triangles: Triangle[] = [];
  for (let index = 1; index < corners.length - 1; index += 1) {
    triangles.push([corners[0], corners[index], corners[index + 1]]);
  }
  return triangles;
}

function orientedCorners(
  corners: readonly Point3[],
  expectedNormal?: Vector3,
): readonly Point3[] {
  if (corners.length < 3 || !expectedNormal) return corners;
  const normal = cross(
    subtract(corners[1], corners[0]),
    subtract(corners[2], corners[0]),
  );
  return dot(normal, expectedNormal) >= 0 ? corners : [...corners].reverse();
}

function polygon(
  id: string,
  corners: readonly Point3[],
  color: ModelColor,
  elevation: string | null,
  expectedNormal?: Vector3,
): ModelPolygon {
  const oriented = orientedCorners(corners, expectedNormal);
  const normal = unit(
    expectedNormal ??
      cross(
        subtract(oriented[1] ?? point(1, 0, 0), oriented[0] ?? point(0, 0, 0)),
        subtract(oriented[2] ?? point(0, 1, 0), oriented[0] ?? point(0, 0, 0)),
      ),
    vector(0, 0, 1),
  );
  return {
    id,
    corners: oriented,
    triangles: triangulate(oriented),
    normal,
    frame: frameFor(oriented, normal),
    bounds: boundsFor(oriented),
    color,
    elevation,
  };
}

function normaliseElevation(value: string | null | undefined, notes: string[], id: string): string {
  if (value && (ELEVATIONS as readonly string[]).includes(value)) return value;
  const fallback = ELEVATIONS[stableBucket(id, ELEVATIONS.length)];
  notes.push(`${id}: missing or unsupported elevation; placed on ${fallback} as a degraded view.`);
  return fallback;
}

function readPoint2(value: readonly number[] | undefined): Point2 | null {
  if (!value || value.length < 2 || !finite(value[0]) || !finite(value[1])) return null;
  return { x: value[0], y: value[1] };
}

function footprintSize(measurement: ViewerMeasurement, faces: readonly MeasurementFaceLike[]): {
  main: FootprintSize;
  overall: FootprintSize;
} {
  const footprint = measurement.building?.footprint;
  const overallFootprint = measurement.building?.footprint_overall;
  const points = (footprint?.points ?? [])
    .map(item => readPoint2(item))
    .filter((item): item is Point2 => item !== null);
  const minX = points.length ? Math.min(...points.map(item => item.x)) : 0;
  const maxX = points.length ? Math.max(...points.map(item => item.x)) : 0;
  const minY = points.length ? Math.min(...points.map(item => item.y)) : 0;
  const maxY = points.length ? Math.max(...points.map(item => item.y)) : 0;
  const frontBack = faces
    .filter(face => face.face_class === "wall" && (face.elevation === FRONT || face.elevation === BACK))
    .map(face => valueOf(face.width_mm))
    .filter((value): value is number => value !== null && value > 0);
  const leftRight = faces
    .filter(face => face.face_class === "wall" && (face.elevation === LEFT || face.elevation === RIGHT))
    .map(face => valueOf(face.width_mm))
    .filter((value): value is number => value !== null && value > 0);
  const width = nonNegative(
    valueOf(footprint?.width_mm) ??
      (points.length ? maxX - minX : Math.max(...frontBack, 0)),
  );
  const depth = nonNegative(
    valueOf(footprint?.depth_mm) ??
      (points.length ? maxY - minY : Math.max(...leftRight, 0)),
  );
  const additions = measurement.attachments ?? [];
  const additionWidth = additions
    .filter(item => item.type === "addition" && item.elevation === RIGHT)
    .map(item => valueOf(item.width_mm))
    .find((value): value is number => value !== null && value > 0) ?? 0;
  const additionDepth = additions
    .filter(item => item.type === "addition" && (item.elevation === LEFT || item.elevation === RIGHT))
    .map(item => valueOf(item.depth_mm))
    .find((value): value is number => value !== null && value > 0) ?? 0;
  const overallWidth = valueOf(overallFootprint?.width_mm) ??
    Math.max(width, width + additionWidth);
  const overallDepth = valueOf(overallFootprint?.depth_mm) ??
    Math.max(depth, additionDepth);
  return {
    main: {
      width: width > EPSILON ? width : 1,
      depth: depth > EPSILON ? depth : 1,
    },
    overall: {
      width: overallWidth > EPSILON ? overallWidth : width > EPSILON ? width : 1,
      depth: overallDepth > EPSILON ? overallDepth : depth > EPSILON ? depth : 1,
    },
  };
}

function wallSurfacePoint(surface: WallSurface, localX: number, z: number, depth: number): Point3 {
  const local = clamp(localX, 0, Math.max(surface.span, 0));
  switch (surface.elevation) {
    case BACK:
      return point(surface.start + surface.span - local, depth, z);
    case LEFT:
      return point(0, surface.start + surface.span - local, z);
    case RIGHT:
      return point(surface.xCoord, surface.start + local, z);
    case FRONT:
    default:
      return point(surface.start + local, 0, z);
  }
}

function wallCorners(
  surface: Omit<WallSurface, "model" | "color">,
  depth: number,
): readonly Point3[] {
  const bottomLeft = wallSurfacePoint(surface as WallSurface, 0, 0, depth);
  const bottomRight = wallSurfacePoint(surface as WallSurface, surface.span, 0, depth);
  const eaveRight = wallSurfacePoint(surface as WallSurface, surface.span, surface.height, depth);
  const eaveLeft = wallSurfacePoint(surface as WallSurface, 0, surface.height, depth);
  if (surface.gableHeight <= EPSILON) {
    return orientedCorners(
      [bottomLeft, bottomRight, eaveRight, eaveLeft],
      normalForElevation(surface.elevation),
    );
  }
  const ridge = wallSurfacePoint(surface as WallSurface, surface.span / 2, surface.height + surface.gableHeight, depth);
  return orientedCorners(
    [bottomLeft, bottomRight, eaveRight, ridge, eaveLeft],
    normalForElevation(surface.elevation),
  );
}

function wallPointForLocal(
  surface: WallSurface,
  localX: number,
  z: number,
  depth: number,
): Point3 {
  return wallSurfacePoint(surface, localX, z, depth);
}

function openingPosition(
  opening: MeasurementOpeningLike,
  siblings: readonly MeasurementOpeningLike[],
  surface: WallSurface,
  index: number,
  notes: string[],
): { x: number; z: number } {
  const width = valueOf(opening.width_mm) ?? 0;
  const explicit = opening.position_mm;
  const explicitX = finite(explicit?.x) ? explicit.x : null;
  let x = explicitX;
  if (x === null) {
    const widths = siblings.map(item => nonNegative(valueOf(item.width_mm)));
    const used = widths.reduce((sum, item) => sum + item, 0);
    const free = Math.max(0, surface.span - used);
    const gap = siblings.length > 0 ? free / (siblings.length + 1) : 0;
    x = gap + widths.slice(0, index).reduce((sum, item) => sum + item + gap, 0);
    notes.push(`${opening.id ?? `opening-${index}`}: position inferred from its parent face and ordered openings.`);
  }
  const boundedX = clamp(x, 0, Math.max(0, surface.span - width));
  if (Math.abs(boundedX - x) > EPSILON) {
    notes.push(`${opening.id ?? `opening-${index}`}: horizontal position clamped inside ${surface.id}.`);
  }
  const height = valueOf(opening.height_mm) ?? 0;
  const explicitZ = finite(opening.position_mm?.y)
    ? opening.position_mm?.y ?? 0
    : valueOf(opening.sill_height_mm);
  let z = explicitZ ?? (opening.type === "door" || opening.type === "patio_door" || opening.type === "garage_door"
    ? 0
    : surface.height * 0.35);
  const maxAtX = surface.height + (surface.gableHeight > 0
    ? surface.gableHeight * Math.max(0, 1 - Math.abs((boundedX + width / 2) / Math.max(surface.span, 1) * 2 - 1))
    : 0);
  const boundedZ = clamp(z, 0, Math.max(0, maxAtX - height));
  if (Math.abs(boundedZ - z) > EPSILON) {
    notes.push(`${opening.id ?? `opening-${index}`}: vertical position clamped inside ${surface.id}.`);
  }
  z = boundedZ;
  return { x: boundedX, z };
}

function roofPoint(surface: RoofSurface, localU: number, localV: number): Point3 {
  const u = clamp(localU, 0, surface.spanU);
  const v = clamp(localV, 0, surface.spanV);
  return add(add(surface.p00, multiply(unit(surface.axisU), u)), multiply(unit(surface.axisV), v));
}

function boxCorners(
  origin: Point3,
  axisX: Vector3,
  width: number,
  axisY: Vector3,
  depth: number,
  height: number,
): readonly Point3[] {
  const x = multiply(unit(axisX), width);
  const y = multiply(unit(axisY), depth);
  const z = vector(0, 0, height);
  const p00 = origin;
  const p10 = add(origin, x);
  const p11 = add(p10, y);
  const p01 = add(origin, y);
  const p00z = add(p00, z);
  const p10z = add(p10, z);
  const p11z = add(p11, z);
  const p01z = add(p01, z);
  return [p00, p10, p11, p01, p00z, p10z, p11z, p01z];
}

function boxSegments(id: string, corners: readonly Point3[]): readonly ModelSegment[] {
  if (corners.length < 8) return [];
  const [a, b, c, d, e, f, g, h] = corners;
  const endpoints: readonly [Point3, Point3][] = [
    [a, b], [b, c], [c, d], [d, a],
    [e, f], [f, g], [g, h], [h, e],
    [a, e], [b, f], [c, g], [d, h],
  ];
  return endpoints.map(([start, end], index) => ({
    id: `${id}-edge-${index + 1}`,
    start,
    end,
  }));
}

function boxTriangles(corners: readonly Point3[]): readonly Triangle[] {
  if (corners.length < 8) return triangulate(corners);
  const [a, b, c, d, e, f, g, h] = corners;
  return [
    [a, b, c], [a, c, d],
    [e, g, f], [e, h, g],
    [a, e, f], [a, f, b],
    [b, f, g], [b, g, c],
    [c, g, h], [c, h, d],
    [d, h, e], [d, e, a],
  ];
}

function modelBox(
  id: string,
  corners: readonly Point3[],
  color: ModelColor,
  elevation: string | null,
  parentFaceId: string | null,
): ModelPolygon {
  const base = polygon(id, corners.slice(0, 4), color, elevation);
  return {
    ...base,
    corners,
    triangles: boxTriangles(corners),
    bounds: boundsFor(corners),
    frame: frameFor(corners, base.normal),
    elevation,
    id,
    color,
    normal: base.normal,
    ...(parentFaceId ? { parentFaceId } : {}),
  };
}

function formatFeetInches(mm: number): string {
  const totalInches = Math.max(0, Math.round(mm / 25.4));
  let feet = Math.floor(totalInches / 12);
  let inches = totalInches - feet * 12;
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}' ${inches}"`;
}

function makeDimension(
  kind: PermanentDimension["kind"],
  valueMm: number,
  segments: readonly DimensionSegment[],
): PermanentDimension {
  return {
    kind,
    valueMm,
    label: formatFeetInches(valueMm),
    segments,
  };
}

function modelParts<T extends { readonly id?: string }>(
  value: readonly T[] | null | undefined,
  kind: string,
  notes: string[],
): readonly T[] {
  if (!Array.isArray(value)) {
    if (value !== null && value !== undefined) {
      notes.push(`${kind}: expected a list; omitted malformed collection.`);
    }
    return [];
  }
  return value.flatMap((part, index) => {
    if (!isRecord(part)) {
      notes.push(`${kind}-${index + 1}: malformed ${kind} entry omitted.`);
      return [];
    }
    if (part.id !== undefined && typeof part.id !== "string") {
      notes.push(`${kind}-${index + 1}: malformed id ignored; generated a stable display id.`);
      return [{ ...part, id: undefined } as T];
    }
    return [part as T];
  });
}

function roofPitch(face: MeasurementFaceLike): number | null {
  const value = face.pitch?.rise_over_12_snapped;
  return finite(value) && value >= 0 ? value : null;
}

function roofRise(pitch: number | null, run: number, fallback: number): number {
  if (fallback > EPSILON) return fallback;
  if (pitch === null) return 0;
  return Math.tan(Math.atan(pitch / 12)) * run;
}

function createRoofPlane(
  face: MeasurementFaceLike,
  id: string,
  corners: readonly Point3[],
  elevation: string | null,
  notes: string[],
): RoofSurface {
  const faceForColor = colorFor(face);
  const modelBase = polygon(id, corners, faceForColor, elevation);
  const oriented = modelBase.corners;
  const p00 = oriented[0] ?? point(0, 0, 0);
  const p10 = oriented[1] ?? p00;
  const p01 = oriented[3] ?? p00;
  const axisU = subtract(p10, p00);
  const axisV = subtract(p01, p00);
  const spanU = magnitude(axisU);
  const spanV = magnitude(axisV);
  if (spanU <= EPSILON || spanV <= EPSILON) {
    notes.push(`${id}: roof facet had no measurable span; retained as a degenerate neutral facet.`);
  }
  const model: ModelRoofFace = {
    ...modelBase,
    id,
    faceClass: "roof_face",
    pitchRiseOver12: roofPitch(face),
    areaMm2: valueOf(face.area_mm2),
  };
  return {
    face,
    id,
    model,
    p00,
    axisU,
    axisV,
    spanU,
    spanV,
  };
}

function makeWall(
  face: MeasurementFaceLike,
  surfaceData: Omit<WallSurface, "model" | "color">,
  depth: number,
): WallSurface {
  const corners = wallCorners(surfaceData, depth);
  const color = colorFor(face);
  const base = polygon(
    surfaceData.id,
    corners,
    color,
    surfaceData.elevation,
    normalForElevation(surfaceData.elevation),
  );
  const model: ModelWall = {
    ...base,
    faceClass: "wall",
    widthMm: surfaceData.span,
    heightMm: surfaceData.height,
    gableHeightMm: surfaceData.gableHeight,
    areaMm2: valueOf(face.area_mm2),
    netAreaMm2: valueOf(face.net_area_mm2),
  };
  return { ...surfaceData, model, color };
}

function inferredMassing(
  face: MeasurementFaceLike,
  id: string,
  width: number,
  depth: number,
): ModelPolygon {
  const area = Math.max(valueOf(face.area_mm2) ?? 1, 1);
  const span = Math.max(1, Math.sqrt(area));
  // Unknown face classes are only a degradation aid.  Keep their inferred
  // blocks within the measured envelope instead of letting the face-array
  // index manufacture a larger building.
  const xStep = Math.max(0, Math.min(Math.max(width, span) - span, Math.max(width, span) / 3));
  const stableSlot = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3;
  const x = stableSlot * xStep;
  const y = 0;
  const z = Math.max(1, Math.min(span, width));
  const corners = [
    point(x, y, 0),
    point(x + span, y, 0),
    point(x + span, y + Math.max(1, depth), 0),
    point(x, y + Math.max(1, depth), 0),
    point(x + span / 2, y + Math.max(1, depth / 2), z),
  ];
  return polygon(id, corners, colorFor(face), face.elevation ?? null);
}

function edgeFrame(start: Point3, end: Point3): Frame3 {
  const tangent = unit(subtract(end, start));
  const normal = unit(cross(tangent, vector(0, 0, 1)), vector(0, -1, 0));
  return { origin: start, tangent, up: vector(0, 0, 1), normal };
}

function lineForLength(start: Point3, direction: Vector3, length: number): readonly [Point3, Point3] {
  const safeLength = nonNegative(length);
  return [start, add(start, multiply(unit(direction), safeLength))];
}

function chooseWallSurface(
  surfaces: readonly WallSurface[],
  elevation: string | null | undefined,
): WallSurface | undefined {
  return surfaces
    .filter(item => item.elevation === elevation)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ??
    surfaces.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
}

function roofRidgeSegment(roof: RoofSurface): readonly [Point3, Point3] {
  const corners = roof.model.corners;
  if (corners.length < 4) {
    const start = corners[0] ?? point(0, 0, 0);
    return [start, corners[1] ?? start];
  }
  const candidates: Array<readonly [Point3, Point3]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  const highest = Math.max(...corners.map(item => item.z));
  return candidates
    .filter(([start, end]) => Math.abs(start.z - highest) < EPSILON && Math.abs(end.z - highest) < EPSILON)
    .sort((a, b) => distance(b[0], b[1]) - distance(a[0], a[1]))[0] ?? candidates[0];
}

function chooseEdgeWall(
  walls: readonly WallSurface[],
  elevation: string | null | undefined,
  edgeClass: string,
  length: number,
  id: string,
  depth: number,
  notes: string[],
): WallSurface | undefined {
  const candidates = walls
    .filter(wall => wall.elevation === elevation)
    .map(wall => {
      const expected = edgeClass === "eave" || edgeClass === "base"
        ? wall.span
        : edgeClass === "outside_corner" || edgeClass === "inside_corner"
          ? wall.height
          : edgeClass === "rake" && wall.gableHeight > EPSILON
            ? distance(
              wallSurfacePoint(wall, 0, wall.height, depth),
              wallSurfacePoint(wall, wall.span / 2, wall.height + wall.gableHeight, depth),
            )
            : Number.POSITIVE_INFINITY;
      return { wall, difference: Math.abs(expected - length) };
    })
    .sort((a, b) => a.difference - b.difference || a.wall.id.localeCompare(b.wall.id));
  const best = candidates[0];
  if (!best || !Number.isFinite(best.difference) || best.difference > 20) {
    notes.push(`${id}: no measured ${edgeClass} geometry matches ${length} mm on ${elevation ?? "unknown"}; omitted rather than placed falsely.`);
    return undefined;
  }
  const tied = candidates.filter(item => Math.abs(item.difference - best.difference) <= 1);
  if (tied.length > 1) {
    notes.push(`${id}: ${edgeClass} placement is ambiguous between ${tied.map(item => item.wall.id).join(", ")}; omitted.`);
    return undefined;
  }
  return best.wall;
}

function chooseEdgeRoof(
  roofs: readonly RoofSurface[],
  length: number,
  id: string,
  notes: string[],
): RoofSurface | undefined {
  const candidates = roofs
    .map(roof => {
      const ridge = roofRidgeSegment(roof);
      return { roof, difference: Math.abs(distance(ridge[0], ridge[1]) - length) };
    })
    .sort((a, b) => a.difference - b.difference || a.roof.id.localeCompare(b.roof.id));
  const best = candidates[0];
  if (!best || best.difference > 20) {
    notes.push(`${id}: no measured ridge geometry matches ${length} mm; omitted rather than placed falsely.`);
    return undefined;
  }
  const tied = candidates.filter(item => Math.abs(item.difference - best.difference) <= 1);
  if (tied.length > 1) {
    const firstRidge = roofRidgeSegment(tied[0].roof);
    const duplicateGeometry = tied.slice(1).every(item => {
      const ridge = roofRidgeSegment(item.roof);
      return (
        (distance(firstRidge[0], ridge[0]) <= EPSILON && distance(firstRidge[1], ridge[1]) <= EPSILON) ||
        (distance(firstRidge[0], ridge[1]) <= EPSILON && distance(firstRidge[1], ridge[0]) <= EPSILON)
      );
    });
    if (duplicateGeometry) {
      notes.push(`${id}: duplicate roof facets share the same ridge geometry; selected ${tied[0].roof.id} deterministically.`);
      return tied[0].roof;
    }
    notes.push(`${id}: ridge placement is ambiguous between ${tied.map(item => item.roof.id).join(", ")}; omitted.`);
    return undefined;
  }
  return best.roof;
}

function buildEdge(
  edge: MeasurementEdgeLike,
  index: number,
  walls: readonly WallSurface[],
  roofs: readonly RoofSurface[],
  dimensions: FootprintSize,
  eaveHeight: number,
  notes: string[],
): ModelEdge | null {
  const id = edge.id ?? `edge-${index + 1}`;
  const edgeClass = edge.edge_class ?? "unclassified";
  const elevation = edge.belongs_to_elevation ?? null;
  const length = nonNegative(valueOf(edge.length_mm));
  if (valueOf(edge.length_mm) === null) notes.push(`${id}: missing length; retained as a zero-length edge.`);
  let wall: WallSurface | undefined;
  let start = point(0, 0, eaveHeight);
  let direction = vector(1, 0, 0);
  let color = NEUTRAL_HEX;
  const measuredWall = edgeClass === "ridge"
    ? undefined
    : chooseEdgeWall(walls, elevation, edgeClass, length, id, dimensions.depth, notes);
  if (edgeClass === "eave" && measuredWall) {
    wall = measuredWall;
    start = wallSurfacePoint(wall, 0, wall.height, dimensions.depth);
    direction = tangentForElevation(wall.elevation);
    color = wall.color.hex;
  } else if (edgeClass === "rake" && measuredWall && measuredWall.gableHeight > 0) {
    wall = measuredWall;
    start = wallSurfacePoint(wall, 0, wall.height, dimensions.depth);
    direction = subtract(
      wallSurfacePoint(wall, wall.span / 2, wall.height + wall.gableHeight, dimensions.depth),
      start,
    );
    color = wall.color.hex;
  } else if (edgeClass === "ridge" && roofs.length > 0) {
    const roof = chooseEdgeRoof(roofs, length, id, notes);
    if (!roof) return null;
    const ridge = roofRidgeSegment(roof);
    start = ridge[0];
    direction = subtract(ridge[1], ridge[0]);
    color = roof.model.color.hex;
  } else if (edgeClass === "base" && measuredWall) {
    wall = measuredWall;
    start = wallSurfacePoint(wall, 0, 0, dimensions.depth);
    direction = tangentForElevation(wall.elevation);
    color = wall.color.hex;
  } else if ((edgeClass === "outside_corner" || edgeClass === "inside_corner") && measuredWall) {
    wall = measuredWall;
    start = wallSurfacePoint(wall, 0, 0, dimensions.depth);
    direction = vector(0, 0, 1);
    color = wall.color.hex;
  } else if (edgeClass === "eave" || edgeClass === "rake" || edgeClass === "base" ||
    edgeClass === "outside_corner" || edgeClass === "inside_corner") {
    return null;
  } else {
    notes.push(`${id}: ${edgeClass} has no unambiguous measured placement; omitted rather than placed falsely.`);
    return null;
  }
  const [edgeStart, edgeEnd] = lineForLength(start, direction, length);
  const frame = edgeFrame(edgeStart, edgeEnd);
  const edgeColor: ModelColor = {
    hex: color,
    secondaryHex: null,
    confidence: null,
    neutral: color === NEUTRAL_HEX,
  };
  return {
    id,
    edgeClass,
    elevation,
    corners: [edgeStart, edgeEnd],
    lengthMm: length,
    normal: frame.normal,
    frame,
    bounds: boundsFor([edgeStart, edgeEnd]),
    color: edgeColor,
  };
}

function openingTypeColor(type: string): ModelColor {
  const hex = type === "garage_door"
    ? viewerTokens.modelOpeningGarage
    : type === "skylight"
      ? viewerTokens.modelOpeningSkylight
      : viewerTokens.modelOpeningDefault;
  return { hex, secondaryHex: null, confidence: null, neutral: false };
}

function buildOpenings(
  inputs: readonly MeasurementOpeningLike[],
  walls: readonly WallSurface[],
  roofs: readonly RoofSurface[],
  dimensions: FootprintSize,
  notes: string[],
): ModelOpening[] {
  const groups = new Map<string, MeasurementOpeningLike[]>();
  for (const opening of inputs) {
    const key = opening.parent_face_id ?? `elevation:${opening.elevation ?? "unknown"}`;
    const group = groups.get(key) ?? [];
    group.push(opening);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
  }
  const models: ModelOpening[] = [];
  inputs.forEach((opening, index) => {
    const id = opening.id ?? `opening-${index + 1}`;
    const width = valueOf(opening.width_mm);
    const height = valueOf(opening.height_mm);
    if (width === null || height === null || width <= 0 || height <= 0) {
      notes.push(`${id}: missing opening dimensions; omitted from geometry.`);
      return;
    }
    let parentId = opening.parent_face_id ?? null;
    let wall = parentId ? walls.find(item => item.id === parentId) : undefined;
    let roof = parentId ? roofs.find(item => item.id === parentId) : undefined;
    if (!wall && !roof) {
      const isRoofOpening = opening.type === "skylight" || opening.elevation === ROOF;
      wall = isRoofOpening ? undefined : chooseWallSurface(walls, opening.elevation);
      roof = isRoofOpening
        ? roofs.find(item => item.model.elevation === ROOF) ??
          roofs.find(item => item.model.elevation === FRONT) ??
          roofs[0]
        : undefined;
      if (wall || roof) {
        parentId = wall?.id ?? roof?.id ?? null;
        notes.push(`${id}: no usable parent_face_id; attached to the nearest matching ${isRoofOpening ? "roof facet" : "elevation"}.`);
      }
    }
    if (!parentId || (!wall && !roof)) {
      notes.push(`${id}: no parent face could be located; omitted from geometry.`);
      return;
    }
    const siblings = groups.get(opening.parent_face_id ?? `elevation:${opening.elevation ?? "unknown"}`) ?? [opening];
    if (wall) {
      const siblingIndex = siblings.indexOf(opening);
      const local = openingPosition(opening, siblings, wall, Math.max(0, siblingIndex), notes);
      const corners = orientedCorners([
        wallPointForLocal(wall, local.x, local.z, dimensions.depth),
        wallPointForLocal(wall, local.x + width, local.z, dimensions.depth),
        wallPointForLocal(wall, local.x + width, local.z + height, dimensions.depth),
        wallPointForLocal(wall, local.x, local.z + height, dimensions.depth),
      ], wall.model.normal);
      const base = polygon(id, corners, openingTypeColor(opening.type ?? "other"), wall.elevation, wall.model.normal);
      models.push({
        ...base,
        type: opening.type ?? "other",
        parentFaceId: parentId,
        widthMm: width,
        heightMm: height,
        areaMm2: valueOf(opening.area_mm2),
      });
      return;
    }
    const parentRoof = roof!;
    const position = opening.position_mm;
    const maxX = Math.max(0, parentRoof.spanU - width);
    const maxY = Math.max(0, parentRoof.spanV - height);
    const x = clamp(finite(position?.x) ? position.x : (parentRoof.spanU - width) / 2, 0, maxX);
    const y = clamp(finite(position?.y) ? position.y : (parentRoof.spanV - height) / 2, 0, maxY);
    if (!finite(position?.x) || !finite(position?.y)) {
      notes.push(`${id}: roof position inferred at the centre of ${parentRoof.id}.`);
    }
    const corners = orientedCorners([
      roofPoint(parentRoof, x, y),
      roofPoint(parentRoof, x + width, y),
      roofPoint(parentRoof, x + width, y + height),
      roofPoint(parentRoof, x, y + height),
    ], parentRoof.model.normal);
    const base = polygon(id, corners, openingTypeColor(opening.type ?? "skylight"), ROOF, parentRoof.model.normal);
    models.push({
      ...base,
      type: opening.type ?? "skylight",
      parentFaceId: parentId,
      widthMm: width,
      heightMm: height,
      areaMm2: valueOf(opening.area_mm2),
    });
  });
  return models;
}

function attachmentColor(type: string): ModelColor {
  if (type === "addition" || type === "bay" || type === "dormer") {
    return {
      hex: viewerTokens.modelAttachmentPrimary,
      secondaryHex: null,
      confidence: null,
      neutral: true,
    };
  }
  return {
    hex: viewerTokens.modelAttachmentSecondary,
    secondaryHex: null,
    confidence: null,
    neutral: true,
  };
}

function buildAttachments(
  inputs: readonly MeasurementAttachmentLike[],
  walls: readonly WallSurface[],
  roofs: readonly RoofSurface[],
  size: { main: FootprintSize; overall: FootprintSize },
  notes: string[],
): ModelAttachment[] {
  const models: ModelAttachment[] = [];
  inputs.forEach((attachment, index) => {
    const id = attachment.id ?? `attachment-${index + 1}`;
    const type = attachment.type ?? "other";
    const width = valueOf(attachment.width_mm);
    const depthValue = valueOf(attachment.depth_mm);
    const detailedAddition = type === "addition" &&
      (attachment.elevation === LEFT || attachment.elevation === RIGHT) &&
      width !== null &&
      depthValue !== null &&
      walls.some(wall =>
        (wall.elevation === FRONT || wall.elevation === BACK) &&
        Math.abs(wall.span - width) <= 1 &&
        wall.span < size.main.width - EPSILON,
      ) &&
      walls.some(wall =>
        (wall.elevation === LEFT || wall.elevation === RIGHT) &&
        Math.abs(wall.span - depthValue) <= 1 &&
        wall.span < size.main.depth - EPSILON,
      ) &&
      roofs.some(roof => roof.model.bounds.min.x >= size.main.width - EPSILON);
    if (detailedAddition) {
      notes.push(`${id}: detailed wall and roof geometry already represents this addition; attachment proxy omitted.`);
      return;
    }
    if (width === null || width <= 0) {
      notes.push(`${id}: missing width; omitted from geometry.`);
      return;
    }
    const heightValue = valueOf(attachment.height_mm);
    const height = heightValue !== null && heightValue > 0 ? heightValue : width;
    const depth = depthValue !== null && depthValue > 0 ? depthValue : width;
    if (heightValue === null) notes.push(`${id}: missing height; represented as a measured-width massing block.`);
    if (depthValue === null) notes.push(`${id}: missing depth; represented with a measured-width footprint.`);
    const parentWall = attachment.parent_face_id
      ? walls.find(item => item.id === attachment.parent_face_id)
      : undefined;
    const parentRoof = attachment.parent_face_id
      ? roofs.find(item => item.id === attachment.parent_face_id)
      : undefined;
    let corners: readonly Point3[];
    let elevation = attachment.elevation ?? parentWall?.elevation ?? parentRoof?.model.elevation ?? null;
    if (parentWall) {
      const localX = finite(attachment.position_mm?.x)
        ? attachment.position_mm?.x ?? 0
        : Math.max(0, (parentWall.span - width) / 2);
      const z = finite(attachment.position_mm?.y) ? attachment.position_mm?.y ?? 0 : 0;
      const origin = wallPointForLocal(parentWall, localX, z, size.main.depth);
      corners = boxCorners(origin, tangentForElevation(parentWall.elevation), width, parentWall.model.normal, depth, height);
      elevation = parentWall.elevation;
    } else if (parentRoof) {
      const x = finite(attachment.position_mm?.x)
        ? attachment.position_mm?.x ?? 0
        : Math.max(0, (parentRoof.spanU - width) / 2);
      const y = finite(attachment.position_mm?.y)
        ? attachment.position_mm?.y ?? 0
        : Math.max(0, (parentRoof.spanV - depth) / 2);
      const origin = roofPoint(parentRoof, x, y);
      corners = boxCorners(origin, unit(parentRoof.axisU), width, unit(parentRoof.axisV), depth, height);
      elevation = ROOF;
    } else if (type === "addition" && (attachment.elevation === RIGHT || attachment.elevation === LEFT)) {
      const x = attachment.elevation === RIGHT ? size.main.width : 0;
      const y = attachment.elevation === LEFT || attachment.elevation === RIGHT
        ? 0
        : Math.max(0, size.main.depth - depth);
      corners = boxCorners(
        point(x, y, 0),
        attachment.elevation === RIGHT ? vector(1, 0, 0) : vector(-1, 0, 0),
        width,
        vector(0, 1, 0),
        depth,
        height,
      );
      elevation = attachment.elevation;
      notes.push(`${id}: no parent_face_id; positioned as an attached ${attachment.elevation} addition.`);
    } else {
      const fallbackElevation = elevation && (ELEVATIONS as readonly string[]).includes(elevation)
        ? elevation
        : FRONT;
      corners = boxCorners(
        point(0, 0, 0),
        tangentForElevation(fallbackElevation),
        width,
        vector(0, 1, 0),
        depth,
        height,
      );
      elevation = fallbackElevation;
      notes.push(`${id}: unsupported placement context; represented as a simple massing block.`);
    }
    const base = modelBox(id, corners, attachmentColor(type), elevation, attachment.parent_face_id ?? null);
    models.push({
      ...base,
      type,
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      parentFaceId: attachment.parent_face_id ?? null,
      segments: boxSegments(id, corners),
    });
  });
  return models;
}

function buildConditions(
  inputs: readonly MeasurementConditionLike[],
  walls: readonly WallSurface[],
  roofs: readonly RoofSurface[],
  dimensions: FootprintSize,
  notes: string[],
): ModelConditionArea[] {
  const conditions: ModelConditionArea[] = [];
  inputs.forEach((condition, index) => {
    const id = condition.id ?? `condition-${index + 1}`;
    const area = valueOf(condition.area_mm2);
    if (area === null || area <= 0) {
      notes.push(`${id}: missing condition area; omitted from geometry.`);
      return;
    }
    const side = Math.sqrt(area);
    const wall = condition.parent_face_id
      ? walls.find(item => item.id === condition.parent_face_id)
      : chooseWallSurface(walls, condition.elevation);
    const roof = condition.parent_face_id
      ? roofs.find(item => item.id === condition.parent_face_id)
      : undefined;
    let corners: readonly Point3[];
    let parentFaceId = condition.parent_face_id ?? null;
    if (wall) {
      const x = clamp(finite(condition.position_mm?.x) ? condition.position_mm?.x ?? 0 : 0, 0, Math.max(0, wall.span - side));
      const z = clamp(finite(condition.position_mm?.y) ? condition.position_mm?.y ?? 0 : 0, 0, Math.max(0, wall.height - side));
      corners = orientedCorners([
        wallPointForLocal(wall, x, z, dimensions.depth),
        wallPointForLocal(wall, x + side, z, dimensions.depth),
        wallPointForLocal(wall, x + side, z + side, dimensions.depth),
        wallPointForLocal(wall, x, z + side, dimensions.depth),
      ], wall.model.normal);
      parentFaceId = wall.id;
    } else if (roof) {
      const x = clamp(finite(condition.position_mm?.x) ? condition.position_mm?.x ?? 0 : 0, 0, Math.max(0, roof.spanU - side));
      const y = clamp(finite(condition.position_mm?.y) ? condition.position_mm?.y ?? 0 : 0, 0, Math.max(0, roof.spanV - side));
      corners = orientedCorners([
        roofPoint(roof, x, y),
        roofPoint(roof, x + side, y),
        roofPoint(roof, x + side, y + side),
        roofPoint(roof, x, y + side),
      ], roof.model.normal);
      parentFaceId = roof.id;
    } else {
      notes.push(`${id}: no parent face could be located; condition patch omitted.`);
      return;
    }
    const base = polygon(id, corners, {
      hex: CONDITION_HEX,
      secondaryHex: null,
      confidence: null,
      neutral: false,
    }, wall?.elevation ?? ROOF);
    conditions.push({
      ...base,
      type: condition.type ?? "condition",
      severity: condition.severity ?? null,
      photoIndex: condition.photo_index ?? null,
      parentFaceId,
      areaMm2: area,
    });
  });
  return conditions;
}

function collectPoints(parts: readonly { corners: readonly Point3[] }[]): Point3[] {
  return parts.flatMap(part => [...part.corners]);
}

function diagnosticsForNotes(notes: readonly string[]): readonly ModelDiagnostic[] {
  const diagnostics = new Map<string, ModelDiagnostic>();
  for (const note of notes) {
    const category: ModelDiagnosticCategory = note.includes("v1.5")
      ? "compatibility"
      : note.includes("ambiguous")
        ? "ambiguity"
        : note.includes("omitted")
          ? "omission"
          : note.includes("unsupported")
            ? "unsupported"
            : note.includes("inferred") || note.includes("reconstructed")
              ? "inference"
              : note.includes("envelope") || note.includes("permanent width")
                ? "envelope"
                : "general";
    const code = category === "compatibility"
      ? "legacy_export"
      : category === "ambiguity"
        ? "ambiguous_geometry"
        : category === "omission"
          ? "geometry_omitted"
          : category === "unsupported"
            ? "unsupported_geometry"
            : category === "inference"
              ? "geometry_inferred"
              : category === "envelope"
                ? "envelope_note"
                : "model_note";
    const id = note.match(/^([^:]+):/)?.[1];
    const key = `${code}:${id ?? ""}`;
    const existing = diagnostics.get(key);
    if (existing) continue;
    diagnostics.set(key, {
      code,
      category,
      ids: id ? [id] : [],
    });
  }
  return [...diagnostics.values()].sort((a, b) =>
    a.code.localeCompare(b.code) || a.ids.join(",").localeCompare(b.ids.join(",")),
  );
}

function stableBucket(id: string, count: number): number {
  if (count <= 1) return 0;
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % count;
}

function stableMainRoofRoles(
  items: readonly { face: MeasurementFaceLike }[],
  notes: string[],
): ReadonlyMap<object, "front" | "back"> {
  const roles = new Map<object, "front" | "back">();
  const ordered = items.slice().sort((a, b) => (a.face.id ?? "").localeCompare(b.face.id ?? ""));
  const explicitFront = ordered.filter(item => item.face.elevation === FRONT);
  const explicitBack = ordered.filter(item => item.face.elevation === BACK);
  if (explicitFront[0]) roles.set(explicitFront[0], FRONT);
  if (explicitBack[0]) roles.set(explicitBack[0], BACK);
  if (explicitFront.length > 1 || explicitBack.length > 1) {
    notes.push("Multiple main roof facets claim one elevation; remaining facets use stable id order.");
  }
  const unassigned = ordered.filter(item => !roles.has(item));
  for (const role of [FRONT, BACK] as const) {
    if ([...roles.values()].includes(role)) continue;
    const item = unassigned.shift();
    if (!item) continue;
    roles.set(item, role);
    notes.push(`${item.face.id ?? "roof facet"}: elevation was inferred as ${role} from stable id order.`);
  }
  return roles;
}

/**
 * Builds all viewport geometry from a measurement without making rendering
 * decisions.  Missing geometry is represented by a simple massing block or a
 * note; malformed input is never allowed to bring the panel down.
 */
export function buildModel(
  input: ViewerMeasurement | null | undefined,
  derived?: DerivedMeasurement,
): ViewerModel {
  const measurement = input ?? {};
  const notes: string[] = [];
  const faces = modelParts(measurement.faces, "face", notes);
  const wallFaces = faces.filter(face => face.face_class === "wall");
  const roofFaces = faces.filter(face => face.face_class === "roof_face");
  const dimensions = footprintSize(measurement, faces);
  if (!measurement.building?.footprint && dimensions.main.width > 1) {
    notes.push("Main footprint points were not supplied; width and depth were reconstructed from measured face spans.");
  }
  if (measurement.meta?.schema_version === "1.5") {
    notes.push("v1.5 export accepted structurally; absent v1.6 parent links are degraded by elevation matching.");
  }
  const attachmentInputs = modelParts(measurement.attachments, "attachment", notes);
  const additions = attachmentInputs.filter(item => item.type === "addition");
  if (additions.length > 0 && dimensions.overall.width > dimensions.main.width + EPSILON) {
    notes.push(
      `Overall envelope is ${dimensions.overall.width} mm; permanent width dimension remains the main footprint ${dimensions.main.width} mm.`,
    );
  }

  const wallHeightValues = wallFaces.map(face => valueOf(face.height_mm)).filter((value): value is number => value !== null && value > 0);
  const gableValues = wallFaces.map(face => valueOf(face.gable_height_mm)).filter((value): value is number => value !== null && value > 0);
  const eaveHeight = valueOf(measurement.building?.heights?.eave_height_mm) ??
    Math.max(...wallHeightValues, 1);
  const ridgeHeight = valueOf(measurement.building?.heights?.ridge_height_mm) ??
    eaveHeight + Math.max(...gableValues, 0);

  const walls: WallSurface[] = [];
  wallFaces.forEach((face, index) => {
    const id = face.id ?? `wall-${index + 1}`;
    const elevation = normaliseElevation(face.elevation, notes, id);
    const measuredSpan = valueOf(face.width_mm);
    const span = measuredSpan !== null && measuredSpan > 0
      ? measuredSpan
      : elevation === FRONT || elevation === BACK ? dimensions.main.width : dimensions.main.depth;
    const matchingFrontAddition = additions.find(addition =>
      (elevation === FRONT || elevation === BACK) &&
      (addition.elevation === LEFT || addition.elevation === RIGHT) &&
      Math.abs((valueOf(addition.width_mm) ?? -1) - span) < 1,
    );
    const matchingSideAddition = additions.find(addition =>
      (elevation === LEFT || elevation === RIGHT) &&
      (addition.elevation === LEFT || addition.elevation === RIGHT) &&
      Math.abs((valueOf(addition.depth_mm) ?? -1) - span) < 1,
    );
    const isExtensionFront = Boolean(matchingFrontAddition && span < dimensions.main.width);
    const isExtensionSide = Boolean(matchingSideAddition && span < dimensions.main.depth);
    const start = isExtensionFront && matchingFrontAddition?.elevation === RIGHT
      ? dimensions.main.width
      : isExtensionFront && matchingFrontAddition?.elevation === LEFT
        ? -span
        : 0;
    const xCoord = elevation === RIGHT
      ? isExtensionSide ? dimensions.overall.width : dimensions.main.width
      : 0;
    const height = valueOf(face.height_mm) ?? eaveHeight;
    const gable = valueOf(face.gable_height_mm) ?? 0;
    const surfaceData: Omit<WallSurface, "model" | "color"> = {
      face,
      id,
      elevation,
      start,
      span,
      xCoord,
      baseHeight: 0,
      height: Math.max(0, height),
      gableHeight: Math.max(0, gable),
    };
    walls.push(makeWall(face, surfaceData, dimensions.main.depth));
    if (measuredSpan === null) {
      notes.push(`${id}: width missing; reconstructed from the footprint envelope.`);
    }
    if (face.face_class !== "wall") notes.push(`${id}: unsupported wall class degraded to a wall massing.`);
  });

  const roofs: RoofSurface[] = [];
  const sortedRoofFaces = roofFaces
    .map((face, index) => ({ face, index, area: valueOf(face.area_mm2) ?? 0 }))
    .sort((a, b) => b.area - a.area || (a.face.id ?? "").localeCompare(b.face.id ?? ""));
  const mainRoofFaces = sortedRoofFaces.slice(0, Math.min(2, sortedRoofFaces.length));
  const mainRoofRoles = stableMainRoofRoles(mainRoofFaces, notes);
  const remainingRoofFaces = sortedRoofFaces.filter(item => !mainRoofFaces.includes(item));
  const garage = additions.find(item => item.elevation === RIGHT || item.elevation === LEFT);
  const garageWidth = valueOf(garage?.width_mm) ?? Math.max(0, dimensions.overall.width - dimensions.main.width);
  const suppliedGarageDepth = valueOf(garage?.depth_mm) ??
    Math.min(dimensions.main.depth, garageWidth || dimensions.main.depth);
  const garageGableWall = walls
    .filter(wall =>
      wall.gableHeight > EPSILON &&
      (Math.abs(wall.span - garageWidth) <= 1 || Math.abs(wall.span - suppliedGarageDepth) <= 1),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const garageDepth = garageGableWall &&
    (garageGableWall.elevation === LEFT || garageGableWall.elevation === RIGHT)
    ? garageGableWall.span
    : suppliedGarageDepth;
  const garageGableElevation = garageGableWall?.elevation ?? null;
  const garageGable = garageGableWall?.gableHeight ?? 0;
  const garageGableRun = garageGableElevation === LEFT || garageGableElevation === RIGHT
    ? garageDepth / 2
    : garageWidth / 2;
  const garagePitchTarget = garageGable > 0 && garageGableRun > 0
    ? (garageGable / garageGableRun) * 12
    : null;
  const garageRoofFaces = garage
    ? remainingRoofFaces
      .slice()
      .sort((a, b) => Math.abs((roofPitch(a.face) ?? 0) - (garagePitchTarget ?? roofPitch(a.face) ?? 0)) -
        Math.abs((roofPitch(b.face) ?? 0) - (garagePitchTarget ?? roofPitch(b.face) ?? 0)) ||
        (a.face.id ?? "").localeCompare(b.face.id ?? ""))
      .slice(0, Math.min(2, remainingRoofFaces.length))
    : [];
  const crossRoofFaces = remainingRoofFaces.filter(item => !garageRoofFaces.includes(item));

  mainRoofFaces.forEach(item => {
    const role = mainRoofRoles.get(item) ?? FRONT;
    const isBack = role === BACK;
    const midY = dimensions.main.depth / 2;
    const pitch = roofPitch(item.face);
    const rise = roofRise(pitch, midY, ridgeHeight - eaveHeight);
    const ridgeZ = eaveHeight + rise;
    const corners = isBack
      ? [
        point(dimensions.main.width, dimensions.main.depth, eaveHeight),
        point(0, dimensions.main.depth, eaveHeight),
        point(0, midY, ridgeZ),
        point(dimensions.main.width, midY, ridgeZ),
      ]
      : [
        point(0, 0, eaveHeight),
        point(dimensions.main.width, 0, eaveHeight),
        point(dimensions.main.width, midY, ridgeZ),
        point(0, midY, ridgeZ),
      ];
    roofs.push(createRoofPlane(item.face, item.face.id ?? `roof-${item.index + 1}`, corners, item.face.elevation ?? FRONT, notes));
  });

  const crossWidth = Math.min(
    dimensions.main.width,
    Math.max(
      1,
      ...crossRoofFaces.map(item => Math.sqrt(Math.max(1, valueOf(item.face.area_mm2) ?? 1))),
    ),
  );
  crossRoofFaces.forEach(item => {
    const half = crossWidth / 2;
    const centre = dimensions.main.width / 2;
    const crossDepth = Math.min(
      dimensions.main.depth / 2,
      Math.max(1, (valueOf(item.face.area_mm2) ?? crossWidth) / Math.max(crossWidth, 1)),
    );
    const pitch = roofPitch(item.face);
    const rise = roofRise(pitch, half, 0);
    const ridgeZ = eaveHeight + rise;
    const left = [
      point(centre - half, 0, eaveHeight),
      point(centre, 0, ridgeZ),
      point(centre, crossDepth, ridgeZ),
      point(centre - half, crossDepth, eaveHeight),
    ];
    const right = [
      point(centre, 0, ridgeZ),
      point(centre + half, 0, eaveHeight),
      point(centre + half, crossDepth, eaveHeight),
      point(centre, crossDepth, ridgeZ),
    ];
    const corners = stableBucket(item.face.id ?? "cross-roof", 2) === 0 ? left : right;
    roofs.push(createRoofPlane(item.face, item.face.id ?? `roof-${item.index + 1}`, corners, item.face.elevation ?? FRONT, notes));
  });

  garageRoofFaces
    .slice()
    .sort((a, b) => (a.face.id ?? "").localeCompare(b.face.id ?? ""))
    .forEach((item) => {
    const x0 = garage?.elevation === LEFT ? -garageWidth : dimensions.main.width;
    const x1 = garage?.elevation === LEFT ? 0 : Math.max(x0 + garageWidth, dimensions.overall.width);
    const midX = (x0 + x1) / 2;
    const garageWallHeights = walls
      .filter(wall => wall.span <= garageWidth + 1)
      .map(wall => wall.height);
    const zEave = garageWallHeights.length > 0
      ? Math.max(...garageWallHeights)
      : eaveHeight;
    const pitch = roofPitch(item.face);
    const rise = roofRise(
      pitch,
      garageGableElevation === LEFT || garageGableElevation === RIGHT
        ? garageDepth / 2
        : (x1 - x0) / 2,
      garageGable,
    );
    const ridgeZ = zEave + rise;
    const slopesAcrossDepth = garageGableElevation === LEFT || garageGableElevation === RIGHT;
    const left = slopesAcrossDepth
      ? [
        point(x0, 0, zEave),
        point(x1, 0, zEave),
        point(x1, garageDepth / 2, ridgeZ),
        point(x0, garageDepth / 2, ridgeZ),
      ]
      : [
        point(x0, 0, zEave),
        point(midX, 0, ridgeZ),
        point(midX, garageDepth, ridgeZ),
        point(x0, garageDepth, zEave),
      ];
    const right = slopesAcrossDepth
      ? [
        point(x0, garageDepth / 2, ridgeZ),
        point(x1, garageDepth / 2, ridgeZ),
        point(x1, garageDepth, zEave),
        point(x0, garageDepth, zEave),
      ]
      : [
        point(midX, 0, ridgeZ),
        point(x1, 0, zEave),
        point(x1, garageDepth, zEave),
        point(midX, garageDepth, ridgeZ),
      ];
    const side = slopesAcrossDepth
      ? stableBucket(item.face.id ?? "garage-roof", 2) === 0 ? "left" : "right"
      : item.face.elevation === BACK
        ? "right"
        : item.face.elevation === FRONT
          ? "left"
          : stableBucket(item.face.id ?? "garage-roof", 2) === 0 ? "left" : "right";
    roofs.push(createRoofPlane(
      item.face,
      item.face.id ?? `roof-${item.index + 1}`,
      side === "left" ? left : right,
      item.face.elevation ?? FRONT,
      notes,
    ));
  });

  // A model with only a tiny or incomplete face set still gets a safe
  // measurement-derived roof representation rather than throwing.
  sortedRoofFaces.forEach(item => {
    if (roofs.some(roof => roof.id === (item.face.id ?? `roof-${item.index + 1}`))) return;
    const side = Math.max(1, Math.sqrt(Math.max(1, item.area)));
    const roof = createRoofPlane(
      item.face,
      item.face.id ?? `roof-${item.index + 1}`,
      [point(0, 0, eaveHeight), point(side, 0, eaveHeight), point(side, side, eaveHeight), point(0, side, eaveHeight)],
      item.face.elevation ?? ROOF,
      notes,
    );
    roofs.push(roof);
    notes.push(`${roof.id}: no supported roof topology; represented as an area-derived neutral plane.`);
  });
    if (measurement.building?.roof_type && measurement.building.roof_type !== "gable") {
    notes.push(`Roof type "${measurement.building.roof_type}" is not a supported topology; measured facets were retained as degraded planes.`);
  }

  const massing: ModelPolygon[] = [];
  const detailedGeometry = wallFaces.length > 0 &&
    roofFaces.length > 0 &&
    dimensions.main.width > 1 &&
    dimensions.main.depth > 1;
  faces.forEach((face, index) => {
    if (face.face_class === "wall" || face.face_class === "roof_face") return;
    const id = face.id ?? `face-${index + 1}`;
    if (detailedGeometry) {
      notes.push(`${id}: unsupported face class "${face.face_class ?? "missing"}" omitted from detailed geometry.`);
      return;
    }
    notes.push(`${id}: unsupported face class "${face.face_class ?? "missing"}" excluded from per-face display; whole-building fallback may be used.`);
  });
  if (!measurement.building?.footprint && faces.length > 0 &&
      !faces.some(face => valueOf(face.width_mm) !== null || valueOf(face.height_mm) !== null)) {
    const sourceFace = faces[0];
    const id = `MASSING-${sourceFace.id ?? "1"}`;
    massing.push(inferredMassing(sourceFace, id, dimensions.main.width, dimensions.main.depth));
    notes.push("Required-fields-only measurement: added an area-derived neutral massing block.");
  }

  const edgeModels = modelParts(measurement.edges, "edge", notes)
    .map((edge, index) => buildEdge(edge, index, walls, roofs, dimensions.main, eaveHeight, notes))
    .filter((edge): edge is ModelEdge => edge !== null);
  const openingModels = buildOpenings(
    modelParts(measurement.openings, "opening", notes),
    walls,
    roofs,
    dimensions.main,
    notes,
  );
  const attachmentModels = buildAttachments(
    attachmentInputs,
    walls,
    roofs,
    dimensions,
    notes,
  );
  const conditionModels = buildConditions(
    modelParts(measurement.condition_areas, "condition", notes),
    walls,
    roofs,
    dimensions.main,
    notes,
  );

  const mainParts = [
    ...walls
      .filter(wall => wall.model.bounds.max.x <= dimensions.main.width + EPSILON)
      .map(wall => wall.model),
    ...roofs
      .filter(roof => roof.model.bounds.max.x <= dimensions.main.width + EPSILON)
      .map(roof => roof.model),
    ...massing,
  ];
  const overallParts = [
    ...walls.map(wall => wall.model),
    ...roofs.map(roof => roof.model),
    ...massing,
    ...attachmentModels,
    ...conditionModels,
    ...openingModels,
  ];
  const allCorners = [
    ...collectPoints(overallParts),
    ...edgeModels.flatMap(edge => [...edge.corners]),
  ];
  const mainCorners = collectPoints(mainParts);
  const fallbackMainCorners = mainCorners.length > 0
    ? mainCorners
    : [point(0, 0, 0), point(dimensions.main.width, dimensions.main.depth, ridgeHeight)];
  const fallbackOverallCorners = allCorners.length > 0
    ? allCorners
    : [point(0, 0, 0), point(dimensions.overall.width, dimensions.overall.depth, ridgeHeight)];
  let mainBounds = boundsFor(fallbackMainCorners);
  let overallBounds = boundsFor(fallbackOverallCorners);
  // Dimensions come from the footprint contract, not from an attached
  // garage.  Keep those two envelopes explicit for the painter and tests.
  mainBounds = {
    ...mainBounds,
    min: point(0, 0, mainBounds.min.z),
    max: point(dimensions.main.width, dimensions.main.depth, mainBounds.max.z),
    widthMm: dimensions.main.width,
    depthMm: dimensions.main.depth,
    heightMm: mainBounds.heightMm,
  };
  overallBounds = {
    ...overallBounds,
    min: point(Math.min(0, overallBounds.min.x), Math.min(0, overallBounds.min.y), overallBounds.min.z),
    max: point(Math.max(dimensions.overall.width, overallBounds.max.x), Math.max(dimensions.overall.depth, overallBounds.max.y), overallBounds.max.z),
    widthMm: Math.max(dimensions.overall.width, overallBounds.max.x) - Math.min(0, overallBounds.min.x),
    depthMm: Math.max(dimensions.overall.depth, overallBounds.max.y) - Math.min(0, overallBounds.min.y),
    heightMm: overallBounds.heightMm,
  };

  const lengthValue = derived?.footprint.length_mm.value ?? null;
  const depthValue = derived?.footprint.depth_mm.value ?? null;
  const eaveValue = derived?.footprint.eave_height_mm.value ?? null;
  const permanentDimensions: ModelDimensions = {
    length: lengthValue === null ? null : makeDimension("length", lengthValue, [{
      start: point(0, 0, 0),
      end: point(lengthValue, 0, 0),
    }]),
    depth: depthValue === null ? null : makeDimension("depth", depthValue, [{
      start: point(0, 0, 0),
      end: point(0, depthValue, 0),
    }]),
    eaveHeight: eaveValue === null ? null : makeDimension("eave_height", eaveValue, [{
      start: point(0, 0, 0),
      end: point(0, 0, eaveValue),
    }]),
  };

  return {
    walls: walls.map(surface => surface.model),
    roofFaces: roofs.map(surface => surface.model),
    roofs: roofs.map(surface => surface.model),
    edges: edgeModels,
    openings: openingModels,
    attachments: attachmentModels,
    conditions: conditionModels,
    massing,
    bounds: {
      main: mainBounds,
      overall: overallBounds,
      widthMm: mainBounds.widthMm,
      depthMm: mainBounds.depthMm,
      heightMm: mainBounds.heightMm,
      overallWidthMm: overallBounds.widthMm,
      overallDepthMm: overallBounds.depthMm,
    },
    permanentDimensions,
    diagnostics: diagnosticsForNotes(notes),
    notes: [...new Set(notes)].sort(),
  };
}
