/**
 * Generates the analysis-only Part 3 measurement corpus.
 *
 * The fixtures deliberately use only fields declared by measurement-v1.7.
 * In particular, no polygon/vertex fields are added to faces or roof edges:
 * v1.7 has no place to express that topology.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

type Point = [number, number];
type RoofKind = "gable" | "hip" | "jerkinhead" | "flat" | "shed" | "cross";
type AttachmentKind =
  | "garage-flat" | "garage-gable" | "garage-detached"
  | "annex-one" | "annex-two" | "canopy" | "porch" | "bay"
  | "dormer-gable" | "dormer-shed" | "balcony" | "awning" | "panel" | "chimney";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "fixtures");
const m = (value: number, confidence = "high") => ({
  value,
  confidence,
  source: "measured",
});
const pitch = (degrees: number) => ({
  degrees_original: degrees,
  degrees_rounded: Math.round(degrees * 10) / 10,
  rise_over_12_snapped: Math.round(Math.tan(degrees * Math.PI / 180) * 12),
});
const area = (points: Point[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]!;
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2);
const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const bounds = (points: Point[]) => ({
  width: Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])),
  depth: Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])),
});

const rectangle: Point[] = [[0, 0], [12000, 0], [12000, 8000], [0, 8000]];
const footprints: Record<string, Point[]> = {
  rectangle,
  "l-shape": [[0, 0], [12000, 0], [12000, 5000], [7000, 5000], [7000, 9000], [0, 9000]],
  "t-shape": [[3500, 0], [8500, 0], [8500, 3500], [12000, 3500], [12000, 8000], [0, 8000], [0, 3500], [3500, 3500]],
  "u-shape": [[0, 0], [12000, 0], [12000, 9000], [8500, 9000], [8500, 4000], [3500, 4000], [3500, 9000], [0, 9000]],
};

function elevationForSegment(a: Point, b: Point): "front" | "back" | "left" | "right" {
  if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) return b[0] > a[0] ? "front" : "back";
  return b[1] > a[1] ? "right" : "left";
}

function roofFaces(kind: RoofKind, width: number, depth: number, startId = 1, parent: string | null = null) {
  const slope = Math.hypot(depth / 2, 3000);
  const face = (id: number, elevation: string, value: number, degrees: number) => ({
    id: `RF-${id}`,
    face_class: "roof_face",
    elevation,
    material: degrees < 3 ? "membrane" : "shingle_asphalt",
    area_mm2: m(value),
    parent_attachment_id: parent,
    pitch: pitch(degrees),
    color: { hex: "#5B6470", name: "synthetic gray", confidence: "high" },
  });
  if (kind === "flat") return [face(startId, "roof", width * depth, 0)];
  if (kind === "shed") return [face(startId, "roof", width * Math.hypot(depth, 2200), 15.4)];
  if (kind === "hip") {
    return [
      face(startId, "front", width * slope * .72, 36.9),
      face(startId + 1, "back", width * slope * .72, 36.9),
      face(startId + 2, "left", depth * slope * .5, 36.9),
      face(startId + 3, "right", depth * slope * .5, 36.9),
    ];
  }
  if (kind === "jerkinhead") {
    return [
      face(startId, "front", width * slope, 36.9),
      face(startId + 1, "back", width * slope, 36.9),
      face(startId + 2, "left", depth * 1400, 36.9),
      face(startId + 3, "right", depth * 1400, 36.9),
    ];
  }
  if (kind === "cross") {
    return [
      face(startId, "front", width * slope, 36.9),
      face(startId + 1, "back", width * slope, 36.9),
      face(startId + 2, "left", 5000 * 4300, 35),
      face(startId + 3, "right", 5000 * 4300, 35),
    ];
  }
  return [
    face(startId, "front", width * slope, 36.9),
    face(startId + 1, "back", width * slope, 36.9),
  ];
}

function roofEdges(kind: RoofKind, width: number, depth: number) {
  const rows: Array<[string, number, string]> = [];
  if (kind === "gable") rows.push(["ridge", width, "roof"], ["eave", width, "front"], ["eave", width, "back"],
    ["rake", 5000, "left"], ["rake", 5000, "left"], ["rake", 5000, "right"], ["rake", 5000, "right"]);
  if (kind === "hip") rows.push(["ridge", width - depth, "roof"], ...Array.from({ length: 4 }, () => ["hip", 5000, "roof"] as [string, number, string]),
    ["eave", width, "front"], ["eave", width, "back"], ["eave", depth, "left"], ["eave", depth, "right"]);
  if (kind === "jerkinhead") rows.push(["ridge", width - 2800, "roof"], ...Array.from({ length: 4 }, () => ["hip", 2200, "roof"] as [string, number, string]),
    ...Array.from({ length: 4 }, (_, i) => ["rake", 3000, i < 2 ? "left" : "right"] as [string, number, string]));
  if (kind === "flat") rows.push(["eave", width, "front"], ["eave", width, "back"], ["eave", depth, "left"], ["eave", depth, "right"]);
  if (kind === "shed") rows.push(["eave", width, "front"], ["eave", width, "back"], ["rake", Math.hypot(depth, 2200), "left"], ["rake", Math.hypot(depth, 2200), "right"]);
  if (kind === "cross") rows.push(["ridge", width, "roof"], ["ridge", 5000, "roof"], ["valley", 3600, "roof"], ["valley", 3600, "roof"],
    ["eave", width, "front"], ["eave", width, "back"], ...Array.from({ length: 4 }, () => ["rake", 4300, "front"] as [string, number, string]));
  return rows.map(([edge_class, length, belongs_to_elevation], index) => ({
    id: `E-${index + 1}`,
    edge_class,
    length_mm: m(length),
    belongs_to_elevation,
  }));
}

function baseFixture(slug: string, title: string, points: Point[] = rectangle, roofKind: RoofKind = "gable") {
  const { width, depth } = bounds(points);
  const eave = 6000;
  const ridge = roofKind === "flat" ? 6000 : roofKind === "shed" ? 8200 : 9000;
  const roofType = roofKind === "cross" ? "other" : roofKind;
  const walls = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    const elevation = elevationForSegment(point, next);
    const gable = roofKind === "gable" && (elevation === "left" || elevation === "right") ? 3000
      : roofKind === "jerkinhead" && (elevation === "left" || elevation === "right") ? 1200 : 0;
    const segmentWidth = distance(point, next);
    return {
      id: `WL-${index + 1}`,
      face_class: "wall",
      elevation,
      material: "siding",
      area_mm2: m(segmentWidth * eave + segmentWidth * gable / 2),
      width_mm: m(segmentWidth),
      height_mm: m(eave),
      gable_height_mm: gable ? m(gable) : null,
      color: { hex: "#D2C7B8", name: "synthetic beige", confidence: "high" },
    };
  });
  return {
    meta: {
      country: "US",
      unit: "mm",
      schema_version: "1.7",
      notes: [
        `Analysis-only synthetic fixture: ${title}.`,
        "Dimensions encode the intended discriminating case; this is not a real measurement.",
      ],
    },
    building: {
      building_type: "detached",
      stories: 2,
      roof_type: roofType,
      footprint: {
        points,
        width_mm: m(width),
        depth_mm: m(depth),
        perimeter_mm: m(points.reduce((sum, point, index) => sum + distance(point, points[(index + 1) % points.length]!), 0)),
        area_mm2: m(area(points)),
      },
      footprint_overall: { width_mm: m(width), depth_mm: m(depth), note: "Main body only." },
      heights: {
        eave_height_mm: m(eave),
        ridge_height_mm: m(ridge),
        parapet_height_mm: roofKind === "flat" ? m(ridge) : null,
        datum_note: "Level synthetic datum at the front-left corner.",
        per_elevation: null,
      },
      shared_walls: [],
    },
    references: [],
    attachments: [] as Record<string, unknown>[],
    faces: [...roofFaces(roofKind, width, depth), ...walls],
    edges: roofEdges(roofKind, width, depth),
    openings: [],
    quality: { references_used: 0, warnings: ["Synthetic analysis fixture; not for production use."] },
  };
}

function nextRoofId(fixture: ReturnType<typeof baseFixture>) {
  return fixture.faces.filter(face => face.face_class === "roof_face").length + 1;
}

function addAttachment(fixture: ReturnType<typeof baseFixture>, kind: AttachmentKind) {
  const rearAnnex = kind === "annex-one" || kind === "annex-two";
  const wallParent = kind.includes("garage") ? "WL-2" : rearAnnex ? "WL-3" : "WL-1";
  const roofParent = fixture.faces.find(face => face.face_class === "roof_face")!.id;
  const dimensions: Record<AttachmentKind, [number, number, number]> = {
    "garage-flat": [6500, 3000, 6500], "garage-gable": [6500, 3000, 6500],
    "garage-detached": [6000, 3000, 6000], "annex-one": [5000, 3000, 3500],
    "annex-two": [5000, 6000, 3500], canopy: [2800, 250, 1600], porch: [5000, 2800, 2500],
    bay: [2400, 2800, 900], "dormer-gable": [2400, 1800, 1800], "dormer-shed": [3200, 1600, 1800],
    balcony: [3500, 1100, 1600], awning: [3000, 180, 1200], panel: [2400, 1200, 100],
    chimney: [900, 1800, 700],
  };
  const typeByKind: Record<AttachmentKind, string> = {
    "garage-flat": "addition", "garage-gable": "addition", "garage-detached": "addition",
    "annex-one": "addition", "annex-two": "addition", canopy: "other", porch: "addition",
    bay: "bay", "dormer-gable": "dormer", "dormer-shed": "dormer", balcony: "balcony",
    awning: "awning", panel: "other", chimney: "chimney",
  };
  const roofMounted = kind === "dormer-gable" || kind === "dormer-shed" || kind === "chimney";
  const detached = kind === "garage-detached";
  const [width, height, depth] = dimensions[kind];
  const attachment: Record<string, unknown> = {
    id: "AT-1",
    type: typeByKind[kind],
    elevation: roofMounted ? "roof" : kind.includes("garage") ? "right" : rearAnnex ? "back" : "front",
    width_mm: m(width),
    height_mm: m(height),
    depth_mm: m(depth),
    position_mm: {
      x: kind === "panel" ? 4200 : 1800,
      y: roofMounted ? 1200
        : kind === "balcony" || kind === "panel" ? 3300
        : kind === "canopy" || kind === "awning" ? 3000
        : 0,
    },
    parent_face_id: detached ? null : roofMounted ? roofParent : wallParent,
    attached: detached ? false : true,
    include_in_footprint: ["garage-flat", "garage-gable", "annex-one", "annex-two", "porch", "bay"].includes(kind),
  };
  if (kind === "dormer-gable" || kind === "dormer-shed") {
    attachment.dormer = { style: kind === "dormer-gable" ? "gable" : "shed", face_pitch_deg: kind === "dormer-gable" ? 35 : 12 };
  }
  fixture.attachments.push(attachment);

  // Roof-bearing secondary volumes get their own declared roof facet(s).
  const gableRoof = kind === "garage-gable" || kind === "garage-detached";
  const flatRoof = ["garage-flat", "annex-one", "annex-two", "canopy", "porch", "bay", "awning"].includes(kind);
  if (gableRoof || flatRoof) {
    const roofs = roofFaces(gableRoof ? "gable" : "flat", width, depth, nextRoofId(fixture), "AT-1");
    fixture.faces.splice(fixture.faces.filter(face => face.face_class === "roof_face").length, 0, ...roofs);
  }
  if (fixture.building.footprint_overall && attachment.include_in_footprint) {
    fixture.building.footprint_overall = {
      width_mm: m(kind.includes("garage") ? 18500 : 12000),
      depth_mm: m(["annex-one", "annex-two", "porch", "bay"].includes(kind) ? 8000 + depth : 8000),
      note: "Includes AT-1; v1.7 stores only overall envelope dimensions, not its outline.",
    };
  }
}

const definitions: Array<{
  slug: string; title: string; expected: string; limitations: string; make: () => ReturnType<typeof baseFixture>;
}> = [];
const add = (slug: string, title: string, expected: string, limitations: string, make: () => ReturnType<typeof baseFixture>) =>
  definitions.push({ slug, title, expected, limitations, make });

for (const [slug, title] of [
  ["footprint-rectangle", "Rectangle footprint"],
  ["footprint-l-shape", "L-shaped footprint"],
  ["footprint-t-shape", "T-shaped footprint"],
  ["footprint-u-shape", "U-shaped footprint"],
] as const) {
  const key = slug.replace("footprint-", "");
  add(slug, title, `Extrude every footprint segment; preserve the ${title.toLowerCase()} outline rather than replacing it with its bounding rectangle.`,
    "v1.7 supplies footprint points but does not map each wall face to a specific point pair; repeated cardinal elevations are the only available hint.",
    () => baseFixture(slug, title, footprints[key]!));
}

add("footprint-connected-heights", "Two connected volumes of different heights",
  "Show a 6 m-high main body joined to a distinct 3 m-high secondary volume with its own flat roof.",
  "v1.7 has no attachment story count, attachment wall-face linkage, attachment footprint polygon, or attachment eave/ridge heights; only dimensions and parent links encode this case.",
  () => {
    const f = baseFixture("footprint-connected-heights", "Two connected volumes of different heights");
    addAttachment(f, "annex-one");
    return f;
  });

for (const [slug, title, kind, expected, limitation] of [
  ["roof-gable", "Gable roof", "gable", "Two slopes meeting at one ridge; gable triangles only on left and right walls.", "Face records have no boundary vertices or edge-to-face links."],
  ["roof-hip", "Hip roof", "hip", "Four sloped facets, a shortened ridge and four hips; no vertical gable triangles.", "The schema identifies hip edge lengths but not their endpoints or incident faces."],
  ["roof-half-hip", "Half-hip roof", "jerkinhead", "Partial gables capped by small hip facets; visibly different from both full gable and full hip.", "v1.7 calls half-hip jerkinhead and has no facet topology or explicit half-hip run."],
  ["roof-flat", "Flat roof", "flat", "One horizontal membrane facet at parapet height, with no ridge or gable.", "Parapet plan geometry and drainage slope are not represented."],
  ["roof-shed", "Shed mono-pitch roof", "shed", "One continuous facet rising from the front eave to the higher back wall; no centered ridge.", "Per-elevation height can state high/low sides but roof face boundaries are absent."],
  ["roof-cross-gable", "Cross gable roof", "cross", "Intersecting main and transverse gables with two valleys and two ridges.", "roof_type must be other; v1.7 cannot associate roof facets, valleys and ridges into topology."],
] as const) {
  add(slug, title, expected, limitation, () => {
    const f = baseFixture(slug, title, rectangle, kind);
    if (kind === "shed") f.building.heights.per_elevation = [
      { elevation: "front", eave_height_mm: m(6000), ridge_height_mm: null, grade_offset_mm: m(0) },
      { elevation: "back", eave_height_mm: m(8200), ridge_height_mm: null, grade_offset_mm: m(0) },
    ];
    return f;
  });
}

add("roof-lower-gable-wing", "Gable with a lower gable wing",
  "A main gable plus a shorter attached wing with two roof facets and its own lower ridge.",
  "The attachment has dimensions and parent roof faces, but v1.7 has no attachment ridge/eave height fields or explicit roof topology.",
  () => {
    const f = baseFixture("roof-lower-gable-wing", "Gable with a lower gable wing");
    addAttachment(f, "garage-gable");
    f.attachments[0] = { ...f.attachments[0], width_mm: m(4200), height_mm: m(3200), depth_mm: m(5000), parent_face_id: "WL-1", elevation: "front" };
    return f;
  });

const attachmentCases: Array<[string, string, AttachmentKind, string, string]> = [
  ["attachment-garage-flat", "Attached garage with flat roof", "garage-flat", "Attached right-side garage at its measured 6.5 x 6.5 x 3 m size, capped by its RF-3 flat roof.", "Garage is represented as generic addition because v1.7 has no garage attachment type or attachment wall linkage."],
  ["attachment-garage-gable", "Attached garage with its own gable roof", "garage-gable", "Attached right-side garage with a separate lower gable roof RF-3/RF-4, not a copy of the main roof.", "No attachment eave/ridge heights or facet topology are available."],
  ["attachment-garage-detached", "Detached garage", "garage-detached", "A separate 6 x 6 x 3 m garage, not touching the house.", "v1.7 position_mm is parent-face-relative and provides no site coordinate system for detached objects; exact detached placement is unknowable."],
  ["attachment-annex-one-story", "One-story annex", "annex-one", "A 3 m-high rear annex with a distinct flat roof.", "No attachment story count, wall-face ownership or roof elevation is declared by v1.7."],
  ["attachment-annex-two-story", "Two-story annex", "annex-two", "A 6 m-high rear annex, visibly taller than the one-story case, with a distinct flat roof.", "Story count and floor levels are not fields on attachments; height is the only discriminator."],
  ["attachment-entrance-canopy", "Entrance canopy", "canopy", "A thin 250 mm canopy projecting 1.6 m from WL-1, not a room-sized box.", "Canopy has no dedicated attachment type; type other plus dimensions is the only schema-valid representation."],
  ["attachment-porch", "Porch", "porch", "A 5 x 2.5 m one-story front porch with its own flat roof.", "Porch has no dedicated type or open/closed/support geometry in v1.7."],
  ["attachment-bay-window", "Bay window", "bay", "A shallow 0.9 m projection from WL-1, retaining the measured 2.4 m width.", "v1.7 does not describe bay side-wall angles or bay footprint."],
  ["attachment-dormer-gable", "Gable dormer", "dormer-gable", "A roof-mounted dormer with a peaked gable roof at RF-1 position.", "Dormer style and face pitch exist, but dimensions do not encode dormer roof ridge/eave or cheek topology."],
  ["attachment-dormer-shed", "Shed dormer", "dormer-shed", "A wider roof-mounted dormer with one 12-degree mono-pitch roof, distinct from the gable dormer.", "Dormer face_pitch_deg does not define roof direction or facet boundaries."],
  ["attachment-balcony", "Balcony", "balcony", "A shallow elevated platform on WL-1 at y=3.3 m, not a ground-level solid addition.", "Railings, slab thickness and supports have no declared fields."],
  ["attachment-awning", "Awning", "awning", "A 180 mm-thick wall-mounted awning projecting 1.2 m, with its own RF-3 covering plane.", "Slope/direction for non-dormer attachment roofs can only be inferred from the parent roof-face pitch record."],
  ["attachment-wall-panel", "Flat panel on a wall", "panel", "A 100 mm-deep 2.4 x 1.2 m panel mounted on WL-1 at y=3.3 m; do not inflate it into a box.", "Panel has no dedicated type, orientation or surface-normal field; type other and parent wall are the available representation."],
  ["attachment-chimney", "Chimney", "chimney", "A 0.9 x 0.7 m chimney rising 1.8 m above RF-1 at the stated roof-relative position.", "Roof-relative x/y has no facet coordinate frame or surface equation in v1.7, so world placement cannot be exact."],
];
for (const [slug, title, kind, expected, limitations] of attachmentCases) {
  add(slug, title, expected, limitations, () => {
    const f = baseFixture(slug, title);
    addAttachment(f, kind);
    return f;
  });
}

add("special-sloped-site", "Sloped site with per-side eave heights",
  "Respect four grade offsets and side-specific eave heights; wall bottoms follow grade while roof eaves remain coherent.",
  "v1.7 provides per-elevation values but no grade polyline or per-footprint-vertex elevations, so corners with differing offsets are underdetermined.",
  () => {
    const f = baseFixture("special-sloped-site", "Sloped site with per-side eave heights");
    f.building.heights.eave_height_mm = m(7200);
    f.building.heights.ridge_height_mm = m(10200);
    f.building.heights.datum_note = "Lowest visible synthetic grade is datum zero. Grade offsets are left 0 mm, front/back 600 mm, and right 1200 mm; local grade-to-eave/ridge heights decrease by the same offsets so the roof lines remain level at 7200/10200 mm above datum.";
    f.building.heights.per_elevation = [
      { elevation: "front", eave_height_mm: m(6600), ridge_height_mm: m(9600), grade_offset_mm: m(600) },
      { elevation: "back", eave_height_mm: m(6600), ridge_height_mm: m(9600), grade_offset_mm: m(600) },
      { elevation: "left", eave_height_mm: m(7200), ridge_height_mm: m(10200), grade_offset_mm: m(0) },
      { elevation: "right", eave_height_mm: m(6000), ridge_height_mm: m(9000), grade_offset_mm: m(1200) },
    ];
    return f;
  });

add("special-no-footprint", "Measurement without footprint outline",
  "Degrade to the declared 12 x 8 m width/depth rectangle and issue a visible approximation warning rather than crash.",
  "The schema allows footprint.points to be absent; without it, only a rectangular width/depth fallback can be justified.",
  () => {
    const f = baseFixture("special-no-footprint", "Measurement without footprint outline");
    delete (f.building.footprint as { points?: Point[] }).points;
    f.quality.warnings.push("Footprint outline unavailable; width/depth rectangle is only a fallback.");
    return f;
  });

add("special-missing-attachment-dimensions", "Attachment with missing dimensions",
  "Keep the main house valid, omit or visibly placeholder the underdetermined addition, and identify AT-1 in a warning.",
  "Attachment dimension fields are nullable; there is no schema-defined default size and inventing one would be misleading.",
  () => {
    const f = baseFixture("special-missing-attachment-dimensions", "Attachment with missing dimensions");
    addAttachment(f, "annex-one");
    f.attachments[0] = { ...f.attachments[0], width_mm: null, height_mm: null, depth_mm: null };
    f.faces = f.faces.filter(face => face.parent_attachment_id !== "AT-1");
    f.quality.warnings.push("AT-1 dimensions and roof geometry are unavailable.");
    return f;
  });

if (definitions.length !== 29) throw new Error(`Expected 29 Part 3 cases, got ${definitions.length}`);
await mkdir(fixtureDir, { recursive: true });
const manifest = [];
for (const definition of definitions) {
  const file = `${definition.slug}.json`;
  await writeFile(join(fixtureDir, file), `${JSON.stringify(definition.make(), null, 2)}\n`);
  manifest.push({
    slug: definition.slug,
    title: definition.title,
    expected: definition.expected,
    measurementFile: `scripts/diagnose/fixtures/${file}`,
    limitations: definition.limitations,
  });
}
await writeFile(join(here, "cases.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${manifest.length} schema-v1.7 analysis fixtures.`);