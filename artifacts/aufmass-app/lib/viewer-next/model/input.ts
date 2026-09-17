/**
 * A permissive structural input type is intentional here.  The model is the
 * display boundary and must survive older v1.5 exports and partial runs.  The
 * application validates canonical v1.6 input before it reaches this module.
 */

export interface MeasurementValueLike {
  readonly value?: number | null;
  readonly confidence?: string | null;
  readonly source?: string | null;
}

export interface MeasurementColorLike {
  readonly hex?: string | null;
  readonly secondary_hex?: string | null;
  readonly confidence?: string | null;
}

export interface MeasurementFaceLike {
  readonly id?: string;
  readonly face_class?: string;
  readonly elevation?: string | null;
  readonly area_mm2?: MeasurementValueLike | null;
  readonly net_area_mm2?: MeasurementValueLike | null;
  readonly width_mm?: MeasurementValueLike | null;
  readonly height_mm?: MeasurementValueLike | null;
  readonly gable_height_mm?: MeasurementValueLike | null;
  readonly pitch?: {
    readonly rise_over_12_snapped?: number | null;
    readonly degrees_original?: number | null;
  } | null;
  readonly color?: MeasurementColorLike | null;
  readonly soffit_depth_mm?: MeasurementValueLike | null;
}

export interface MeasurementEdgeLike {
  readonly id?: string;
  readonly edge_class?: string;
  readonly belongs_to_elevation?: string | null;
  readonly length_mm?: MeasurementValueLike | null;
}

export interface MeasurementOpeningLike {
  readonly id?: string;
  readonly type?: string;
  readonly elevation?: string | null;
  readonly parent_face_id?: string | null;
  readonly width_mm?: MeasurementValueLike | null;
  readonly height_mm?: MeasurementValueLike | null;
  readonly sill_height_mm?: MeasurementValueLike | null;
  readonly position_mm?: { readonly x?: number; readonly y?: number } | null;
  readonly area_mm2?: MeasurementValueLike | null;
}

export interface MeasurementAttachmentLike {
  readonly id?: string;
  readonly type?: string;
  readonly elevation?: string | null;
  readonly width_mm?: MeasurementValueLike | null;
  readonly height_mm?: MeasurementValueLike | null;
  readonly depth_mm?: MeasurementValueLike | null;
  readonly position_mm?: { readonly x?: number; readonly y?: number } | null;
  readonly parent_face_id?: string | null;
  readonly attached?: boolean | null;
  readonly include_in_footprint?: boolean | null;
}

export interface MeasurementConditionLike {
  readonly id?: string;
  readonly type?: string;
  readonly elevation?: string | null;
  readonly severity?: string | null;
  readonly parent_face_id?: string | null;
  readonly position_mm?: { readonly x?: number; readonly y?: number } | null;
  readonly area_mm2?: MeasurementValueLike | number | null;
}

export interface MeasurementFootprintLike {
  readonly points?: readonly (readonly number[])[];
  readonly width_mm?: MeasurementValueLike | null;
  readonly depth_mm?: MeasurementValueLike | null;
}

export interface ViewerMeasurement {
  readonly meta?: {
    readonly schema_version?: string;
  } | null;
  readonly building?: {
    readonly roof_type?: string | null;
    readonly footprint?: MeasurementFootprintLike | null;
    readonly footprint_overall?: MeasurementFootprintLike | null;
    readonly heights?: {
      readonly eave_height_mm?: MeasurementValueLike | null;
      readonly ridge_height_mm?: MeasurementValueLike | null;
    } | null;
  } | null;
  readonly faces?: readonly MeasurementFaceLike[] | null;
  readonly edges?: readonly MeasurementEdgeLike[] | null;
  readonly openings?: readonly MeasurementOpeningLike[] | null;
  readonly attachments?: readonly MeasurementAttachmentLike[] | null;
  readonly condition_areas?: readonly MeasurementConditionLike[] | null;
}
