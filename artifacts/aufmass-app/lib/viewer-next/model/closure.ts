import type {
  Bounds3,
  Frame3,
  ModelColor,
  ModelPolygon,
  Point3,
  Triangle,
  Vector3,
  ViewerModel,
} from "./types";

const EPSILON = 1e-6;

interface Point2 {
  readonly x: number;
  readonly y: number;
}

interface FootprintSource {
  readonly points: readonly Point2[];
  readonly color: ModelColor;
}

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function vector(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

function subtract(a: Point3, b: Point3): Vector3 {
  return vector(a.x - b.x, a.y - b.y, a.z - b.z);
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

function unit(value: Vector3, fallback: Vector3): Vector3 {
  const length = Math.sqrt(dot(value, value));
  return length > EPSILON
    ? vector(value.x / length, value.y / length, value.z / length)
    : fallback;
}

function boundsFor(corners: readonly Point3[]): Bounds3 {
  const min = point(
    Math.min(...corners.map(corner => corner.x)),
    Math.min(...corners.map(corner => corner.y)),
    Math.min(...corners.map(corner => corner.z)),
  );
  const max = point(
    Math.max(...corners.map(corner => corner.x)),
    Math.max(...corners.map(corner => corner.y)),
    Math.max(...corners.map(corner => corner.z)),
  );
  return {
    min,
    max,
    widthMm: max.x - min.x,
    depthMm: max.y - min.y,
    heightMm: max.z - min.z,
  };
}

function makePolygon(
  id: string,
  corners: readonly Point3[],
  triangles: readonly Triangle[],
  normal: Vector3,
  color: ModelColor,
): ModelPolygon {
  const tangent = unit(subtract(corners[1], corners[0]), vector(1, 0, 0));
  const frame: Frame3 = {
    origin: corners[0],
    tangent,
    up: vector(0, 0, 1),
    normal,
  };
  return {
    id,
    corners,
    triangles,
    normal,
    frame,
    bounds: boundsFor(corners),
    color,
    elevation: null,
  };
}

function signedArea(points: readonly Point2[]): number {
  return points.reduce((sum, current, index) => {
    const next = points[(index + 1) % points.length];
    return sum + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function pointInPolygon(target: Point2, polygon: readonly Point2[]): boolean {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects = (a.y > target.y) !== (b.y > target.y) &&
      target.x < ((b.x - a.x) * (target.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function uniqueSorted(values: readonly number[]): number[] {
  return values
    .slice()
    .sort((a, b) => a - b)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > EPSILON);
}

function footprintSources(model: ViewerModel, baseZ: number): FootprintSource[] {
  const roofs = model.roofFaces
    .map(roof => ({
      points: roof.corners.map(corner => ({ x: corner.x, y: corner.y })),
      color: roof.color,
    }))
    .filter(source => source.points.length >= 3 && Math.abs(signedArea(source.points)) > EPSILON);

  const groundAttachments = model.attachments
    .filter(attachment =>
      Math.abs(attachment.bounds.min.z - baseZ) <= EPSILON &&
      (attachment.type === "addition" || attachment.type === "bay" || attachment.type === "garage"))
    .map(attachment => ({
      points: attachment.corners.slice(0, 4).map(corner => ({ x: corner.x, y: corner.y })),
      color: attachment.color,
    }))
    .filter(source => source.points.length >= 3 && Math.abs(signedArea(source.points)) > EPSILON);

  if (roofs.length > 0 || groundAttachments.length > 0) return [...roofs, ...groundAttachments];

  return model.massing
    .filter(part => Math.abs(part.bounds.min.z - baseZ) <= EPSILON)
    .map(part => ({
      points: part.corners.slice(0, 4).map(corner => ({ x: corner.x, y: corner.y })),
      color: part.color,
    }))
    .filter(source => source.points.length >= 3 && Math.abs(signedArea(source.points)) > EPSILON);
}

function projectedZ(triangle: Triangle, target: Point2): number | null {
  const [a, b, c] = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) <= EPSILON) return null;
  const wa = ((b.y - c.y) * (target.x - c.x) + (c.x - b.x) * (target.y - c.y)) / denominator;
  const wb = ((c.y - a.y) * (target.x - c.x) + (a.x - c.x) * (target.y - c.y)) / denominator;
  const wc = 1 - wa - wb;
  if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) return null;
  return wa * a.z + wb * b.z + wc * c.z;
}

function roofHeightAt(
  model: ViewerModel,
  target: Point2,
  regionPoint: Point2,
  baseZ: number,
): number {
  // Restrict the sample to roofs covering this occupied footprint cell. At an
  // attachment junction, a boundary vertex can also lie on the taller main
  // roof; taking a model-wide maximum would incorrectly stretch the garage
  // closure up that main slope.
  const regionRoofs = model.roofFaces.filter(roof =>
    pointInPolygon(regionPoint, roof.corners.map(corner => ({ x: corner.x, y: corner.y }))));
  const heights = regionRoofs.flatMap(roof =>
    roof.triangles
      .map(triangle => projectedZ(triangle, target))
      .filter((height): height is number => height !== null));
  if (heights.length > 0) return Math.max(...heights);

  const wallHeights = model.walls
    .filter(wall =>
      target.x >= wall.bounds.min.x - EPSILON &&
      target.x <= wall.bounds.max.x + EPSILON &&
      target.y >= wall.bounds.min.y - EPSILON &&
      target.y <= wall.bounds.max.y + EPSILON)
    .map(wall => wall.bounds.max.z);
  return wallHeights.length > 0 ? Math.max(...wallHeights) : baseZ;
}

function between(value: number, a: number, b: number): boolean {
  return value >= Math.min(a, b) - EPSILON && value <= Math.max(a, b) + EPSILON;
}

function wallHeightAt(
  model: ViewerModel,
  target: Point2,
  expectedNormal: Vector3,
  baseZ: number,
): number {
  const fixedAxis = Math.abs(expectedNormal.x) > 0.5 ? "x" : "y";
  const spanAxis = fixedAxis === "x" ? "y" : "x";
  const candidates = model.walls.filter(wall =>
    Math.abs(wall.bounds.max[fixedAxis] - wall.bounds.min[fixedAxis]) <= EPSILON &&
    Math.abs(target[fixedAxis] - wall.bounds.min[fixedAxis]) <= EPSILON &&
    between(target[spanAxis], wall.bounds.min[spanAxis], wall.bounds.max[spanAxis]));
  const heights: number[] = [];
  for (const wall of candidates) {
    wall.corners.forEach((corner, index) => {
      const next = wall.corners[(index + 1) % wall.corners.length];
      const start = corner[spanAxis];
      const end = next[spanAxis];
      if (!between(target[spanAxis], start, end)) return;
      if (Math.abs(end - start) <= EPSILON) {
        heights.push(corner.z, next.z);
        return;
      }
      const ratio = (target[spanAxis] - start) / (end - start);
      heights.push(corner.z + (next.z - corner.z) * ratio);
    });
  }
  return heights.length > 0 ? Math.max(...heights) : baseZ;
}

function closureWall(
  id: string,
  start: Point3,
  end: Point3,
  expectedNormal: Vector3,
  model: ViewerModel,
  color: ModelColor,
  regionPoint: Point2,
  baseZ: number,
): ModelPolygon | null {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  // One model millimetre is large enough to get beyond barycentric edge
  // tolerances, then the two interior samples are extrapolated back to the
  // exact boundary so the resulting seam still meets the original geometry.
  const inset = Math.min(1, length / 4);
  const alongX = length > EPSILON ? (end.x - start.x) / length : 0;
  const alongY = length > EPSILON ? (end.y - start.y) / length : 0;
  const startSample = {
    x: start.x + alongX * inset - expectedNormal.x * inset,
    y: start.y + alongY * inset - expectedNormal.y * inset,
  };
  const endSample = {
    x: end.x - alongX * inset - expectedNormal.x * inset,
    y: end.y - alongY * inset - expectedNormal.y * inset,
  };
  const startInnerSample = {
    x: startSample.x - expectedNormal.x * inset,
    y: startSample.y - expectedNormal.y * inset,
  };
  const endInnerSample = {
    x: endSample.x - expectedNormal.x * inset,
    y: endSample.y - expectedNormal.y * inset,
  };
  const startWallSample = {
    x: start.x + alongX * inset,
    y: start.y + alongY * inset,
  };
  const endWallSample = {
    x: end.x - alongX * inset,
    y: end.y - alongY * inset,
  };
  const startNearHeight = roofHeightAt(model, startSample, regionPoint, baseZ);
  const endNearHeight = roofHeightAt(model, endSample, regionPoint, baseZ);
  const startTop = point(
    start.x,
    start.y,
    2 * startNearHeight - roofHeightAt(model, startInnerSample, regionPoint, baseZ),
  );
  const endTop = point(
    end.x,
    end.y,
    2 * endNearHeight - roofHeightAt(model, endInnerSample, regionPoint, baseZ),
  );
  const startBottom = point(
    start.x,
    start.y,
    wallHeightAt(model, startWallSample, expectedNormal, baseZ),
  );
  const endBottom = point(
    end.x,
    end.y,
    wallHeightAt(model, endWallSample, expectedNormal, baseZ),
  );
  if (startTop.z <= startBottom.z + EPSILON && endTop.z <= endBottom.z + EPSILON) return null;
  let corners = [startBottom, endBottom, endTop, startTop];
  const computed = cross(subtract(corners[1], corners[0]), subtract(corners[2], corners[0]));
  if (dot(computed, expectedNormal) < 0) corners = corners.slice().reverse();
  return makePolygon(
    id,
    corners,
    [[corners[0], corners[1], corners[2]], [corners[0], corners[2], corners[3]]],
    expectedNormal,
    color,
  );
}

/**
 * Produces non-measurement geometry that a renderer may add as opaque,
 * noninteractive meshes. The footprint is the union of projected roof/ground
 * attachment polygons, split into exact rectilinear cells; it is deliberately
 * not the model's overall bounding box.
 */
export function buildPresentationClosure(model: ViewerModel): ModelPolygon[] {
  const geometry = [...model.walls, ...model.roofFaces, ...model.attachments, ...model.massing];
  if (geometry.length === 0) return [];
  const baseZ = Math.min(...geometry.map(part => part.bounds.min.z));
  const sources = footprintSources(model, baseZ);
  if (sources.length === 0) return [];

  const xs = uniqueSorted(sources.flatMap(source => source.points.map(item => item.x)));
  const ys = uniqueSorted(sources.flatMap(source => source.points.map(item => item.y)));
  if (xs.length < 2 || ys.length < 2) return [];

  const occupied: boolean[][] = Array.from({ length: xs.length - 1 }, () =>
    Array.from({ length: ys.length - 1 }, () => false));
  const colors: (ModelColor | null)[][] = Array.from({ length: xs.length - 1 }, () =>
    Array.from({ length: ys.length - 1 }, () => null));

  for (let x = 0; x < xs.length - 1; x += 1) {
    for (let y = 0; y < ys.length - 1; y += 1) {
      const midpoint = { x: (xs[x] + xs[x + 1]) / 2, y: (ys[y] + ys[y + 1]) / 2 };
      const source = sources.find(candidate => pointInPolygon(midpoint, candidate.points));
      occupied[x][y] = Boolean(source);
      colors[x][y] = source?.color ?? null;
    }
  }

  const result: ModelPolygon[] = [];
  for (let x = 0; x < xs.length - 1; x += 1) {
    for (let y = 0; y < ys.length - 1; y += 1) {
      if (!occupied[x][y] || !colors[x][y]) continue;
      const a = point(xs[x], ys[y], baseZ);
      const b = point(xs[x], ys[y + 1], baseZ);
      const c = point(xs[x + 1], ys[y + 1], baseZ);
      const d = point(xs[x + 1], ys[y], baseZ);
      result.push(makePolygon(
        `presentation-cap-${x}-${y}`,
        [a, b, c, d],
        [[a, b, c], [a, c, d]],
        vector(0, 0, -1),
        colors[x][y]!,
      ));

      const boundaries: Array<{
        outside: boolean;
        start: Point3;
        end: Point3;
        normal: Vector3;
        suffix: string;
      }> = [
        { outside: x === 0 || !occupied[x - 1][y], start: a, end: b, normal: vector(-1, 0, 0), suffix: "left" },
        { outside: x === xs.length - 2 || !occupied[x + 1][y], start: d, end: c, normal: vector(1, 0, 0), suffix: "right" },
        { outside: y === 0 || !occupied[x][y - 1], start: a, end: d, normal: vector(0, -1, 0), suffix: "front" },
        { outside: y === ys.length - 2 || !occupied[x][y + 1], start: b, end: c, normal: vector(0, 1, 0), suffix: "back" },
      ];
      for (const boundary of boundaries) {
        if (!boundary.outside) continue;
        const wall = closureWall(
          `presentation-seam-${x}-${y}-${boundary.suffix}`,
          boundary.start,
          boundary.end,
          boundary.normal,
          model,
          colors[x][y]!,
          { x: (xs[x] + xs[x + 1]) / 2, y: (ys[y] + ys[y + 1]) / 2 },
          baseZ,
        );
        if (wall) result.push(wall);
      }
    }
  }
  return result;
}