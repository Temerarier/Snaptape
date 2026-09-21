import { computeDerived } from "@workspace/measurement";
import type {
  DerivedMeasurement,
  MeasurementInput,
} from "@workspace/measurement";
import type {
  MinimalMeasurement,
  ViewerCard,
} from "@/lib/viewer-next/viewerCards";
import { buildCards } from "@/lib/viewer-next/viewerCards";
import type { Dictionary } from "@/i18n";

type PreparedProjectMeasurement =
  | {
      kind: "viewer";
      measurement: MinimalMeasurement;
      derived: DerivedMeasurement;
      cards: ViewerCard[];
    }
  | { kind: "older-version" }
  | { kind: "unreadable" };

type UnknownRecord = Record<string, unknown>;
type CollectionName =
  | "faces"
  | "openings"
  | "edges"
  | "attachments"
  | "condition_areas"
  | "downspouts";
type CollectionCompleteness = Record<
  CollectionName,
  "complete" | "unknown"
>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordsWithIdentity(
  value: unknown,
  required: readonly string[],
  noteOmission: () => void,
): UnknownRecord[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    noteOmission();
    return [];
  }

  const seen = new Set<string>();
  return value.filter((item): item is UnknownRecord => {
    if (!isRecord(item)) {
      noteOmission();
      return false;
    }
    if (
      required.some(
        (field) => typeof item[field] !== "string" || item[field] === "",
      )
    ) {
      noteOmission();
      return false;
    }
    const id = item.id as string;
    if (seen.has(id)) {
      noteOmission();
      return false;
    }
    seen.add(id);
    return true;
  });
}

function collectionCompleteness(
  source: unknown,
  retainedCount: number,
): "complete" | "unknown" {
  return Array.isArray(source) && retainedCount === source.length
    ? "complete"
    : "unknown";
}

function optionalRecord(
  value: unknown,
  noteOmission: () => void,
): UnknownRecord | undefined {
  if (value === undefined || value === null) return undefined;
  if (isRecord(value)) return value;
  noteOmission();
  return undefined;
}

function optionalValue(
  value: unknown,
  noteOmission: () => void,
): unknown {
  return value === null ? null : optionalRecord(value, noteOmission);
}

function sanitizePoints(
  value: unknown,
  noteOmission: () => void,
): readonly (readonly number[])[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    noteOmission();
    return undefined;
  }
  return value.filter((point): point is number[] => {
    const valid =
      Array.isArray(point) &&
      point.length >= 2 &&
      point.every((coordinate) => Number.isFinite(coordinate));
    if (!valid) noteOmission();
    return valid;
  });
}

function sanitizeFootprint(
  value: unknown,
  noteOmission: () => void,
): UnknownRecord | undefined {
  const footprint = optionalRecord(value, noteOmission);
  if (!footprint) return undefined;
  return {
    ...footprint,
    points: sanitizePoints(footprint.points, noteOmission),
    width_mm: optionalValue(footprint.width_mm, noteOmission),
    depth_mm: optionalValue(footprint.depth_mm, noteOmission),
  };
}

function sanitizeBuilding(
  value: unknown,
  noteOmission: () => void,
): UnknownRecord | undefined {
  const building = optionalRecord(value, noteOmission);
  if (!building) return undefined;
  const heights = optionalRecord(building.heights, noteOmission);
  return {
    ...building,
    footprint: sanitizeFootprint(building.footprint, noteOmission),
    footprint_overall: sanitizeFootprint(
      building.footprint_overall,
      noteOmission,
    ),
    heights: heights
      ? {
          ...heights,
          eave_height_mm: optionalValue(
            heights.eave_height_mm,
            noteOmission,
          ),
          ridge_height_mm: optionalValue(
            heights.ridge_height_mm,
            noteOmission,
          ),
          parapet_height_mm: optionalValue(
            heights.parapet_height_mm,
            noteOmission,
          ),
        }
      : undefined,
  };
}

function sanitizePartValues(
  part: UnknownRecord,
  fields: readonly string[],
  noteOmission: () => void,
): UnknownRecord {
  return Object.fromEntries([
    ...Object.entries(part),
    ...fields.map((field) => [
      field,
      optionalValue(part[field], noteOmission),
    ]),
  ]);
}

function sanitizeNestedRecords(
  part: UnknownRecord,
  fields: readonly string[],
  noteOmission: () => void,
): UnknownRecord {
  return Object.fromEntries([
    ...Object.entries(part),
    ...fields.map((field) => [
      field,
      part[field] === null
        ? null
        : optionalRecord(part[field], noteOmission),
    ]),
  ]);
}

/**
 * Makes the collection fields consumed by computeDerived total without
 * changing the stored object or inventing dimensional values. Invalid,
 * unidentifiable parts are omitted; missing quantities remain missing and are
 * displayed as unknown by the viewer.
 */
function normalizeV16Measurement(
  measurement: UnknownRecord,
  omittedWarning: string,
): UnknownRecord {
  let omitted = false;
  const noteOmission = () => {
    omitted = true;
  };
  const faces = recordsWithIdentity(
    measurement.faces,
    ["id", "face_class"],
    noteOmission,
  ).map((part) =>
    sanitizeNestedRecords(
      sanitizePartValues(
        part,
        [
          "area_mm2",
          "net_area_mm2",
          "width_mm",
          "height_mm",
          "gable_height_mm",
          "soffit_depth_mm",
        ],
        noteOmission,
      ),
      ["pitch", "color"],
      noteOmission,
    ),
  );
  const openings = recordsWithIdentity(
    measurement.openings,
    ["id", "type"],
    noteOmission,
  ).map((part) =>
    sanitizeNestedRecords(
      sanitizePartValues(
        part,
        ["width_mm", "height_mm", "sill_height_mm", "area_mm2"],
        noteOmission,
      ),
      ["position_mm"],
      noteOmission,
    ),
  );
  const edges = recordsWithIdentity(
    measurement.edges,
    ["id", "edge_class"],
    noteOmission,
  ).map((part) =>
    sanitizePartValues(part, ["length_mm"], noteOmission),
  );
  const attachments = recordsWithIdentity(
    measurement.attachments,
    ["id", "type"],
    noteOmission,
  ).map((part) =>
    sanitizeNestedRecords(
      sanitizePartValues(
        part,
        ["width_mm", "height_mm", "depth_mm"],
        noteOmission,
      ),
      ["position_mm"],
      noteOmission,
    ),
  );
  const conditionAreas = recordsWithIdentity(
    measurement.condition_areas,
    ["id", "type"],
    noteOmission,
  ).map((part) => {
    const area = part.area_mm2;
    const validArea =
      area === undefined ||
      area === null ||
      (typeof area === "number" && Number.isFinite(area)) ||
      isRecord(area);
    if (!validArea) noteOmission();
    return sanitizeNestedRecords(
      {
        ...part,
        area_mm2: validArea ? area : undefined,
      },
      ["position_mm"],
      noteOmission,
    );
  });
  const downspouts = recordsWithIdentity(
    measurement.downspouts,
    ["id"],
    noteOmission,
  ).map((part) =>
    sanitizePartValues(part, ["length_mm"], noteOmission),
  );
  const quality = optionalRecord(measurement.quality, noteOmission);
  const sourceWarnings = quality?.warnings;
  const warnings =
    sourceWarnings === undefined || sourceWarnings === null
      ? []
      : Array.isArray(sourceWarnings)
        ? sourceWarnings.filter((warning) => {
            const valid = typeof warning === "string";
            if (!valid) noteOmission();
            return valid;
          })
        : (noteOmission(), []);
  const references =
    measurement.references === undefined || measurement.references === null
      ? []
      : Array.isArray(measurement.references)
        ? measurement.references.filter((reference) => {
            const valid = isRecord(reference);
            if (!valid) noteOmission();
            return valid;
          })
        : (noteOmission(), []);
  const completeness: CollectionCompleteness = {
    faces: collectionCompleteness(measurement.faces, faces.length),
    openings: collectionCompleteness(measurement.openings, openings.length),
    edges: collectionCompleteness(measurement.edges, edges.length),
    attachments: collectionCompleteness(
      measurement.attachments,
      attachments.length,
    ),
    condition_areas: collectionCompleteness(
      measurement.condition_areas,
      conditionAreas.length,
    ),
    downspouts: collectionCompleteness(
      measurement.downspouts,
      downspouts.length,
    ),
  };

  return {
    ...measurement,
    building: sanitizeBuilding(measurement.building, noteOmission),
    faces,
    openings,
    edges,
    attachments,
    condition_areas: conditionAreas,
    downspouts,
    references,
    quality: {
      ...(quality ?? {}),
      warnings: omitted
        ? Array.from(new Set([...warnings, omittedWarning]))
        : warnings,
    },
    __viewerCollectionCompleteness: completeness,
  };
}

type MutableDerivedValue = {
  value: number | null;
  complete: boolean;
  confidence: "low" | "medium" | "high";
  missingInputs: readonly string[];
};

function markUnknown(value: MutableDerivedValue, input: string): void {
  value.value = null;
  value.complete = false;
  value.confidence = "low";
  value.missingInputs = Array.from(new Set([...value.missingInputs, input]));
}

/**
 * computeDerived consumes safe arrays, but an empty safe array is not evidence
 * that the source collection was explicitly empty. Invalidate every aggregate
 * that relies on an absent/malformed/partially omitted collection while
 * retaining derived rows for the valid siblings that survived preparation.
 */
function applyCollectionCompleteness(
  derived: DerivedMeasurement,
  completeness: CollectionCompleteness,
): void {
  if (completeness.faces === "unknown") {
    markUnknown(derived.roof.area_mm2, "faces");
    markUnknown(derived.roof.squares, "faces");
    markUnknown(derived.roof.facet_count, "faces");
    markUnknown(derived.walls.gross_area_mm2, "faces");
    markUnknown(derived.walls.deducted_area_mm2, "faces");
    markUnknown(derived.walls.net_area_mm2, "faces");
    markUnknown(derived.walls.gable_area_mm2, "faces");
    markUnknown(derived.trim.fascia_area_mm2, "faces");
    markUnknown(derived.trim.soffit_area_mm2, "faces");
  }
  if (completeness.openings === "unknown") {
    markUnknown(derived.openings.total, "openings");
    Object.values(derived.openings.byType).forEach((value) =>
      markUnknown(value, "openings"),
    );
    markUnknown(derived.openings.aggregate.count, "openings");
    markUnknown(derived.openings.aggregate.area_mm2, "openings");
    markUnknown(derived.openings.aggregate.perimeter.tops_mm, "openings");
    markUnknown(derived.openings.aggregate.perimeter.sills_mm, "openings");
    markUnknown(derived.openings.aggregate.perimeter.sides_mm, "openings");
    markUnknown(derived.openings.aggregate.perimeter.total_mm, "openings");
    Object.values(derived.openings.byTypeAggregate).forEach((aggregate) => {
      markUnknown(aggregate.count, "openings");
      markUnknown(aggregate.area_mm2, "openings");
      markUnknown(aggregate.perimeter.tops_mm, "openings");
      markUnknown(aggregate.perimeter.sills_mm, "openings");
      markUnknown(aggregate.perimeter.sides_mm, "openings");
      markUnknown(aggregate.perimeter.total_mm, "openings");
    });
    Object.values(derived.openings.byWall).forEach((counts) => {
      markUnknown(counts.total, "openings");
      Object.values(counts.byType).forEach((value) =>
        markUnknown(value, "openings"),
      );
    });
    derived.openings.parentGroups.forEach((aggregate) => {
      markUnknown(aggregate.count, "openings");
      markUnknown(aggregate.area_mm2, "openings");
      markUnknown(aggregate.perimeter.tops_mm, "openings");
      markUnknown(aggregate.perimeter.sills_mm, "openings");
      markUnknown(aggregate.perimeter.sides_mm, "openings");
      markUnknown(aggregate.perimeter.total_mm, "openings");
    });
    markUnknown(derived.openings.perimeter.tops_mm, "openings");
    markUnknown(derived.openings.perimeter.sills_mm, "openings");
    markUnknown(derived.openings.perimeter.sides_mm, "openings");
    markUnknown(derived.openings.perimeter.total_mm, "openings");
    markUnknown(derived.openings.united_mm, "openings");
    markUnknown(derived.openings.united_inches, "openings");
    markUnknown(derived.j_channel_estimate_mm, "openings");
    for (const wall of derived.walls.faces) {
      markUnknown(wall.deducted_area_mm2, "openings");
      markUnknown(wall.net_area_mm2, "openings");
    }
    markUnknown(derived.walls.deducted_area_mm2, "openings");
    markUnknown(derived.walls.net_area_mm2, "openings");
  }
  if (completeness.edges === "unknown") {
    Object.values(derived.edges.byClass).forEach((value) =>
      markUnknown(value, "edges"),
    );
    markUnknown(derived.edges.drip_edge_mm, "edges");
    markUnknown(derived.corners.inside_mm, "edges");
    markUnknown(derived.corners.outside_mm, "edges");
    markUnknown(derived.corners.total_mm, "edges");
    markUnknown(derived.starter_base_mm, "edges");
    markUnknown(derived.gutters.total_mm, "edges");
  }
  if (completeness.downspouts === "unknown") {
    markUnknown(derived.downspouts.count, "downspouts");
    markUnknown(derived.downspouts.total_mm, "downspouts");
  }
}

export function prepareProjectMeasurement(
  rawMeasurement: unknown,
  dict: Dictionary["viewerNext"],
): PreparedProjectMeasurement {
  if (!isRecord(rawMeasurement)) {
    return { kind: "unreadable" };
  }

  if (
    !isRecord(rawMeasurement.meta) ||
    rawMeasurement.meta.schema_version !== "1.6"
  ) {
    return { kind: "older-version" };
  }

  try {
    const normalized = normalizeV16Measurement(
      rawMeasurement,
      dict.labels.omittedElements,
    );
    const measurement = normalized as unknown as MeasurementInput &
      MinimalMeasurement;
    const derived = computeDerived(measurement);
    applyCollectionCompleteness(
      derived,
      normalized.__viewerCollectionCompleteness as CollectionCompleteness,
    );
    const cards = buildCards(derived, measurement, dict);
    return { kind: "viewer", measurement, derived, cards };
  } catch {
    return { kind: "unreadable" };
  }
}
