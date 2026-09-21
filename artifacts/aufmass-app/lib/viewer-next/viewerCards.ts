import type { DerivedMeasurement, DerivedWall } from "@workspace/measurement";
import {
  formatSquareFeet,
  formatSquares,
  formatFeetInches,
  mm2ToSquareFeet,
  mmToInches,
} from "@workspace/measurement";
import type { Dictionary } from "@/i18n/en-US";

export type TradeFilter = "all" | "roofing" | "siding" | "painting";

export type TallyUnit = "sq ft" | "LF" | "EA";

/** Machine-readable value used by the calc bubble.  This is deliberately
 * separate from value/unit, which are presentation strings. */
export interface TallyValue {
  value: number;
  unit: TallyUnit;
  semanticClass: string;
}

export interface CardRow {
  id: string;
  label: string;
  badge?: string;
  sub?: string;
  value?: string;
  value2?: string;
  unit?: string;
  hasSub?: boolean;
  hasCalc?: boolean;
  cta?: string;
  subRows?: CardRow[];
  calcLines?: { label: string; value: string }[];
  tally?: TallyValue;
}

export interface ViewerCard {
  id: string;
  title: string;
  badge?: string;
  /** Small provenance chip for a derived hero value (for example drip edge). */
  sourceBadge?: string;
  hero: string;
  heroUnit: string;
  hero2?: string;
  sub?: string;
  accentClass: string;
  rows: CardRow[];
}

export interface MinimalMeasurement {
  meta?: { notes?: string[] };
  building?: {
    stories?: number;
    heights?: {
      eave_height_mm?: { value: number | null };
      ridge_height_mm?: { value: number | null };
      parapet_height_mm?: { value: number | null };
    };
  };
  faces?: Array<{
    id: string;
    face_class: string;
    material?: string;
    elevation?: string;
    area_mm2?: { value: number | null };
    pitch?: { rise_over_12_snapped?: number | null };
  }>;
  edges?: Array<{
    id: string;
    edge_class: string;
    belongs_to_elevation?: string | null;
    length_mm?: { value: number | null };
  }>;
  attachments?: Array<{
    id: string;
    type: string;
    width_mm?: { value: number | null };
    height_mm?: { value: number | null };
    depth_mm?: { value: number | null };
  }>;
  condition_areas?: Array<{
    id: string;
    type: string;
    parent_face_id?: string;
    elevation?: string;
    severity?: string;
    area_mm2?: { value: number | null };
    photo_index?: number;
    note?: string;
  }>;
  quality?: { warnings?: string[] };
  references?: Array<{
    photo_index?: number;
    scale_type?: string;
    object?: string;
    transferred_via?: string;
  }>;
}

const formatArea = (val: number | null) =>
  val !== null
    ? formatSquareFeet(mm2ToSquareFeet(val)).replace(" sq ft", "")
    : "—";
const formatLen = (val: number | null) =>
  val !== null ? formatFeetInches(mmToInches(val)) : "—";

const tallyArea = (
  value: number | null | undefined,
  semanticClass: string,
): TallyValue | undefined =>
  value == null
    ? undefined
    : { value: mm2ToSquareFeet(value), unit: "sq ft", semanticClass };
const tallyLength = (
  value: number | null | undefined,
  semanticClass: string,
): TallyValue | undefined =>
  value == null
    ? undefined
    : { value: mmToInches(value) / 12, unit: "LF", semanticClass };
const tallyCount = (
  value: number | null | undefined,
  semanticClass: string,
): TallyValue | undefined =>
  value == null ? undefined : { value, unit: "EA", semanticClass };

function setVerify(row: CardRow, dict: Dictionary["viewerNext"]) {
  if (row.value === "—") {
    row.unit = dict.labels.verifyOnSite;
  }
  return row;
}

function buildWallCalc(
  wall: DerivedWall,
  dict: Dictionary["viewerNext"],
  displayedNet: number,
) {
  const calcLines: { label: string; value: string }[] = [];
  const w = formatLen(wall.width_mm.value);
  const h = formatLen(wall.height_mm.value);
  const missingComponent =
    wall.rectangle_area_mm2.value === null ||
    wall.gable_area_mm2.value === null ||
    wall.deducted_area_mm2.value === null;

  if (missingComponent) {
    return [{ label: dict.labels.breakdownUnavailable, value: "—" }];
  }

  const rectangle = Math.round(mm2ToSquareFeet(wall.rectangle_area_mm2.value));
  let gable = Math.round(mm2ToSquareFeet(wall.gable_area_mm2.value));
  const deduction = Math.round(mm2ToSquareFeet(wall.deducted_area_mm2.value));
  const displayedTotal = rectangle + gable - deduction;

  // Balance whole-square-foot component rounding to the already-rounded net.
  // The source quantities remain the genuine computeDerived components.
  gable += displayedNet - displayedTotal;

  calcLines.push({ label: `${w} × ${h}`, value: rectangle.toString() });

  if (wall.gable_height_mm?.value && gable !== 0) {
    calcLines.push({
      label: `+ ${dict.labels.gable} ${w} × ${formatLen(wall.gable_height_mm.value)} / 2`,
      value: gable.toString(),
    });
  }

  if (wall.deductedOpenings.length > 0) {
    // Do not show a deduction line when the assigned openings contribute no
    // area.  The row still retains the source opening count elsewhere, but a
    // zero line is not part of the wall calculation.
    if (deduction === 0) return calcLines;
    calcLines.push({
      label: `− ${wall.deductedOpenings.length} ${dict.labels.openings}`,
      value: `−${deduction}`,
    });
  }
  return calcLines;
}

export function buildCards(
  derived: DerivedMeasurement,
  measurement: MinimalMeasurement,
  dict: Dictionary["viewerNext"],
): ViewerCard[] {
  const cards: ViewerCard[] = [];

  // 1. Roof Area
  const roofFaces =
    measurement.faces?.filter((f) => f.face_class === "roof_face") || [];
  const roofMats = Array.from(
    new Set(roofFaces.map((f) => f.material).filter(Boolean)),
  );
  const roofBadge =
    roofMats.length === 1
      ? (roofMats[0] as string).replace("_", " ")
      : undefined;

  cards.push({
    id: "roof_area",
    title: dict.cards.roofArea.toUpperCase(),
    badge: roofBadge
      ? roofBadge.charAt(0).toUpperCase() + roofBadge.slice(1)
      : undefined,
    hero:
      derived.roof.area_mm2.value !== null
        ? formatSquareFeet(
            mm2ToSquareFeet(derived.roof.area_mm2.value),
          ).replace(" sq ft", "")
        : "—",
    heroUnit: "sq ft",
    hero2:
      derived.roof.squares.value !== null
        ? formatSquares(derived.roof.squares.value)
        : "—",
    sub:
      derived.roof.facet_count.value === null
        ? `— ${dict.labels.verifyOnSite}`
        : `${derived.roof.facet_count.value} ${dict.labels.facets}`,
    accentClass: "border-l-viewer-roof",
    rows: roofFaces.map((face) => ({
      id: face.id,
      label: `${
        face.elevation
          ? face.elevation.charAt(0).toUpperCase() + face.elevation.slice(1)
          : dict.labels.roof
      } (${face.id})`,
      value: formatArea(face.area_mm2?.value ?? null),
      unit: "sq ft",
      tally: tallyArea(face.area_mm2?.value, "roof"),
      value2:
        face.pitch?.rise_over_12_snapped == null
          ? "—"
          : `${face.pitch.rise_over_12_snapped}/12`,
    })),
  });

  // 2. Roof Edges
  const edgeClasses = [
    ["eave", dict.labels.eaves],
    ["rake", dict.labels.rakes],
    ["ridge", dict.labels.ridge],
    ["hip", dict.labels.hip],
    ["valley", dict.labels.valley],
    ["step_flashing", dict.labels.stepFlashing],
    ["flashing", dict.labels.flashing],
    ["unclassified", dict.labels.unclassified],
  ] as const;

  cards.push({
    id: "roof_edges",
    title: dict.cards.roofEdges.toUpperCase(),
    hero: formatLen(derived.edges.drip_edge_mm.value),
    heroUnit: dict.labels.dripEdge,
    sourceBadge: dict.labels.fromEavesRakes,
    accentClass: "border-l-viewer-edges",
    rows: edgeClasses
      .map(([edgeClass, label]) => {
        const itemRows = (measurement.edges ?? [])
          .filter((edge) => edge.edge_class === edgeClass)
          .map((edge) => ({
            id: edge.id,
            label: edge.belongs_to_elevation
              ? `${edge.id} · ${edge.belongs_to_elevation}`
              : edge.id,
            value: formatLen(edge.length_mm?.value ?? null),
            tally: tallyLength(edge.length_mm?.value, "roof"),
          }));
        return {
          id: `edge-${edgeClass}`,
          label,
          value: formatLen(derived.edges.byClass[edgeClass]?.value ?? null),
          tally: tallyLength(
            derived.edges.byClass[edgeClass]?.value ?? null,
            "roof",
          ),
          hasSub: itemRows.length > 0,
          subRows: itemRows,
        };
      })
      .filter(
        (row) => row.id === "edge-unclassified" || row.value !== "0' 0\"",
      ),
  });

  // 3. Penetrations
  const skylightCount = derived.openings.byType["skylight"]?.value;
  const penetrations = (measurement.attachments ?? []).filter((attachment) =>
    ["pipe", "vent", "chimney"].includes(attachment.type),
  );
  const penetrationRows: CardRow[] = penetrations.map((attachment) => ({
    id: attachment.id,
    label: `${attachment.type === "pipe"
      ? dict.labels.pipeBoots
      : attachment.type.charAt(0).toUpperCase() + attachment.type.slice(1)} (${attachment.id})`,
    value: "1",
    unit: dict.labels.ea,
    tally: tallyCount(1, "roof"),
  }));
  if (
    skylightCount !== null &&
    skylightCount !== undefined &&
    skylightCount > 0
  ) {
    penetrationRows.push({
      id: "p-sky",
      label: dict.labels.skylights,
      value: skylightCount.toString(),
      unit: dict.labels.ea,
      tally: tallyCount(skylightCount, "roof"),
    });
  }
  cards.push({
    id: "penetrations",
    title: dict.cards.penetrations.toUpperCase(),
    hero: penetrationRows
      .reduce((sum, row) => sum + (row.tally?.value ?? 0), 0)
      .toString(),
    heroUnit: dict.labels.total,
    accentClass: "border-l-viewer-penetrations",
    rows: penetrationRows,
  });

  // 4. Gutters & Downspouts
  const dsTotal = derived.downspouts.total_mm.value;
  const dsCount = derived.downspouts.count.value;

  cards.push({
    id: "gutters",
    title: dict.cards.gutters.toUpperCase(),
    hero: formatLen(derived.gutters.total_mm.value),
    heroUnit: dict.labels.gutterRun,
    sub:
      dsTotal === null || dsCount === null
        ? undefined
        : `${dsCount} ${dict.labels.downspouts.toLowerCase()} · ${formatLen(dsTotal)} ${dict.labels.drop.toLowerCase()}`,
    accentClass: "border-l-viewer-gutters",
    rows: [
      {
        id: "g_run",
        label: dict.labels.gutters,
        value: formatLen(derived.gutters.total_mm.value),
        tally: tallyLength(derived.gutters.total_mm.value, "roof"),
      },
      {
        id: "ds",
        label: dict.labels.downspouts,
        value: dsTotal !== null && dsCount !== null ? dsCount.toString() : "—",
        unit: dsTotal !== null && dsCount !== null ? dict.labels.ea : undefined,
        tally:
          dsTotal !== null && dsCount !== null
            ? tallyCount(dsCount, "roof")
            : undefined,
        sub:
          dsTotal !== null
            ? `${dict.labels.total.toLowerCase()} ${formatLen(dsTotal)}`
            : undefined,
        hasSub: derived.downspouts.drops.length > 0,
        subRows: derived.downspouts.drops.map((d, i) => ({
          id: `ds_${i}`,
          label: d.elevation
            ? `${dict.labels.drop} (${d.elevation})`
            : `${dict.labels.drop} ${i + 1}`,
          value: formatLen(d.length_mm.value),
          tally: tallyLength(d.length_mm.value, "roof"),
        })),
      },
    ],
  });

  // 5. Height
  cards.push({
    id: "height",
    title: dict.cards.height.toUpperCase(),
    hero: measurement.building?.stories?.toString() ?? "—",
    heroUnit: dict.labels.stories,
    sub: `${dict.labels.eaveHeight} ${formatLen(measurement.building?.heights?.eave_height_mm?.value ?? null)} · ${dict.labels.ridgeHeight} ${formatLen(measurement.building?.heights?.ridge_height_mm?.value ?? null)}`,
    accentClass: "border-l-viewer-height",
    rows: [
      {
        id: "h_eave",
        label: dict.labels.eaveHeight,
        value: formatLen(
          measurement.building?.heights?.eave_height_mm?.value ?? null,
        ),
        unit: "",
        tally: tallyLength(
          measurement.building?.heights?.eave_height_mm?.value ?? null,
          "roof",
        ),
      },
      {
        id: "h_ridge",
        label: dict.labels.ridgeHeight,
        value: formatLen(
          measurement.building?.heights?.ridge_height_mm?.value ?? null,
        ),
        unit: "",
        tally: tallyLength(
          measurement.building?.heights?.ridge_height_mm?.value ?? null,
          "roof",
        ),
      },
      {
        id: "h_para",
        label: dict.labels.parapetHeight,
        value: formatLen(
          measurement.building?.heights?.parapet_height_mm?.value ?? null,
        ),
        unit: "",
        tally: tallyLength(
          measurement.building?.heights?.parapet_height_mm?.value ?? null,
          "roof",
        ),
      },
    ],
  });

  // 6. Walls
  cards.push({
    id: "walls",
    title: dict.cards.walls.toUpperCase(),
    hero: formatArea(derived.walls.net_area_mm2.value),
    heroUnit: "sq ft",
    sub: dict.labels.ofWhichGables.replace(
      "{area}",
      formatArea(derived.walls.gable_area_mm2.value),
    ),
    accentClass: "border-l-viewer-walls",
    rows: derived.walls.faces.map((w) => {
      const isMissing =
        w.gross_area_mm2.value === null || w.net_area_mm2.value === null;
      const displayedGross = isMissing
        ? 0
        : Math.round(mm2ToSquareFeet(w.gross_area_mm2.value!));
      const displayedNet = isMissing
        ? 0
        : Math.round(mm2ToSquareFeet(w.net_area_mm2.value!));
      const rawFace = measurement.faces?.find((f) => f.id === w.id);
      const material = rawFace?.material
        ? rawFace.material.charAt(0).toUpperCase() + rawFace.material.slice(1)
        : undefined;
      return {
        id: w.id,
        label: w.elevation
          ? `${w.elevation.charAt(0).toUpperCase() + w.elevation.slice(1)} (${w.id})`
          : w.id,
        badge: material,
        sub: isMissing
          ? dict.labels.notCaptured
          : `${displayedGross} ${dict.labels.gross}`,
        value: isMissing ? "—" : displayedNet.toString(),
        unit: isMissing ? undefined : "sq ft",
        tally: tallyArea(w.net_area_mm2.value, "walls"),
        cta: isMissing ? dict.labels.addPhoto : undefined,
        hasCalc: !isMissing,
        calcLines: isMissing ? undefined : buildWallCalc(w, dict, displayedNet),
      };
    }),
  });

  // 7. Openings
  const openingTypes = [
    "window",
    "door",
    "patio_door",
    "garage_door",
    "skylight",
  ];
  const openingRows: CardRow[] = [];
  const openingSummaries: string[] = [];

  openingTypes.forEach((t) => {
    const count = derived.openings.byType[t]?.value;
    if (count !== null && count !== undefined && count > 0) {
      const typeLabel =
        t
          .split("_")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ") + (count > 1 ? "s" : "");
      openingSummaries.push(`${count} ${typeLabel.toLowerCase()}`);

      const items = derived.openings.items.filter((o) => o.type === t);
      const typeAggregate = derived.openings.byTypeAggregate[t];
      let subRows: CardRow[] = [];
      if (items.length > 6) {
        derived.openings.parentGroups
          .filter((group) => group.type === t)
          .forEach((groupAggregate) => {
          const wId = groupAggregate.parent_face_id;
          const wall = derived.walls.faces.find((f) => f.id === wId);
          let label = wId ?? dict.labels.unassigned;
          if (wall && wall.elevation) {
            const sameElev = derived.walls.faces.filter(
              (f) => f.elevation === wall.elevation,
            );
            const elevName =
              wall.elevation.charAt(0).toUpperCase() + wall.elevation.slice(1);
            label = sameElev.length > 1 ? `${elevName} (${wId})` : elevName;
          } else if (wId === null && groupAggregate.elevation) {
            const elevName = groupAggregate.elevation.charAt(0).toUpperCase() +
              groupAggregate.elevation.slice(1);
            label = `${elevName} (${dict.labels.unassigned})`;
          }
          subRows.push({
            id: `og_${t}_${wId ?? `unassigned_${groupAggregate.elevation ?? "unknown"}`}`,
            label,
            sub: `${groupAggregate.count.value} ${dict.labels.ea} · ${dict.labels.perimeter} ${formatLen(groupAggregate.perimeter.total_mm.value)}`,
            value: formatArea(groupAggregate.area_mm2.value),
            unit: "sq ft",
            tally: tallyArea(groupAggregate.area_mm2.value, "openings"),
            hasSub: true,
            subRows: groupAggregate.openingIds.map(
              id => items.find(item => item.id === id)!,
            ).map((o) => ({
              id: o.id,
              label: `${o.id} · ${formatLen(o.width_mm.value)} × ${formatLen(o.height_mm.value)}`,
              sub: `${dict.labels.perimeter} ${formatLen(o.perimeter.total_mm.value)}`,
              value: formatArea(o.area_mm2.value),
              unit: "sq ft",
              tally: tallyArea(o.area_mm2.value, "openings"),
            })),
          });
        });
      } else {
        subRows = items.map((o) => ({
          id: o.id,
          label: `${o.id} · ${formatLen(o.width_mm.value)} × ${formatLen(o.height_mm.value)}`,
          sub: `${dict.labels.perimeter} ${formatLen(o.perimeter.total_mm.value)}`,
          value: formatArea(o.area_mm2.value),
           unit: "sq ft",
          tally: tallyArea(o.area_mm2.value, "openings"),
        }));
      }

      const typeLabelForTitle =
        t
          .split("_")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ") + "s";
      openingRows.push({
        id: `op_${t}`,
        label: typeLabelForTitle,
        sub: typeAggregate
          ? `${dict.labels.perimeter} ${formatLen(typeAggregate.perimeter.total_mm.value)}`
          : undefined,
        value: count.toString(),
        unit: dict.labels.ea,
        tally: tallyCount(count, "openings"),
        hasSub: true,
        subRows,
      });
    }
  });

  cards.push({
    id: "openings",
    title: dict.cards.openings.toUpperCase(),
    hero: derived.openings.total.value?.toString() ?? "—",
    heroUnit: dict.labels.ea,
    sub: openingSummaries.length > 0 ? openingSummaries.join(", ") : undefined,
    accentClass: "border-l-viewer-openings",
    rows: openingRows,
  });

  // 8. Trim & Roofline
  const fasciaFaces =
    measurement.faces?.filter((f) => f.face_class === "fascia") || [];
  const soffitFaces =
    measurement.faces?.filter((f) => f.face_class === "soffit") || [];
  const outsideCornerCount = (measurement.edges ?? []).filter(
    (edge) => edge.edge_class === "outside_corner",
  ).length;
  const insideCornerCount = (measurement.edges ?? []).filter(
    (edge) => edge.edge_class === "inside_corner",
  ).length;

  const trimRows: CardRow[] = [];
  fasciaFaces.forEach((f) => {
    trimRows.push({
      id: f.id,
      label: `${dict.labels.fascia} (${f.elevation || f.id})`,
      value: formatArea(f.area_mm2?.value ?? null),
      unit: "sq ft",
      tally: tallyArea(f.area_mm2?.value, "trim"),
    });
  });
  soffitFaces.forEach((f) => {
    trimRows.push({
      id: f.id,
      label: `${dict.labels.soffit} (${f.elevation || f.id})`,
      value: formatArea(f.area_mm2?.value ?? null),
      unit: "sq ft",
      tally: tallyArea(f.area_mm2?.value, "trim"),
    });
  });
  trimRows.push({
    id: "t_out_c",
    label: dict.labels.outsideCorners,
    value: outsideCornerCount.toString(),
    unit: dict.labels.ea,
    tally: tallyCount(outsideCornerCount, "trim"),
  });
  trimRows.push({
    id: "t_in_c",
    label: dict.labels.insideCorners,
    value: insideCornerCount.toString(),
    unit: dict.labels.ea,
    tally: tallyCount(insideCornerCount, "trim"),
  });

  cards.push({
    id: "trim",
    title: dict.cards.trim.toUpperCase(),
    hero: formatArea(derived.trim.fascia_area_mm2.value),
    heroUnit: `sq ft ${dict.labels.fascia.toLowerCase()}`,
    sub: `${dict.labels.soffit} ${formatArea(derived.trim.soffit_area_mm2.value)} sq ft · ${outsideCornerCount + insideCornerCount} ${dict.labels.corners}`,
    accentClass: "border-l-viewer-trim",
    rows: trimRows,
  });

  // 9. Condition Areas
  const condAreas = measurement.condition_areas || [];
  cards.push({
    id: "condition_areas",
    title: dict.cards.conditionAreas.toUpperCase(),
    hero: condAreas.length.toString(),
    heroUnit: dict.labels.areas,
    accentClass: "border-l-viewer-conditions",
    rows: condAreas.map((c) => ({
      id: c.id,
      label: `${c.type
        .split("_")
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ")} · ${c.parent_face_id || dict.labels.unassigned}`,
      sub: c.severity ? `${c.severity} ${dict.labels.severity}` : undefined,
      value: formatArea(c.area_mm2?.value ?? null),
      unit: "sq ft",
      tally: tallyArea(c.area_mm2?.value, "condition"),
    })),
  });

  // Apply "verify on site" to any row that has a null value "—"
  const applyVerify = (rows: CardRow[]) => {
    rows.forEach((r) => {
      setVerify(r, dict);
      if (r.subRows) applyVerify(r.subRows);
    });
  };
  cards.forEach((c) => applyVerify(c.rows));

  return cards;
}
