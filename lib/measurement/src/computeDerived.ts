// Pure display calculations. Import this module directly in browser consumers:
// the package's pre-existing validator export is Node-only.
import { mm2ToSquares, mmToInches } from "./formatMeasurement";
import type {
  CalculationDiagnostic, Confidence, DerivedMeasurement, DerivedOpening,
  DerivedUnit, DerivedValue, DerivedWall, MeasurementInput, MeasurementValue,
  OpeningCounts, OpeningGroup, PerimeterBreakdown,
} from "./derivedTypes";

const EDGE_CLASSES = [
  "ridge", "hip", "valley", "eave", "rake", "flashing", "step_flashing",
  "outside_corner", "inside_corner", "base", "head", "sill", "jamb", "unclassified",
];
const OPENING_TYPES = ["window", "door", "patio_door", "garage_door", "skylight", "other"];

function weakest(values: readonly Confidence[]): Confidence {
  return values.includes("low") ? "low" : values.includes("medium") ? "medium" : "high";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function result<U extends DerivedUnit>(
  value: number | null, unit: U, confidence: Confidence,
  sourceIds: readonly string[] = [], missingInputs: readonly string[] = [],
): DerivedValue<U> {
  return { value, unit, confidence, complete: value !== null,
    sourceIds: unique(sourceIds), missingInputs: unique(missingInputs) };
}

function read<U extends DerivedUnit>(
  input: MeasurementValue | null | undefined, unit: U, id: string, field: string,
): DerivedValue<U> {
  if (input?.value == null || !Number.isFinite(input.value) || input.value < 0) {
    return result(null, unit, "low", [id], [`${id}.${field}`]);
  }
  const confidence = input.confidence === "high" || input.confidence === "medium"
    ? input.confidence : "low";
  return result(input.value, unit, confidence, [id]);
}

function calculate<U extends DerivedUnit>(
  unit: U, inputs: readonly DerivedValue[], fn: (values: number[]) => number,
): DerivedValue<U> {
  const ids = inputs.flatMap(q => q.sourceIds);
  const missing = inputs.flatMap(q => q.missingInputs);
  if (inputs.some(q => q.value === null)) return result(null, unit, "low", ids, missing);
  const value = fn(inputs.map(q => q.value!));
  if (!Number.isFinite(value)) return result(null, unit, "low", ids, [...missing, "arithmetic overflow"]);
  return result(value, unit, weakest(inputs.map(q => q.confidence)), ids, missing);
}

function sum<U extends DerivedUnit>(unit: U, inputs: readonly DerivedValue[]): DerivedValue<U> {
  return calculate(unit, inputs, values => values.reduce((a, b) => a + b, 0));
}

function count(ids: readonly string[]): DerivedValue<"count"> {
  // Counting explicit records does not consume their uncertain dimensions.
  return result(ids.length, "count", "high", ids);
}

function counts(items: readonly DerivedOpening[]): OpeningCounts {
  const types = unique([...OPENING_TYPES, ...items.map(o => o.type)]);
  return {
    total: count(items.map(o => o.id)),
    byType: Object.fromEntries(types.map(type => [
      type, count(items.filter(o => o.type === type).map(o => o.id)),
    ])),
  };
}

function perimeter(items: readonly DerivedOpening[]): PerimeterBreakdown {
  return {
    tops_mm: sum("mm", items.map(o => o.perimeter.tops_mm)),
    sills_mm: sum("mm", items.map(o => o.perimeter.sills_mm)),
    sides_mm: sum("mm", items.map(o => o.perimeter.sides_mm)),
    total_mm: sum("mm", items.map(o => o.perimeter.total_mm)),
  };
}

function groupOpenings(items: readonly DerivedOpening[]): OpeningGroup[] {
  const groups = new Map<string, DerivedOpening[]>();
  for (const o of items) {
    if (!o.width_mm.complete || !o.height_mm.complete) continue;
    // group_id represents shared trim, not identical dimensions. No tolerances.
    const key = JSON.stringify([o.type, o.width_mm.value, o.height_mm.value]);
    const group = groups.get(key) ?? [];
    group.push(o);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const widths = group.map(o => o.width_mm);
    const heights = group.map(o => o.height_mm);
    const ids = group.map(o => o.id);
    return {
      type: group[0].type,
      width_mm: calculate("mm", widths, values => values[0]),
      height_mm: calculate("mm", heights, values => values[0]),
      count: result(ids.length, "count", weakest([...widths, ...heights].map(q => q.confidence)), ids),
      openingIds: ids,
    };
  });
}

/**
 * Derive takeoff/display values without mutating the stored measurement.
 * All dimensional arithmetic uses mm/mm², with unrounded convenience conversions.
 * Aggregates with any unknown operand are null (not a partial total).
 * Explicit gable=null means a rectangular wall; omission means unknown geometry.
 * Supplied gross areas win over dimensional reconstruction; stored net areas and
 * opening area/perimeter values are deliberately ignored.
 */
export function computeDerived(measurement: MeasurementInput): DerivedMeasurement {
  const diagnostics: CalculationDiagnostic[] = [];
  const faceMap = new Map(measurement.faces.map(f => [f.id, f]));
  if (faceMap.size !== measurement.faces.length) throw new Error("Duplicate face IDs are ambiguous");
  const openings: DerivedOpening[] = measurement.openings.map(o => {
    const parentId = o.parent_face_id ?? null;
    const parent = parentId === null ? undefined : faceMap.get(parentId);
    const width = read(o.width_mm, "mm", o.id, "width_mm");
    const height = read(o.height_mm, "mm", o.id, "height_mm");
    const sides = calculate("mm", [height], ([h]) => 2 * h);
    const united = sum("mm", [width, height]);
    if (parentId !== null && !parent) diagnostics.push({
      code: "missing_parent", sourceId: o.id,
      message: `${o.id}: parent ${parentId} does not exist; no wall deduction applied.`,
    });
    return {
      id: o.id, type: o.type, elevation: o.elevation ?? null, parent_face_id: parentId,
      assignment: !parent ? "unassigned" : parent.face_class === "wall" ? "wall" : "non_wall",
      unassignedReason: parent ? null : parentId === null ? "no_parent" : "missing_parent",
      width_mm: width, height_mm: height,
      area_mm2: calculate("mm2", [width, height], ([w, h]) => w * h),
      perimeter: { tops_mm: width, sills_mm: width, sides_mm: sides,
        total_mm: sum("mm", [width, width, sides]) },
      united_mm: united,
      united_inches: calculate("in", [united], ([mm]) => mmToInches(mm)),
    };
  });

  const walls: DerivedWall[] = measurement.faces.filter(f => f.face_class === "wall").map(f => {
    const width = read(f.width_mm, "mm", f.id, "width_mm");
    const height = read(f.height_mm, "mm", f.id, "height_mm");
    const gable = f.gable_height_mm === null ? null : read(f.gable_height_mm, "mm", f.id, "gable_height_mm");
    const reconstructed = calculate("mm2", [width, height, gable ?? result(0, "mm", "high", [f.id])],
      ([w, h, g]) => w * h + 0.5 * w * g);
    const stored = read(f.area_mm2, "mm2", f.id, "area_mm2");
    const gross = stored.complete ? stored : reconstructed;
    if (stored.value !== null && reconstructed.value !== null &&
        Math.abs(stored.value - reconstructed.value) > 0.03 * Math.abs(stored.value)) {
      diagnostics.push({ code: "gross_area_mismatch", sourceId: f.id,
        message: `${f.id}: supplied gross area ${stored.value} mm2 differs from dimensional reconstruction ${reconstructed.value} mm2 by more than 3%; supplied area retained.` });
    }
    // Never use elevation. Both a main wall and a garage wall can be "front".
    const assigned = openings.filter(o => o.assignment === "wall" && o.parent_face_id === f.id);
    const deducted = sum("mm2", assigned.map(o => o.area_mm2));
    let net = calculate("mm2", [gross, deducted], ([g, d]) => g - d);
    if (net.value !== null && net.value < 0) {
      diagnostics.push({ code: "negative_net_area", sourceId: f.id,
        message: `${f.id}: assigned opening area exceeds gross wall area; net area unavailable.` });
      net = result(null, "mm2", "low", net.sourceIds, [`${f.id}.negative_net_area`]);
    }
    return { id: f.id, elevation: f.elevation ?? null,
      width_mm: width, height_mm: height, gable_height_mm: gable,
      gross_area_mm2: gross, reconstructed_area_mm2: reconstructed,
      grossAreaBasis: stored.complete ? "stored" : "dimensions",
      deductedOpenings: assigned, deducted_area_mm2: deducted, net_area_mm2: net };
  });

  const classes = unique([...EDGE_CLASSES, ...measurement.edges.map(e => e.edge_class)]);
  const byClass = Object.fromEntries(classes.map(c => [
    c, sum("mm", measurement.edges.filter(e => e.edge_class === c)
      .map(e => read(e.length_mm, "mm", e.id, "length_mm"))),
  ]));
  const roofFaces = measurement.faces.filter(f => f.face_class === "roof_face");
  const roofArea = sum("mm2", roofFaces.map(f => read(f.area_mm2, "mm2", f.id, "area_mm2")));
  const complex = measurement.building?.roof_type === "hip" ||
    measurement.edges.some(e => e.edge_class === "hip" || e.edge_class === "valley") ||
    measurement.edges.filter(e => e.edge_class === "ridge").length > 1;
  const roofEdges = measurement.edges.filter(e => ["ridge", "hip", "valley"].includes(e.edge_class));
  // Waste is explicitly a low-confidence heuristic, never baked into raw totals.
  const waste = roofFaces.length
    ? result(complex ? 0.15 : 0.10, "ratio", "low", [...roofFaces.map(f => f.id), ...roofEdges.map(e => e.id)])
    : result(null, "ratio", "low", [], ["roof faces"]);
  // Parent assignment governs wall subtraction, not known window/door trim.
  // Unassigned skylights and known non-wall openings are outside siding trim;
  // other unknown types propagate an incomplete estimate rather than zero.
  const trimOpenings = openings.filter(o => o.assignment === "wall" ||
    (o.assignment === "unassigned" && o.type !== "skylight"));
  const trim = trimOpenings.map(o => {
    if (o.type === "window") return o.perimeter.total_mm;
    if (["door", "patio_door", "garage_door"].includes(o.type))
      return sum("mm", [o.perimeter.tops_mm, o.perimeter.sides_mm]);
    return result(null, "mm", "low", [o.id], [`${o.id}.unsupported_trim_type`]);
  });
  const jChannel = sum("mm", trim);
  const gutters = measurement.edges.filter(e => e.edge_class === "eave").map(e => ({
    id: e.id, elevation: e.belongs_to_elevation ?? null,
    length_mm: read(e.length_mm, "mm", e.id, "length_mm"),
  }));
  const downspouts = measurement.downspouts?.map(d => ({
    id: d.id, elevation: d.elevation ?? null,
    length_mm: read(d.length_mm, "mm", d.id, "length_mm"),
  })) ?? [];
  const united = sum("mm", openings.map(o => o.united_mm));

  return {
    roof: { area_mm2: roofArea, squares: calculate("SQ", [roofArea], ([area]) => mm2ToSquares(area)),
      suggestedWasteFactor: waste },
    edges: { byClass, drip_edge_mm: sum("mm", [byClass.eave, byClass.rake]) },
    walls: { faces: walls, gross_area_mm2: sum("mm2", walls.map(w => w.gross_area_mm2)),
      deducted_area_mm2: sum("mm2", walls.map(w => w.deducted_area_mm2)),
      net_area_mm2: sum("mm2", walls.map(w => w.net_area_mm2)) },
    openings: { ...counts(openings), items: openings,
      byWall: Object.fromEntries(walls.map(w => [w.id, counts(w.deductedOpenings)])),
      identicalGroups: groupOpenings(openings),
      ungroupedIds: openings.filter(o => !o.width_mm.complete || !o.height_mm.complete).map(o => o.id),
      unassigned: openings.filter(o => o.assignment === "unassigned"),
      nonWall: openings.filter(o => o.assignment === "non_wall"),
      perimeter: perimeter(openings), united_mm: united,
      united_inches: calculate("in", [united], ([mm]) => mmToInches(mm)) },
    corners: { inside_mm: byClass.inside_corner, outside_mm: byClass.outside_corner,
      total_mm: sum("mm", [byClass.inside_corner, byClass.outside_corner]) },
    starter_base_mm: byClass.base,
    // Geometric trim estimate: weakest dimensional confidence, at most medium.
    j_channel_estimate_mm: { ...jChannel, confidence: weakest([jChannel.confidence, "medium"]) },
    gutters: { runs: gutters, total_mm: sum("mm", gutters.map(g => g.length_mm)) },
    downspouts: { drops: downspouts,
      count: measurement.downspouts == null ? result(null, "count", "low", [], ["downspouts"])
        : count(downspouts.map(d => d.id)),
      total_mm: measurement.downspouts == null ? result(null, "mm", "low", [], ["downspouts"])
        : sum("mm", downspouts.map(d => d.length_mm)) },
    diagnostics,
  };
}