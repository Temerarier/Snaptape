import { ShapeUtils, Vector2 } from "three";
import type { DerivedMeasurement } from "@workspace/measurement";
import type { Model3dData } from "@workspace/db";
import type { ViewerMeasurement } from "./input";
import type {
  ModelAttachment, ModelConditionArea, ModelEdge, ModelOpening, ModelPolygon,
  ModelRoofFace, ModelWall, Point3, Triangle, ViewerModel,
} from "./types";
import { attachmentColor, boundsFor, colorFor, makeDimension, openingTypeColor, polygon } from "./buildModel";

type Row = Record<string, unknown>;
export type Model3dStatus = "pending" | "ready" | "unavailable" | null;
const number = (input: unknown): number | null => {
  const v = input && typeof input === "object" ? (input as Row).value : input;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const text = (input: unknown): string | null => typeof input === "string" ? input : null;
const indexed = <T extends { readonly id?: string }>(rows: readonly T[] | null | undefined) =>
  new Map((rows ?? []).filter(row => row.id).map(row => [row.id!, row]));
function point(input: unknown): Point3 {
  if (!Array.isArray(input) || input.length !== 3 ||
    input.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error("Invalid model3d point");
  }
  return { x: input[0], y: input[1], z: input[2] };
}
const plus = (a: Point3, b: Point3, s = 1): Point3 =>
  ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
function points(input: unknown): Point3[] {
  if (!Array.isArray(input) || input.length < 3) throw new Error("Invalid model3d polygon");
  return input.map(point);
}
function geometricPolygon(
  id: string, corners: Point3[], color: ModelPolygon["color"], elevation: string | null,
): ModelPolygon {
  // Newell normal works when initial vertices are collinear. Ear clipping also
  // handles concave A polygons, unlike a fan through the polygon's interior.
  const normal = { x: 0, y: 0, z: 0 };
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]!;
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  });
  const length = Math.hypot(normal.x, normal.y, normal.z);
  if (length < 1e-8) throw new Error(`Degenerate model3d polygon: ${id}`);
  const n = { x: normal.x / length, y: normal.y / length, z: normal.z / length };
  const base = polygon(id, corners, color, elevation, n);
  const axis = Math.abs(n.x) > Math.abs(n.y)
    ? (Math.abs(n.x) > Math.abs(n.z) ? "x" : "z")
    : (Math.abs(n.y) > Math.abs(n.z) ? "y" : "z");
  const contour = base.corners.map(p => axis === "x" ? new Vector2(p.y, p.z)
    : axis === "y" ? new Vector2(p.x, p.z) : new Vector2(p.x, p.y));
  const triangles = ShapeUtils.triangulateShape(contour, []).map(
    indices => indices.map(i => base.corners[i]!) as unknown as Triangle,
  );
  return { ...base, triangles, displayUnit: "mm" };
}

/** A geometry controls placement only. All displayed data is joined by measurement ID. */
export function modelFromModel3d(
  model3d: Model3dData, measurement: ViewerMeasurement, derived: DerivedMeasurement,
): ViewerModel {
  const faces = indexed(measurement.faces);
  const measuredOpenings = indexed(measurement.openings);
  const measuredEdges = indexed(measurement.edges);
  const measuredAttachments = indexed(measurement.attachments);
  const measuredConditions = indexed(measurement.condition_areas);
  const downspouts = indexed((measurement as ViewerMeasurement & {
    downspouts?: { id?: string; elevation?: string; length_mm?: unknown }[];
  }).downspouts);
  const walls: ModelWall[] = [], roofFaces: ModelRoofFace[] = [];
  const openings: ModelOpening[] = [], edges: ModelEdge[] = [];
  const attachments: ModelAttachment[] = [], conditions: ModelConditionArea[] = [];
  const massing: ModelPolygon[] = [];
  const byId = new Map<string, ModelPolygon[]>();
  const remember = <T extends ModelPolygon>(p: T): T => { byId.set(p.id, [...(byId.get(p.id) ?? []), p]); return p; };
  for (const row of model3d.flaechen) {
    const id = text(row.id_1_7) ?? "";
    const face = faces.get(id);
    const p = remember(geometricPolygon(id, points(row.ecken), colorFor(face), face?.elevation ?? null));
    if (face?.face_class === "wall" || row.art === "wand") {
      walls.push({ ...p, faceClass: "wall", widthMm: number(face?.width_mm),
        heightMm: number(face?.height_mm), gableHeightMm: number(face?.gable_height_mm),
        areaMm2: number(face?.area_mm2), netAreaMm2: number(face?.net_area_mm2) });
    } else if (face?.face_class === "roof_face" || row.art === "dach") {
      roofFaces.push({ ...p, faceClass: "roof_face", areaMm2: number(face?.area_mm2),
        pitchRiseOver12: number(face?.pitch?.rise_over_12_snapped) });
    } else {
      attachments.push({ ...p, type: face?.face_class ?? "unclassified", widthMm: number(face?.width_mm),
        heightMm: number(face?.height_mm), depthMm: null, parentFaceId: null });
    }
  }
  for (const row of model3d.oeffnungen) {
    const id = text(row.id_1_7) ?? "", measured = measuredOpenings.get(id);
    const type = measured?.type ?? "unclassified";
    openings.push(remember({ ...geometricPolygon(id, points(row.ecken), openingTypeColor(type),
      measured?.elevation ?? null), type, parentFaceId: measured?.parent_face_id ?? "",
      widthMm: number(measured?.width_mm), heightMm: number(measured?.height_mm),
      areaMm2: number(measured?.area_mm2) }) as ModelOpening);
  }
  for (const row of model3d.anbauten) {
    const id = text(row.id_1_7) ?? "", measured = measuredAttachments.get(id);
    const type = measured?.type ?? "unclassified";
    for (const face of (row.flaechen as unknown[] ?? [])) {
      const p = remember(geometricPolygon(id, points(face), attachmentColor(type), measured?.elevation ?? null));
      attachments.push({ ...p, type, parentFaceId: measured?.parent_face_id ?? null,
        widthMm: number(measured?.width_mm), heightMm: number(measured?.height_mm),
        depthMm: number(measured?.depth_mm) });
    }
  }
  for (const [index, row] of model3d.deko.entries()) {
    // Decorative metadata and AI colors are not measurement data.
    for (const [part, face] of (row.flaechen as unknown[] ?? []).entries()) {
      massing.push(geometricPolygon(`decoration-${index}-${part}`, points(face), colorFor(null), null));
    }
  }
  const edge = (row: Row, downspout: boolean): ModelEdge => {
    const id = text(row.id_1_7) ?? "";
    const measured = downspout ? downspouts.get(id) : measuredEdges.get(id);
    const a = point(downspout ? row.oben : row.von), b = point(downspout ? row.unten : row.bis);
    const tangent = plus(b, a, -1), len = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
    const normal = { x: 0, y: -1, z: 0 };
    return { id, displayUnit: "mm", corners: [a, b], edgeClass: downspout ? "downspout"
      : measuredEdges.get(id)?.edge_class ?? "unclassified",
      elevation: downspout ? downspouts.get(id)?.elevation ?? null
        : measuredEdges.get(id)?.belongs_to_elevation ?? null,
      lengthMm: number(measured?.length_mm), normal, color: colorFor(null),
      bounds: boundsFor([a, b]),
      frame: { origin: a, tangent: { x: tangent.x / len, y: tangent.y / len, z: tangent.z / len },
        up: { x: 0, y: 0, z: 1 }, normal } };
  };
  edges.push(...model3d.kanten.map(row => edge(row, false)), ...model3d.fallrohre.map(row => edge(row, true)));
  for (const row of model3d.schaeden) {
    const id = text(row.id_1_7) ?? "", measured = measuredConditions.get(id);
    const parentId = measured?.parent_face_id ?? null;
    const parent = byId.get(parentId ?? "")?.[0];
    const raw = points(row.ecken);
    const shape = geometricPolygon(id, raw, colorFor(null), measured?.elevation ?? null);
    const n = parent?.normal ?? shape.normal;
    const lifted = raw.map(p => plus(p, n, 20));
    conditions.push({ ...geometricPolygon(id, lifted, colorFor(null), measured?.elevation ?? null),
      type: measured?.type ?? "unclassified", severity: measured?.severity ?? null,
      photoIndex: number(measured?.photo_index), parentFaceId: parentId,
      areaMm2: number(measured?.area_mm2) });
  }
  const allPoints = [...walls, ...roofFaces, ...openings, ...attachments, ...conditions, ...massing, ...edges]
    .flatMap(p => [...p.corners]);
  const overall = boundsFor(allPoints);
  const main = boundsFor([...walls, ...roofFaces].flatMap(p => [...p.corners]));
  const frontEave = edges.filter(e => e.edgeClass === "eave" && e.elevation === "front")
    .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
  // A's documented origin is the main body's front-left corner at grade,
  // not the bounding-box minimum (roof overhangs can have negative x/y).
  const origin = { x: 0, y: 0, z: 0 };
  const length = number(derived.footprint.length_mm), depth = number(derived.footprint.depth_mm);
  const eave = number(derived.footprint.eave_height_mm);
  const footprintPoints = measurement.building?.footprint?.points ?? [];
  const frontWidth = number(measurement.building?.footprint?.width_mm) ?? length;
  const frontDepth = number(measurement.building?.footprint?.depth_mm) ?? depth;
  const frontCorners = footprintPoints.filter(p => p[1] === Math.min(...footprintPoints.map(p => p[1]!)));
  const lengthValue = frontWidth ?? (frontCorners.length > 1
    ? Math.max(...frontCorners.map(p => p[0]!)) - Math.min(...frontCorners.map(p => p[0]!)) : null);
  return {
    walls, roofFaces, roofs: roofFaces, openings, edges, attachments, conditions, massing,
    bounds: { main, overall, widthMm: main.widthMm, depthMm: main.depthMm, heightMm: main.heightMm,
      overallWidthMm: overall.widthMm, overallDepthMm: overall.depthMm },
    permanentDimensions: {
      length: lengthValue === null ? null : makeDimension("length", lengthValue, [{
        start: frontEave?.corners[0] ?? origin,
        end: frontEave?.corners[1] ?? { ...origin, x: main.max.x },
      }]),
      depth: frontDepth === null ? null : makeDimension("depth", frontDepth, [{
        start: origin, end: { ...origin, y: Math.max(0, ...walls.flatMap(w => w.corners.map(p => p.y))) },
      }]),
      eaveHeight: eave === null ? null : makeDimension("eave_height", eave, [{
        start: origin, end: { ...origin, z: frontEave?.corners[0].z ?? main.max.z },
      }]),
    },
    diagnostics: [], notes: [],
  };
}
