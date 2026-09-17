/**
 * The viewer model is deliberately made of plain data.  Nothing in this
 * module knows about Three.js, the DOM, or a particular painter.
 */

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Frame3 {
  readonly origin: Point3;
  readonly tangent: Vector3;
  readonly up: Vector3;
  readonly normal: Vector3;
}

export interface Bounds3 {
  readonly min: Point3;
  readonly max: Point3;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

export interface ModelColor {
  readonly hex: string;
  readonly secondaryHex: string | null;
  readonly confidence: string | null;
  readonly neutral: boolean;
}

export type Triangle = readonly [Point3, Point3, Point3];

export interface ModelSegment {
  readonly id: string;
  readonly start: Point3;
  readonly end: Point3;
}

export interface ModelPolygon {
  readonly id: string;
  readonly corners: readonly Point3[];
  readonly triangles: readonly Triangle[];
  readonly normal: Vector3;
  readonly frame: Frame3;
  readonly bounds: Bounds3;
  readonly color: ModelColor;
  readonly elevation: string | null;
}

export interface ModelWall extends ModelPolygon {
  readonly faceClass: "wall";
  readonly widthMm: number;
  readonly heightMm: number;
  readonly gableHeightMm: number;
  readonly areaMm2: number | null;
  readonly netAreaMm2: number | null;
}

export interface ModelRoofFace extends ModelPolygon {
  readonly faceClass: "roof_face";
  readonly pitchRiseOver12: number | null;
  readonly areaMm2: number | null;
}

export interface ModelEdge {
  readonly id: string;
  readonly edgeClass: string;
  readonly elevation: string | null;
  readonly corners: readonly [Point3, Point3];
  readonly lengthMm: number;
  readonly normal: Vector3;
  readonly frame: Frame3;
  readonly bounds: Bounds3;
  readonly color: ModelColor;
}

export interface ModelOpening extends ModelPolygon {
  readonly type: string;
  readonly parentFaceId: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly areaMm2: number | null;
}

export interface ModelAttachment extends ModelPolygon {
  readonly type: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly depthMm: number;
  readonly parentFaceId: string | null;
  /** Physical box edges; unlike polygon corners these never imply diagonals. */
  readonly segments?: readonly ModelSegment[];
}

export interface ModelConditionArea extends ModelPolygon {
  readonly type: string;
  readonly severity: string | null;
  readonly parentFaceId: string | null;
  readonly areaMm2: number | null;
}

export interface DimensionSegment {
  readonly start: Point3;
  readonly end: Point3;
}

export interface PermanentDimension {
  readonly kind: "width" | "ridge" | "eave_height";
  readonly valueMm: number;
  readonly label: string;
  readonly segments: readonly DimensionSegment[];
}

export interface ModelDimensions {
  readonly width: PermanentDimension;
  readonly ridge: PermanentDimension;
  /** Aggregate source total for the panel; it is not a drawable segment. */
  readonly ridgeAggregate: PermanentDimension;
  readonly eaveHeight: PermanentDimension;
}

export type ModelDiagnosticCategory =
  | "compatibility"
  | "inference"
  | "omission"
  | "ambiguity"
  | "unsupported"
  | "envelope"
  | "model_failure"
  | "general";

export interface ModelDiagnostic {
  readonly code: string;
  readonly category: ModelDiagnosticCategory;
  readonly ids: readonly string[];
}

export interface ViewerModel {
  readonly walls: readonly ModelWall[];
  readonly roofFaces: readonly ModelRoofFace[];
  /** Alias kept explicit for painters that use the shorter roof vocabulary. */
  readonly roofs: readonly ModelRoofFace[];
  readonly edges: readonly ModelEdge[];
  readonly openings: readonly ModelOpening[];
  readonly attachments: readonly ModelAttachment[];
  readonly conditions: readonly ModelConditionArea[];
  readonly massing: readonly ModelPolygon[];
  readonly bounds: {
    readonly main: Bounds3;
    readonly overall: Bounds3;
    /** Main footprint convenience values; attached volumes stay in overall. */
    readonly widthMm: number;
    readonly depthMm: number;
    readonly heightMm: number;
    readonly overallWidthMm: number;
    readonly overallDepthMm: number;
  };
  readonly permanentDimensions: ModelDimensions;
  /** Stable, non-localized categories for a renderer/UI warning layer. */
  readonly diagnostics: readonly ModelDiagnostic[];
  readonly notes: readonly string[];
}
