/** Structural, readonly subset of v1.6 consumed by display calculations.
 * This is not a second validator; validate incoming JSON at the application boundary.
 */
export interface MeasurementValue {
  readonly value: number | null;
  readonly confidence?: string | null;
}

export interface MeasurementFace {
  readonly id: string;
  readonly face_class: string;
  readonly elevation?: string | null;
  readonly area_mm2?: MeasurementValue | null;
  readonly width_mm?: MeasurementValue | null;
  readonly height_mm?: MeasurementValue | null;
  /** Explicit null means no gable; omitted means not supplied. */
  readonly gable_height_mm?: MeasurementValue | null;
}

export interface MeasurementOpening {
  readonly id: string;
  readonly type: string;
  readonly elevation?: string | null;
  readonly parent_face_id?: string | null;
  readonly width_mm?: MeasurementValue | null;
  readonly height_mm?: MeasurementValue | null;
}

export interface MeasurementEdge {
  readonly id: string;
  readonly edge_class: string;
  readonly belongs_to_elevation?: string | null;
  readonly length_mm?: MeasurementValue | null;
}

export interface MeasurementInput {
  readonly faces: readonly MeasurementFace[];
  readonly openings: readonly MeasurementOpening[];
  readonly edges: readonly MeasurementEdge[];
  readonly building?: { readonly roof_type?: string };
  readonly downspouts?: readonly {
    readonly id: string;
    readonly elevation?: string | null;
    readonly length_mm?: MeasurementValue | null;
  }[] | null;
}

export type Confidence = "low" | "medium" | "high";
export type DerivedUnit = "mm" | "mm2" | "in" | "SQ" | "count" | "ratio";

/** Null/incomplete is never a disguised partial sum. sourceIds lists contributing
 * records; missingInputs names unavailable fields. Empty, explicitly supplied
 * collections produce exact zero/high-confidence aggregates. Counts describe
 * stored records, not certainty that extraction found every real-world object.
 */
export interface DerivedValue<U extends DerivedUnit = DerivedUnit> {
  readonly value: number | null;
  readonly unit: U;
  readonly confidence: Confidence;
  readonly complete: boolean;
  readonly sourceIds: readonly string[];
  readonly missingInputs: readonly string[];
}

export interface PerimeterBreakdown {
  readonly tops_mm: DerivedValue<"mm">;
  /** Geometric bottom width, including door thresholds; not a trim estimate. */
  readonly sills_mm: DerivedValue<"mm">;
  readonly sides_mm: DerivedValue<"mm">;
  readonly total_mm: DerivedValue<"mm">;
}

export interface DerivedOpening {
  readonly id: string;
  readonly type: string;
  readonly elevation: string | null;
  readonly parent_face_id: string | null;
  readonly assignment: "wall" | "non_wall" | "unassigned";
  readonly unassignedReason: "no_parent" | "missing_parent" | null;
  readonly width_mm: DerivedValue<"mm">;
  readonly height_mm: DerivedValue<"mm">;
  readonly area_mm2: DerivedValue<"mm2">;
  readonly perimeter: PerimeterBreakdown;
  /** Width + height in mm, then an exact, unrounded conversion to inches. */
  readonly united_mm: DerivedValue<"mm">;
  readonly united_inches: DerivedValue<"in">;
}

export interface OpeningGroup {
  readonly type: string;
  readonly width_mm: DerivedValue<"mm">;
  readonly height_mm: DerivedValue<"mm">;
  readonly count: DerivedValue<"count">;
  readonly openingIds: readonly string[];
}

export interface OpeningCounts {
  readonly total: DerivedValue<"count">;
  readonly byType: Readonly<Record<string, DerivedValue<"count">>>;
}

export interface DerivedWall {
  readonly id: string;
  readonly elevation: string | null;
  readonly width_mm: DerivedValue<"mm">;
  readonly height_mm: DerivedValue<"mm">;
  readonly gable_height_mm: DerivedValue<"mm"> | null;
  readonly gross_area_mm2: DerivedValue<"mm2">;
  readonly reconstructed_area_mm2: DerivedValue<"mm2">;
  readonly grossAreaBasis: "stored" | "dimensions";
  readonly deductedOpenings: readonly DerivedOpening[];
  readonly deducted_area_mm2: DerivedValue<"mm2">;
  readonly net_area_mm2: DerivedValue<"mm2">;
}

export interface DerivedRun {
  readonly id: string;
  readonly elevation: string | null;
  readonly length_mm: DerivedValue<"mm">;
}

export interface CalculationDiagnostic {
  readonly code: "gross_area_mismatch" | "negative_net_area" | "missing_parent";
  readonly sourceId: string;
  readonly message: string;
}

export interface DerivedMeasurement {
  readonly roof: {
    readonly area_mm2: DerivedValue<"mm2">;
    readonly squares: DerivedValue<"SQ">;
    /** 0.10/simple, 0.15/hips, valleys or multiple ridges. Heuristic, not an order. */
    readonly suggestedWasteFactor: DerivedValue<"ratio">;
  };
  readonly edges: {
    readonly byClass: Readonly<Record<string, DerivedValue<"mm">>>;
    readonly drip_edge_mm: DerivedValue<"mm">;
  };
  readonly walls: {
    readonly faces: readonly DerivedWall[];
    readonly gross_area_mm2: DerivedValue<"mm2">;
    readonly deducted_area_mm2: DerivedValue<"mm2">;
    readonly net_area_mm2: DerivedValue<"mm2">;
  };
  readonly openings: OpeningCounts & {
    readonly items: readonly DerivedOpening[];
    readonly byWall: Readonly<Record<string, OpeningCounts>>;
    readonly identicalGroups: readonly OpeningGroup[];
    /** Unknown sizes are not grouped together as if they were identical. */
    readonly ungroupedIds: readonly string[];
    readonly unassigned: readonly DerivedOpening[];
    readonly nonWall: readonly DerivedOpening[];
    readonly perimeter: PerimeterBreakdown;
    readonly united_mm: DerivedValue<"mm">;
    readonly united_inches: DerivedValue<"in">;
  };
  readonly corners: {
    readonly inside_mm: DerivedValue<"mm">;
    readonly outside_mm: DerivedValue<"mm">;
    readonly total_mm: DerivedValue<"mm">;
  };
  readonly starter_base_mm: DerivedValue<"mm">;
  /** Windows: four sides; doors: top+two sides, including unassigned geometry.
   * Other types are unknown. Excludes known non-wall openings, unassigned
   * skylights and extra trim. Parent assignment affects area deductions only.
   */
  readonly j_channel_estimate_mm: DerivedValue<"mm">;
  readonly gutters: {
    readonly runs: readonly DerivedRun[];
    readonly total_mm: DerivedValue<"mm">;
  };
  readonly downspouts: {
    readonly drops: readonly DerivedRun[];
    readonly count: DerivedValue<"count">;
    readonly total_mm: DerivedValue<"mm">;
  };
  readonly diagnostics: readonly CalculationDiagnostic[];
}