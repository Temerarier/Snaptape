import type { ModelEdge, ModelOpening, ModelPolygon, ModelRoofFace, ModelWall, Point3, ViewerModel } from "./types";
import { viewerTokens } from "../tokens";

const SVG_WIDTH = 900;
const SVG_HEIGHT = 560;
const MARGIN = 48;
const NEUTRAL_STROKE = viewerTokens.modelOutline;

interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
}

interface ElevationShape {
  readonly id: string;
  readonly type: "wall" | "roof" | "opening" | "attachment" | "condition" | "massing";
  readonly polygon?: ModelPolygon;
  readonly edge?: ModelEdge;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function project(point: Point3, side: boolean): ProjectedPoint {
  return {
    x: side ? point.y : point.x,
    // SVG's transform below maps larger source y toward the top of the
    // viewport.  Keep model z positive here; negating it would invert the
    // elevation a second time.
    y: point.z,
  };
}

function distance(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function polygonPoints(polygon: ModelPolygon, side: boolean): ProjectedPoint[] {
  return polygon.corners.map(point => project(point, side));
}

function allProjected(shapes: readonly ElevationShape[], side: boolean): ProjectedPoint[] {
  return shapes.flatMap(shape => {
    if (shape.polygon) return polygonPoints(shape.polygon, side);
    if (shape.edge) return shape.edge.corners.map(point => project(point, side));
    return [];
  });
}

function scaleElevation(
  points: readonly ProjectedPoint[],
  column: "front" | "side",
): (point: ProjectedPoint) => ProjectedPoint {
  const minX = Math.min(...points.map(point => point.x), 0);
  const maxX = Math.max(...points.map(point => point.x), 1);
  const minY = Math.min(...points.map(point => point.y), -1);
  const maxY = Math.max(...points.map(point => point.y), 0);
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);
  const columnWidth = SVG_WIDTH / 2;
  const scale = Math.min(
    (columnWidth - MARGIN * 2) / rangeX,
    (SVG_HEIGHT - MARGIN * 2) / rangeY,
  );
  const columnOffset = column === "side" ? columnWidth : 0;
  const offsetX = columnOffset + MARGIN + (columnWidth - MARGIN * 2 - rangeX * scale) / 2;
  const offsetY = MARGIN + (SVG_HEIGHT - MARGIN * 2 - rangeY * scale) / 2;
  return point => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (maxY - point.y) * scale,
  });
}

function pointString(points: readonly ProjectedPoint[], transform: (point: ProjectedPoint) => ProjectedPoint): string {
  const unique = points.filter((point, index) =>
    points.findIndex(candidate => Math.abs(candidate.x - point.x) < 0.01 && Math.abs(candidate.y - point.y) < 0.01) === index,
  );
  return unique
    .map(point => {
      const transformed = transform(point);
      return `${transformed.x.toFixed(2)},${transformed.y.toFixed(2)}`;
    })
    .join(" ");
}

function shapeLine(
  shape: ElevationShape,
  transform: (point: ProjectedPoint) => ProjectedPoint,
  side: boolean,
): string {
  if (shape.edge) {
    const points = shape.edge.corners.map(point => transform(project(point, side)));
    return `    <line id="${escapeXml(shape.id)}" data-model-id="${escapeXml(shape.edge.id)}" x1="${points[0].x.toFixed(2)}" y1="${points[0].y.toFixed(2)}" x2="${points[1].x.toFixed(2)}" y2="${points[1].y.toFixed(2)}" stroke="${shape.edge.color.hex}" stroke-width="2" />`;
  }
  const polygon = shape.polygon!;
  const projected = polygonPoints(polygon, side);
  const fill = shape.type === "opening"
    ? polygon.color.hex
    : shape.type === "condition"
      ? polygon.color.hex
      : "none";
  const opacity = shape.type === "opening" || shape.type === "condition" ? "0.65" : "1";
  const stroke = shape.type === "opening" ? viewerTokens.textPrimary : polygon.color.hex || NEUTRAL_STROKE;
  return `    <polygon id="${escapeXml(shape.id)}" data-model-id="${escapeXml(polygon.id)}" data-parent-face-id="${escapeXml("parentFaceId" in polygon && typeof polygon.parentFaceId === "string" ? polygon.parentFaceId : "")}" points="${pointString(projected, transform)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${shape.type === "opening" ? "1.5" : "2"}"><title>${escapeXml(polygon.id)}</title></polygon>`;
}

function elevationShapes(model: ViewerModel, side: boolean): ElevationShape[] {
  const walls = side
    ? model.walls.filter(wall => wall.elevation === "right")
    : model.walls.filter(wall => wall.elevation === "front");
  const wallIds = new Set(walls.map(wall => wall.id));
  const roofs = side
    ? model.roofFaces
    : model.roofFaces.filter(roof => roof.elevation === "front" || roof.elevation === "roof");
  const openings = model.openings.filter(opening => wallIds.has(opening.parentFaceId) || (!side && opening.type === "skylight"));
  const attachments = model.attachments.filter(attachment =>
    side ? attachment.elevation === "right" : attachment.elevation === "front",
  );
  const conditions = model.conditions.filter(condition => wallIds.has(condition.parentFaceId ?? ""));
  const edges = model.edges.filter(edge =>
    side ? edge.elevation === "right" : edge.elevation === "front",
  );
  return [
    ...roofs.map((polygon): ElevationShape => ({ id: `${side ? "side" : "front"}-${polygon.id}`, type: "roof", polygon })),
    ...walls.map((polygon): ElevationShape => ({ id: `${side ? "side" : "front"}-${polygon.id}`, type: "wall", polygon })),
    ...openings.map((polygon): ElevationShape => ({ id: `${side ? "side" : "front"}-${polygon.id}`, type: "opening", polygon })),
    ...attachments.map((polygon): ElevationShape => ({ id: `${side ? "side" : "front"}-${polygon.id}`, type: "attachment", polygon })),
    ...conditions.map((polygon): ElevationShape => ({ id: `${side ? "side" : "front"}-${polygon.id}`, type: "condition", polygon })),
    ...edges.map(edge => ({ id: `${side ? "side" : "front"}-${edge.id}`, type: "massing" as const, edge })),
  ];
}

function elevationGroup(model: ViewerModel, side: boolean): string[] {
  const shapes = elevationShapes(model, side);
  const projected = allProjected(shapes, side);
  const transform = scaleElevation(projected, side ? "side" : "front");
  const title = side ? "Side elevation (right/left)" : "Front elevation";
  const lines = [
    `  <g id="${side ? "side" : "front"}-elevation" data-elevation="${side ? "side" : "front"}">`,
    `    <title>${title}</title>`,
  ];
  for (const shape of shapes) lines.push(shapeLine(shape, transform, side));
  lines.push("  </g>");
  return lines;
}

/**
 * Text-only diagnostic projection.  It intentionally does not share any
 * renderer or projection dependency with the viewport.
 */
export function renderDebugSvg(model: ViewerModel): string {
  const maxX = Math.max(model.bounds.overall.widthMm, 1);
  const maxZ = Math.max(model.bounds.overall.heightMm, 1);
  const dimensionPoint = (point: Point3): ProjectedPoint => ({
    x: MARGIN + (point.x / maxX) * (SVG_WIDTH / 2 - MARGIN * 2),
    y: SVG_HEIGHT - MARGIN - (point.z / maxZ) * (SVG_HEIGHT - MARGIN * 2),
  });
  const dimensionLine = (kind: string, segment: { start: Point3; end: Point3 }): string => {
    const start = dimensionPoint(segment.start);
    const end = dimensionPoint(segment.end);
    return `    <line data-dimension="${kind}" data-value-mm="${distance(segment.start, segment.end).toFixed(2)}" x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" />`;
  };
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" role="img" aria-label="Viewer model debug elevations">`,
    `  <style>polygon { vector-effect: non-scaling-stroke; } .dimension { stroke: ${viewerTokens.dimensionLine}; stroke-dasharray: 5 4; }</style>`,
    ...elevationGroup(model, false),
    ...elevationGroup(model, true),
    "  <g id=\"permanent-dimensions\" class=\"dimension\">",
    ...model.permanentDimensions.width.segments.map(segment => dimensionLine("width", segment)),
    ...model.permanentDimensions.ridge.segments.map(segment => dimensionLine("ridge", segment)),
    ...model.permanentDimensions.eaveHeight.segments.map(segment => dimensionLine("eave-height", segment)),
    `    <text data-dimension-label="width">${escapeXml(model.permanentDimensions.width.label)}</text>`,
    `    <text data-dimension-label="ridge">${escapeXml(model.permanentDimensions.ridge.label)}</text>`,
    `    <text data-dimension-label="ridge-aggregate">${escapeXml(model.permanentDimensions.ridgeAggregate.label)}</text>`,
    `    <text data-dimension-label="eave-height">${escapeXml(model.permanentDimensions.eaveHeight.label)}</text>`,
    "  </g>",
    "</svg>",
  ].join("\n");
}

export type { ModelOpening, ModelRoofFace, ModelWall };
