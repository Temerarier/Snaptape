// Tabellen für Messläufe nach dem Vertrag schema/mess-schema.json
// (Measure-JSON v1.2, englisch, US-Markt). Messwerte (value/confidence/
// source/reference_used, Eiserne Regel 4) werden als jsonb gespeichert;
// alle Zahlen ungerundet in mm bzw. mm² (Eiserne Regel 1). Component-IDs
// wie "WL-1"/"E-1"/"W-1" sind überall dieselben (Eiserne Regel 3).
import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { measureQualityEnum, projectsTable } from "./projects";

// Ausgang eines Messlaufs (Pipeline-Skelett Etappe 2): valide →
// model_ready, sonst failed (inkl. Extraktor-Fehler).
export const measureRunOutcomeEnum = pgEnum("measure_run_outcome", [
  "model_ready",
  "failed",
]);

export const buildingTypeEnum = pgEnum("building_type", [
  "detached",
  "duplex",
  "townhouse_middle",
  "townhouse_end",
  "unknown",
]);

export const roofTypeEnum = pgEnum("roof_type", [
  "gable",
  "hip",
  "flat",
  "shed",
  "mansard",
  "gambrel",
  "jerkinhead",
  "other",
  "unknown",
]);

export const faceClassEnum = pgEnum("face_class", [
  "roof_face",
  "wall",
  "soffit",
  "fascia",
]);

export const elevationEnum = pgEnum("elevation", [
  "front",
  "back",
  "left",
  "right",
  "roof",
  "unknown",
]);

export const materialEnum = pgEnum("material", [
  "stucco",
  "brick",
  "siding",
  "wood",
  "concrete",
  "eifs",
  "other",
  "unknown",
]);

export const edgeClassEnum = pgEnum("edge_class", [
  "ridge",
  "hip",
  "valley",
  "eave",
  "rake",
  "flashing",
  "step_flashing",
  "outside_corner",
  "inside_corner",
  "base",
  "head",
  "sill",
  "jamb",
  "unclassified",
]);

export const openingTypeEnum = pgEnum("opening_type", [
  "window",
  "door",
  "patio_door",
  "garage_door",
  "skylight",
  "other",
]);

export const attachmentTypeEnum = pgEnum("attachment_type", [
  "dormer",
  "bay",
  "balcony",
  "awning",
  "addition",
  "chimney",
  "other",
]);

// Ein Messwert nach Eiserner Regel 4 (jsonb-Spalten).
export interface MesswertJson {
  value: number;
  confidence: "high" | "medium" | "low";
  source: "measured" | "scaled" | "estimated";
  reference_used?: string | null;
  low_reason?: string | null;
}

export const measureRunsTable = pgTable("measure_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  schemaVersion: text("schema_version").notNull().default("1.2"),
  // Das komplette Measure-JSON des Laufs. Null nur, wenn der Extraktor
  // selbst scheiterte (dann steht der Grund in errors).
  measureJson: jsonb("measure_json"),
  // Protokoll je Lauf (Etappe 2): Qualität, Dauer, Ausgang, Warnungen,
  // Klartext-Fehler. Nullable, weil Alt-Zeilen sie nicht haben.
  quality: measureQualityEnum("quality"),
  durationMs: integer("duration_ms"),
  outcome: measureRunOutcomeEnum("outcome"),
  warnings: jsonb("warnings").$type<string[] | null>(),
  errors: jsonb("errors").$type<string[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const buildingsTable = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  measureRunId: uuid("measure_run_id")
    .notNull()
    .unique()
    .references(() => measureRunsTable.id, { onDelete: "cascade" }),
  buildingType: buildingTypeEnum("building_type"),
  stories: integer("stories"),
  roofType: roofTypeEnum("roof_type").notNull(),
  footprint: jsonb("footprint"),
  eaveHeightMm: jsonb("eave_height_mm").$type<MesswertJson | null>(),
  ridgeHeightMm: jsonb("ridge_height_mm").$type<MesswertJson | null>(),
  parapetHeightMm: jsonb("parapet_height_mm").$type<MesswertJson | null>(),
  sharedWalls: jsonb("shared_walls").$type<string[] | null>(),
});

export const facesTable = pgTable(
  "faces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull(), // z. B. "WL-1", "RF-1"
    faceClass: faceClassEnum("face_class").notNull(),
    elevation: elevationEnum("elevation"),
    material: materialEnum("material"),
    areaMm2: jsonb("area_mm2").$type<MesswertJson>().notNull(),
    areaNetMm2: jsonb("area_net_mm2").$type<MesswertJson | null>(),
    pitch: jsonb("pitch").$type<{
      degrees_original?: number;
      degrees_rounded?: number;
      rise_over_12_snapped?: number;
    } | null>(),
    orientationDeg: doublePrecision("orientation_deg"),
  },
  (t) => [
    unique("faces_run_component_unique").on(t.measureRunId, t.componentId),
  ],
);

export const edgesTable = pgTable(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull(), // z. B. "E-1"
    edgeClass: edgeClassEnum("edge_class").notNull(),
    lengthMm: jsonb("length_mm").$type<MesswertJson>().notNull(),
    belongsToElevation: elevationEnum("belongs_to_elevation"),
  },
  (t) => [
    unique("edges_run_component_unique").on(t.measureRunId, t.componentId),
  ],
);

export const openingsTable = pgTable(
  "openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull(), // z. B. "W-1", "D-1", "G-1"
    type: openingTypeEnum("type").notNull(),
    elevation: elevationEnum("elevation").notNull(),
    widthMm: jsonb("width_mm").$type<MesswertJson>().notNull(),
    heightMm: jsonb("height_mm").$type<MesswertJson>().notNull(),
    sillHeightMm: jsonb("sill_height_mm").$type<MesswertJson | null>(),
    positionMm: jsonb("position_mm").$type<{ x?: number; y?: number } | null>(),
    areaMm2: jsonb("area_mm2").$type<MesswertJson | null>(),
    perimeterMm: jsonb("perimeter_mm").$type<MesswertJson | null>(),
    // Eiserne Regel 5: Öffnungsmaße zeigen immer diesen Hinweis.
    note: text("note").notNull().default("Reference only, not for ordering"),
  },
  (t) => [
    unique("openings_run_component_unique").on(t.measureRunId, t.componentId),
  ],
);

export const attachmentsTable = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull(), // z. B. "AT-1"
    type: attachmentTypeEnum("type").notNull(),
    elevation: elevationEnum("elevation"),
    widthMm: jsonb("width_mm").$type<MesswertJson | null>(),
    heightMm: jsonb("height_mm").$type<MesswertJson | null>(),
    depthMm: jsonb("depth_mm").$type<MesswertJson | null>(),
  },
  (t) => [
    unique("attachments_run_component_unique").on(
      t.measureRunId,
      t.componentId,
    ),
  ],
);

export type MeasureRun = typeof measureRunsTable.$inferSelect;
export type InsertMeasureRun = typeof measureRunsTable.$inferInsert;
export type BuildingRow = typeof buildingsTable.$inferSelect;
export type FaceRow = typeof facesTable.$inferSelect;
export type EdgeRow = typeof edgesTable.$inferSelect;
export type OpeningRow = typeof openingsTable.$inferSelect;
export type AttachmentRow = typeof attachmentsTable.$inferSelect;
