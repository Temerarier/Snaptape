/** Screen-space presentation only: never changes measurement values or camera framing. */
import type { ModelDimensions, PermanentDimension } from "./model/types";

export interface ScreenPoint { readonly x: number; readonly y: number }
export interface ScreenRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export interface LabelRequest {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly preferred: ScreenPoint;
  /** Lower numbers win: transient UI, selection, then permanent dimensions. */
  readonly priority: number;
  readonly region?: "below" | "right";
}
export interface PlacedLabel extends ScreenRect {
  readonly id: string;
  readonly conflicts: readonly string[];
}
export function overlapArea(a: ScreenRect, b: ScreenRect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}
export function screenBounds(points: readonly ScreenPoint[]): ScreenRect {
  return {
    left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
  };
}
export function convexHull(points: readonly ScreenPoint[]): ScreenPoint[] {
  const sorted = [...points].filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (items: ScreenPoint[]) => {
    const result: ScreenPoint[] = [];
    for (const point of items) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    return result;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}
/** Exact clipped area against the conservative projected model hull. */
export function silhouetteOverlap(rect: ScreenRect, hull: readonly ScreenPoint[]): number {
  let polygon = [...hull];
  for (const [axis, value, greater] of [
    ["x", rect.left, true], ["x", rect.right, false],
    ["y", rect.top, true], ["y", rect.bottom, false],
  ] as const) {
    const output: ScreenPoint[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = greater ? a[axis] >= value : a[axis] <= value;
      const insideB = greater ? b[axis] >= value : b[axis] <= value;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        output.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
    polygon = output;
  }
  return Math.abs(polygon.reduce((area, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return area + p.x * q.y - p.y * q.x;
  }, 0)) / 2;
}

/** The right edge at this label's vertical band, not the hull's widest point.
 * A roof tip elsewhere on screen must not forbid a free pocket beside an eave. */
export function silhouetteRightAtBand(hull: readonly ScreenPoint[], top: number, bottom: number): number {
  const values: number[] = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    if (a.y >= top && a.y <= bottom) values.push(a.x);
    for (const y of [top, bottom]) {
      if ((a.y < y && b.y > y) || (a.y > y && b.y < y)) {
        values.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
      }
    }
  }
  if (values.length) return Math.max(...values);
  const bounds = screenBounds(hull);
  return (bounds.left + bounds.right) / 2;
}
export function layoutLabels(input: {
  readonly viewport: { width: number; height: number };
  readonly labels: readonly LabelRequest[];
  readonly obstacles: readonly ScreenRect[];
  readonly silhouette: readonly ScreenPoint[];
}): PlacedLabel[] {
  const { viewport, obstacles, silhouette } = input;
  const bounds = screenBounds(silhouette);
  const placed: PlacedLabel[] = [];
  const gap = 6, inset = 4;
  for (const label of [...input.labels].sort((a, b) => a.priority - b.priority)) {
    const occupied = [...obstacles, ...placed];
    const xs = [label.preferred.x, inset, viewport.width - inset - label.width, bounds.right + gap, bounds.left - gap - label.width];
    const ys = [label.preferred.y, inset, viewport.height - inset - label.height, bounds.bottom + gap, bounds.top - gap - label.height];
    for (const rect of occupied) {
      xs.push(rect.right + gap, rect.left - gap - label.width);
      ys.push(rect.bottom + gap, rect.top - gap - label.height);
    }
    for (const point of silhouette) {
      xs.push(point.x + gap, point.x - gap - label.width);
      ys.push(point.y + gap, point.y - gap - label.height);
    }
    const candidates = xs.flatMap(x => ys.map(y => {
      const left = Math.max(inset, Math.min(Math.max(inset, viewport.width - inset - label.width), x));
      const top = Math.max(inset, Math.min(Math.max(inset, viewport.height - inset - label.height), y));
      const rect = { left, top, right: left + label.width, bottom: top + label.height };
      const collisions = occupied.reduce((sum, other) => sum + overlapArea(rect, other), 0);
      const modelOverlap = silhouetteOverlap(rect, silhouette);
      const regionViolation = label.region === "below" ? Math.max(0, bounds.bottom + gap - top)
        : label.region === "right" ? Math.max(0, silhouetteRightAtBand(silhouette, top - gap, rect.bottom + gap) + gap - left) : 0;
      return { rect, score: collisions * 1e8 + modelOverlap * 1e5 + regionViolation * 1e3 +
        Math.hypot(left - label.preferred.x, top - label.preferred.y) };
    }));
    const best = candidates.sort((a, b) => a.score - b.score)[0].rect;
    const conflicts: string[] = [];
    if (best.right > viewport.width || best.bottom > viewport.height) conflicts.push("viewport too small");
    if (obstacles.some(rect => overlapArea(best, rect) > 0.5)) conflicts.push("controls");
    if (placed.some(rect => overlapArea(best, rect) > 0.5)) conflicts.push("higher-priority label");
    if (silhouetteOverlap(best, silhouette) > 0.5) conflicts.push("model silhouette");
    if (label.region === "below" && best.top < bounds.bottom + gap - 0.5) conflicts.push("no room below model");
    if (label.region === "right" && best.left < silhouetteRightAtBand(silhouette, best.top - gap, best.bottom + gap) + gap - 0.5) conflicts.push("no room beside model");
    placed.push({ id: label.id, ...best, conflicts });
  }
  return placed;
}

export interface DimensionProjection {
  readonly id: "length" | "depth" | "eave";
  readonly start: ScreenPoint;
  readonly end: ScreenPoint;
  readonly width: number;
  readonly height: number;
}
export interface DimensionStroke {
  readonly start: ScreenPoint;
  readonly end: ScreenPoint;
  readonly dashed: boolean;
  readonly dimensionId: string;
}

export interface PermanentDimensionEntry {
  readonly id: "length" | "depth" | "eave";
  readonly dimension: PermanentDimension;
}

/** The visibility gate is applied before rail and label requests are built, so
 * hidden dimensions reserve no collision-layout space. */
export function visiblePermanentDimensions(
  dimensions: ModelDimensions,
  showDimensions: boolean,
): PermanentDimensionEntry[] {
  if (!showDimensions) return [];
  return [
    { id: "length" as const, dimension: dimensions.length },
    { id: "depth" as const, dimension: dimensions.depth },
    { id: "eave" as const, dimension: dimensions.eaveHeight },
  ].filter((item): item is PermanentDimensionEntry =>
    item.dimension !== null && item.dimension.segments.length > 0
  );
}
export function dimensionRails(
  bounds: ScreenRect,
  dimensions: readonly DimensionProjection[],
  viewport: { width: number; height: number },
  silhouette: readonly ScreenPoint[] = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ],
) {
  const right = Math.max(4, Math.min(bounds.right + 14, viewport.width - 6));
  const below = Math.max(4, Math.min(bounds.bottom + 18, viewport.height - 38));
  const strokes: DimensionStroke[] = [];
  const labels: LabelRequest[] = [];
  for (const dimension of dimensions) {
    const add = (start: ScreenPoint, end: ScreenPoint, dashed = false) =>
      strokes.push({ start, end, dashed, dimensionId: dimension.id });
    const ground = dimension.id === "length" || dimension.id === "depth";
    const dx = dimension.end.x - dimension.start.x;
    const dy = dimension.end.y - dimension.start.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const baseNormal = { x: -dy / magnitude, y: dx / magnitude };
    const dot = (point: ScreenPoint) => point.x * baseNormal.x + point.y * baseNormal.y;
    const sourceProjection = dot(dimension.start);
    const hullProjections = silhouette.map(dot);
    const clearance = 14;
    const signedCandidates = [
      Math.max(clearance, Math.max(...hullProjections) - sourceProjection + clearance),
      Math.min(-clearance, Math.min(...hullProjections) - sourceProjection - clearance),
    ];
    const overflow = (point: ScreenPoint) =>
      Math.max(0, 4 - point.x) + Math.max(0, point.x - viewport.width + 4) +
      Math.max(0, 4 - point.y) + Math.max(0, point.y - viewport.height + 4);
    const candidateScore = (signedOffset: number) => {
      const a = {
        x: dimension.start.x + baseNormal.x * signedOffset,
        y: dimension.start.y + baseNormal.y * signedOffset,
      };
      const b = {
        x: dimension.end.x + baseNormal.x * signedOffset,
        y: dimension.end.y + baseNormal.y * signedOffset,
      };
      const side = Math.sign(signedOffset) || 1;
      const labelCentre = {
        x: (a.x + b.x) / 2 + baseNormal.x * side * (7 + dimension.width / 2),
        y: (a.y + b.y) / 2 + baseNormal.y * side * (7 + dimension.height / 2),
      };
      return (overflow(a) + overflow(b) + overflow(labelCentre)) * 1e6 +
        Math.abs(signedOffset);
    };
    const signedOffset = ground
      ? signedCandidates.slice().sort((a, b) => candidateScore(a) - candidateScore(b))[0]
      : 0;
    const side = Math.sign(signedOffset) || 1;
    const normal = {
      x: baseNormal.x * side,
      y: baseNormal.y * side,
    };
    const a = ground
      ? {
        x: dimension.start.x + baseNormal.x * signedOffset,
        y: dimension.start.y + baseNormal.y * signedOffset,
      }
      : { x: right, y: dimension.start.y };
    const b = ground
      ? {
        x: dimension.end.x + baseNormal.x * signedOffset,
        y: dimension.end.y + baseNormal.y * signedOffset,
      }
      : { x: right, y: dimension.end.y };
    add(dimension.start, a, true);
    add(dimension.end, b, true);
    add(a, b);
    const tick = ground ? normal : { x: 1, y: 0 };
    for (const point of [a, b]) {
      add(
        { x: point.x - tick.x * 4, y: point.y - tick.y * 4 },
        { x: point.x + tick.x * 4, y: point.y + tick.y * 4 },
      );
    }
    labels.push({
      id: dimension.id, width: dimension.width, height: dimension.height, priority: 2,
      region: ground ? undefined : "right",
      preferred: ground
        ? {
          x: (a.x + b.x - dimension.width) / 2 + normal.x * 7,
          y: (a.y + b.y - dimension.height) / 2 + normal.y * 7,
        }
        : { x: right + 8 + dimension.width <= viewport.width - 4 ? right + 8 : right - 8 - dimension.width, y: (a.y + b.y - dimension.height) / 2 },
    });
  }
  return { labels, strokes, right, below };
}