/** Screen-space presentation only: never changes measurement values or camera framing. */
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
  readonly id: "width" | "ridge" | "eave";
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
export function dimensionRails(bounds: ScreenRect, dimensions: readonly DimensionProjection[], viewport: { width: number; height: number }) {
  const right = Math.max(4, Math.min(bounds.right + 14, viewport.width - 6));
  const below = Math.max(4, Math.min(bounds.bottom + 18, viewport.height - 38));
  const strokes: DimensionStroke[] = [];
  const labels: LabelRequest[] = [];
  for (const dimension of dimensions) {
    const add = (start: ScreenPoint, end: ScreenPoint, dashed = false) =>
      strokes.push({ start, end, dashed, dimensionId: dimension.id });
    const horizontal = dimension.id === "width";
    const a = horizontal ? { x: dimension.start.x, y: below } : { x: right, y: dimension.start.y };
    const b = horizontal ? { x: dimension.end.x, y: below } : { x: right, y: dimension.end.y };
    add(dimension.start, a, true);
    add(dimension.end, b, true);
    add(a, b);
    for (const point of [a, b]) add(
      { x: point.x - (horizontal ? 0 : 4), y: point.y - (horizontal ? 4 : 0) },
      { x: point.x + (horizontal ? 0 : 4), y: point.y + (horizontal ? 4 : 0) },
    );
    labels.push({
      id: dimension.id, width: dimension.width, height: dimension.height, priority: 2,
      region: horizontal ? "below" : "right",
      preferred: horizontal
        ? { x: (a.x + b.x - dimension.width) / 2, y: below + 5 }
        : { x: right + 8 + dimension.width <= viewport.width - 4 ? right + 8 : right - 8 - dimension.width, y: (a.y + b.y - dimension.height) / 2 },
    });
  }
  return { labels, strokes, right, below };
}