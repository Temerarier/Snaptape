import type {
  ModelAttachment,
  ModelEdge,
  ModelOpening,
  ModelPolygon,
  ModelRoofFace,
  ModelWall,
  Point3,
  Vector3,
  ViewerModel,
} from "./model";

const MM_PER_INCH = 25.4;
const MM2_PER_SQ_FT = 92903.04;
const DEFAULT_SNAP_RADIUS_PX = 28;
const EPSILON = 1e-6;

export type SelectableElement =
  | ModelWall
  | ModelRoofFace
  | ModelEdge
  | ModelOpening
  | ModelAttachment;

export interface SelectionDetails {
  readonly id: string;
  readonly kind: "wall" | "roof" | "edge" | "opening" | "attachment";
  readonly title: string;
  readonly dimensions: readonly string[];
  readonly value: string;
  /** Element centre used for camera focus; anchor is offset for the card. */
  readonly target: Point3;
  readonly anchor: Point3;
}

export interface SnapResult {
  readonly point: Point3;
  readonly snapped: boolean;
  readonly targetId: string | null;
  readonly targetKind: "corner" | "edge" | null;
  readonly distanceMm: number;
}

export interface SnapScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly visible?: boolean;
}

export interface SnapOptions {
  readonly radiusPx?: number;
  /** Kept for deterministic world-space unit tests and non-screen callers. */
  readonly radiusMm?: number;
  readonly screenPoint?: { readonly x: number; readonly y: number };
  readonly project?: (point: Point3) => SnapScreenPoint;
  /**
   * The painter supplies an opaque-object raycast here. Screen depth values
   * are not reliable at the building scale under perspective projection.
   */
  readonly isVisible?: (point: Point3, projected: SnapScreenPoint) => boolean;
}
export interface MeasureLine {
  readonly start: Point3;
  readonly end: Point3;
  readonly lengthMm: number;
  readonly label: string;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function distance(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function point(x: number, y: number, z: number): Point3 {
  return { x, y, z };
}

function centerOf(part: { bounds: { min: Point3; max: Point3 } }): Point3 {
  return point(
    (part.bounds.min.x + part.bounds.max.x) / 2,
    (part.bounds.min.y + part.bounds.max.y) / 2,
    (part.bounds.min.z + part.bounds.max.z) / 2,
  );
}

export interface SelectionScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface SelectionPlacementInput {
  readonly element: SelectionScreenRect;
  readonly box: { readonly width: number; readonly height: number };
  readonly viewport: { readonly width: number; readonly height: number };
  readonly avoid?: readonly SelectionScreenRect[];
}

/**
 * Returns the portion of the viewport that is exposed above the mobile
 * measurements sheet. `sheetTop` is relative to the viewport's top edge; a
 * sheet outside the viewport leaves the full height available.
 */
export function getExposedViewport(
  viewport: { readonly width: number; readonly height: number },
  sheetTop: number | null | undefined,
): { width: number; height: number } {
  if (!Number.isFinite(sheetTop)) return { width: viewport.width, height: viewport.height };
  return {
    width: viewport.width,
    height: Math.max(1, Math.min(viewport.height, sheetTop as number)),
  };
}

export interface SelectionPlacement {
  readonly left: number;
  readonly top: number;
  readonly anchorLeft: number;
  readonly anchorTop: number;
  readonly side: "right" | "left" | "below" | "above";
}

function overlapArea(a: SelectionScreenRect, b: SelectionScreenRect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/**
 * Chooses a side from projected element bounds instead of assuming a fixed
 * card size or viewport corner. Controls are supplied as projected rectangles
 * so this remains useful for desktop, tablet, and phone.
 */
export function chooseSelectionPlacement(input: SelectionPlacementInput): SelectionPlacement {
  const { element, box, viewport, avoid = [] } = input;
  const gap = 12;
  const centreY = (element.top + element.bottom) / 2;
  const centreX = (element.left + element.right) / 2;
  const candidates: Array<{
    side: SelectionPlacement["side"];
    left: number;
    top: number;
  }> = [
    { side: "right", left: element.right + gap, top: centreY - box.height / 2 },
    { side: "left", left: element.left - gap - box.width, top: centreY - box.height / 2 },
    { side: "below", left: centreX - box.width / 2, top: element.bottom + gap },
    { side: "above", left: centreX - box.width / 2, top: element.top - gap - box.height },
  ];
  const score = (candidate: typeof candidates[number]): number => {
    const rect = {
      left: candidate.left,
      top: candidate.top,
      right: candidate.left + box.width,
      bottom: candidate.top + box.height,
    };
    const overflow =
      Math.max(0, -rect.left) +
      Math.max(0, -rect.top) +
      Math.max(0, rect.right - viewport.width) +
      Math.max(0, rect.bottom - viewport.height);
    const controlOverlap = avoid.reduce((sum, control) => sum + overlapArea(rect, control), 0);
    return controlOverlap * 1000 + overflow * 10;
  };
  const chosen = candidates.slice().sort((a, b) => score(a) - score(b))[0] ?? candidates[0];
  const left = Math.max(0, Math.min(Math.max(0, viewport.width - box.width), chosen.left));
  const top = Math.max(0, Math.min(Math.max(0, viewport.height - box.height), chosen.top));
  const anchorLeft = Math.max(element.left, Math.min(element.right, left + box.width / 2));
  const anchorTop = Math.max(element.top, Math.min(element.bottom, top + box.height / 2));
  return { left, top, anchorLeft, anchorTop, side: chosen.side };
}

function add(a: Point3, b: Vector3): Point3 {
  return point(a.x + b.x, a.y + b.y, a.z + b.z);
}

function formatFeetInches(mm: number): string {
  const inches = Math.max(0, Math.round((finite(mm) ? mm : 0) / MM_PER_INCH));
  const feet = Math.floor(inches / 12);
  return `${feet}' ${inches % 12}"`;
}

function formatArea(mm2: number | null | undefined): string {
  if (mm2 === null || mm2 === undefined || !finite(mm2)) return "—";
  return `${Math.round(mm2 / MM2_PER_SQ_FT)} sq ft`;
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !finite(value) ? "—" : String(value);
}

function selectionKind(element: SelectableElement): SelectionDetails["kind"] {
  if ("faceClass" in element) return element.faceClass === "wall" ? "wall" : "roof";
  if ("edgeClass" in element) return "edge";
  if ("parentFaceId" in element && "type" in element && "depthMm" in element) return "attachment";
  return "opening";
}

/**
 * Returns the text shown in the anchored selection card.  It intentionally
 * reads only values that are already present in the model; the painter does
 * not derive quote geometry or measurement values.
 */
export function getSelectionDetails(element: SelectableElement): SelectionDetails {
  const kind = selectionKind(element);
  const target = centerOf(element);
  const anchor = add(centerOf(element), {
    x: element.normal.x * 120,
    y: element.normal.y * 120,
    z: element.normal.z * 120,
  });

  if (kind === "wall") {
    const wall = element as ModelWall;
    const dimensions = [`${formatFeetInches(wall.widthMm)} × ${formatFeetInches(wall.heightMm)}`];
    if (wall.gableHeightMm > EPSILON) {
      dimensions.push(
        `+ gable ${formatFeetInches(wall.widthMm)} × ${formatFeetInches(wall.gableHeightMm)} / 2`,
      );
    }
    return {
      id: wall.id,
      kind,
      title: wall.elevation ? `${wall.elevation} · ${wall.id}` : wall.id,
      dimensions,
      value: `${formatArea(wall.netAreaMm2)} net`,
      target,
      anchor,
    };
  }
  if (kind === "roof") {
    const roof = element as ModelRoofFace;
    return {
      id: roof.id,
      kind,
      title: roof.elevation ? `${roof.elevation} · ${roof.id}` : roof.id,
      dimensions: [`${formatNumber(roof.pitchRiseOver12)}/12 pitch`],
      value: formatArea(roof.areaMm2),
      target,
      anchor,
    };
  }
  if (kind === "edge") {
    const edge = element as ModelEdge;
    return {
      id: edge.id,
      kind,
      title: edge.edgeClass.replace(/_/g, " "),
      dimensions: [`${formatFeetInches(edge.lengthMm)} length`],
      value: formatFeetInches(edge.lengthMm),
      target,
      anchor,
    };
  }
  if (kind === "opening") {
    const opening = element as ModelOpening;
    return {
      id: opening.id,
      kind,
      title: `${opening.type.replace(/_/g, " ")} · ${opening.id}`,
      dimensions: [`${formatFeetInches(opening.widthMm)} × ${formatFeetInches(opening.heightMm)}`],
      value: `${formatArea(opening.areaMm2)} area`,
      target,
      anchor,
    };
  }
  const attachment = element as ModelAttachment;
  return {
    id: attachment.id,
    kind,
    title: `${attachment.type.replace(/_/g, " ")} · ${attachment.id}`,
    dimensions: [
      `${formatFeetInches(attachment.widthMm)} × ${formatFeetInches(attachment.heightMm)} × ${formatFeetInches(attachment.depthMm)}`,
    ],
    value: attachment.type,
    target,
    anchor,
  };
}

export function findSelectableElement(
  model: ViewerModel,
  id: string | null | undefined,
): SelectableElement | null {
  if (!id) return null;
  return (
    model.walls.find(item => item.id === id) ??
    model.roofFaces.find(item => item.id === id) ??
    model.edges.find(item => item.id === id) ??
    model.openings.find(item => item.id === id) ??
    model.attachments.find(item => item.id === id) ??
    null
  );
}

interface Segment {
  readonly start: Point3;
  readonly end: Point3;
  readonly id: string;
}

function modelSegments(model: ViewerModel): Segment[] {
  const segments: Segment[] = [];
  const appendPolygonEdges = (polygon: ModelPolygon): void => {
    for (let index = 0; index < polygon.corners.length; index += 1) {
      const start = polygon.corners[index];
      const end = polygon.corners[(index + 1) % polygon.corners.length];
      if (start && end && distance(start, end) > EPSILON) {
        segments.push({ start, end, id: polygon.id });
      }
    }
  };
  for (const polygon of [...model.walls, ...model.roofFaces, ...model.openings]) {
    appendPolygonEdges(polygon);
  }
  for (const attachment of model.attachments) {
    if (attachment.corners.length === 8) {
      // Attachment boxes store four base and four top corners. Treat their
      // topology as a box instead of looping the storage array, which would
      // invent base-to-top diagonals and omit all four vertical edges.
      const edgePairs: readonly (readonly [number, number])[] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      for (const [startIndex, endIndex] of edgePairs) {
        const start = attachment.corners[startIndex];
        const end = attachment.corners[endIndex];
        if (start && end && distance(start, end) > EPSILON) {
          segments.push({ start, end, id: attachment.id });
        }
      }
    } else {
      appendPolygonEdges(attachment);
    }
  }
  for (const edge of model.edges) {
    segments.push({ start: edge.corners[0], end: edge.corners[1], id: edge.id });
  }
  return segments;
}

function closestOnSegment(target: Point3, segment: Segment): { point: Point3; distanceMm: number } {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  if (lengthSquared <= EPSILON) {
    return { point: segment.start, distanceMm: distance(target, segment.start) };
  }
  const t = Math.max(0, Math.min(1, (
    (target.x - segment.start.x) * dx +
    (target.y - segment.start.y) * dy +
    (target.z - segment.start.z) * dz
  ) / lengthSquared));
  const projected = point(
    segment.start.x + dx * t,
    segment.start.y + dy * t,
    segment.start.z + dz * t,
  );
  return { point: projected, distanceMm: distance(target, projected) };
}

function closestOnProjectedSegment(
  segment: Segment,
  screenPoint: { readonly x: number; readonly y: number },
  project: (point: Point3) => SnapScreenPoint,
): { point: Point3; distancePx: number } {
  const screenDistance = (fraction: number): number => {
    const candidate = point(
      segment.start.x + (segment.end.x - segment.start.x) * fraction,
      segment.start.y + (segment.end.y - segment.start.y) * fraction,
      segment.start.z + (segment.end.z - segment.start.z) * fraction,
    );
    const projected = project(candidate);
    return Math.hypot(projected.x - screenPoint.x, projected.y - screenPoint.y);
  };
  // The projected path of a world segment is rational under perspective. A
  // short ternary search therefore finds the closest screen point without
  // pretending that world-space interpolation is screen-linear.
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const first = low + (high - low) / 3;
    const second = high - (high - low) / 3;
    if (screenDistance(first) <= screenDistance(second)) high = second;
    else low = first;
  }
  const fraction = (low + high) / 2;
  const result = point(
    segment.start.x + (segment.end.x - segment.start.x) * fraction,
    segment.start.y + (segment.end.y - segment.start.y) * fraction,
    segment.start.z + (segment.end.z - segment.start.z) * fraction,
  );
  return { point: result, distancePx: screenDistance(fraction) };
}

/**
 * Snap only while placing a measure endpoint. Corners are considered before
 * edges, and a point in the middle of a broad face remains free when it is
 * outside the explicit radius.
 */
export function snapMeasurePoint(
  target: Point3,
  model: ViewerModel,
  options: SnapOptions | number = {},
): SnapResult {
  const legacyRadiusMm = typeof options === "number" ? options : options.radiusMm;
  const screenPoint = typeof options === "number" ? undefined : options.screenPoint;
  const project = typeof options === "number" ? undefined : options.project;
  const radiusPx = typeof options === "number" ? DEFAULT_SNAP_RADIUS_PX : (options.radiusPx ?? DEFAULT_SNAP_RADIUS_PX);
  const isVisible = typeof options === "number" ? undefined : options.isVisible;
  const screenMode = Boolean(screenPoint && project);
  const candidateDistance = (candidate: Point3, distanceMm: number): number | null => {
    if (screenMode && screenPoint && project) {
      const projected = project(candidate);
      if (projected.visible === false) return null;
      if (isVisible && !isVisible(candidate, projected)) return null;
      const distancePx = Math.hypot(projected.x - screenPoint.x, projected.y - screenPoint.y);
      return distancePx <= radiusPx ? distancePx : null;
    }
    if (legacyRadiusMm !== undefined && distanceMm <= legacyRadiusMm) return distanceMm;
    return null;
  };
  const segments = modelSegments(model);
  const corners = segments.flatMap(segment => [
    { point: segment.start, id: segment.id },
    { point: segment.end, id: segment.id },
  ]);
  let nearestCorner: { point: Point3; id: string; distanceMm: number; priority: number } | null = null;
  for (const candidate of corners) {
    const distanceMm = distance(target, candidate.point);
    const priority = candidateDistance(candidate.point, distanceMm);
    if (priority !== null && (!nearestCorner || priority < nearestCorner.priority)) {
      nearestCorner = { ...candidate, distanceMm, priority };
    }
  }
  if (nearestCorner) {
    return {
      point: nearestCorner.point,
      snapped: true,
      targetId: nearestCorner.id,
      targetKind: "corner",
      distanceMm: nearestCorner.distanceMm,
    };
  }

  let nearestEdge: { point: Point3; id: string; distanceMm: number; priority: number } | null = null;
  for (const segment of segments) {
    const candidate = screenMode && screenPoint && project
      ? (() => {
        const projected = closestOnProjectedSegment(segment, screenPoint, project);
        return {
          point: projected.point,
          distanceMm: distance(target, projected.point),
          screenDistancePx: projected.distancePx,
        };
      })()
      : { ...closestOnSegment(target, segment), screenDistancePx: 0 };
    const priority = screenMode && screenPoint && project
      ? (() => {
        const projected = project(candidate.point);
        if (projected.visible === false || (isVisible && !isVisible(candidate.point, projected))) return null;
        return candidate.screenDistancePx <= radiusPx ? candidate.screenDistancePx : null;
      })()
      : candidateDistance(candidate.point, candidate.distanceMm);
    if (priority !== null && (!nearestEdge || priority < nearestEdge.priority)) {
      nearestEdge = { ...candidate, id: segment.id, priority };
    }
  }
  return nearestEdge
    ? {
      point: nearestEdge.point,
      snapped: true,
      targetId: nearestEdge.id,
      targetKind: "edge",
      distanceMm: nearestEdge.distanceMm,
    }
    : {
      point: target,
      snapped: false,
      targetId: null,
      targetKind: null,
      distanceMm: Number.POSITIVE_INFINITY,
    };
}

export function createMeasureLine(start: Point3, end: Point3): MeasureLine {
  const lengthMm = distance(start, end);
  return { start, end, lengthMm, label: formatFeetInches(lengthMm) };
}

export function formatModelLength(mm: number): string {
  return formatFeetInches(mm);
}