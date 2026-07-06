// Tabellen für Messläufe nach dem Vertrag schema/mess-schema.json
// (Mess-JSON v1.0). Messwerte (wert/confidence/source/reference_used,
// Eiserne Regel 4) werden als jsonb gespeichert; alle Zahlen ungerundet
// in mm bzw. mm² (Eiserne Regel 1). Bauteil-IDs wie "W-1"/"K-1"/"F-1"
// sind überall dieselben (Eiserne Regel 3).
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
import { projectsTable } from "./projects";

export const gebaeudetypEnum = pgEnum("gebaeudetyp", [
  "freistehend",
  "doppelhaus",
  "reihenhaus_mitte",
  "reihenhaus_ende",
  "unbekannt",
]);

export const dachformEnum = pgEnum("dachform", [
  "satteldach",
  "walmdach",
  "flachdach",
  "pultdach",
  "mansarddach",
  "kruppelwalm",
  "sonstige",
  "unbekannt",
]);

export const faceClassEnum = pgEnum("face_class", [
  "dachflaeche",
  "wand",
  "untersicht",
  "blende",
]);

export const fassadeEnum = pgEnum("fassade", [
  "strassenseite",
  "gartenseite",
  "links",
  "rechts",
  "dach",
  "unbekannt",
]);

export const materialEnum = pgEnum("material", [
  "putz",
  "klinker",
  "wdvs",
  "holz",
  "sichtbeton",
  "sonstige",
  "unbekannt",
]);

export const edgeClassEnum = pgEnum("edge_class", [
  "first",
  "grat",
  "kehle",
  "traufe",
  "ortgang",
  "aussenecke",
  "innenecke",
  "sockel",
  "sturz",
  "fensterbank",
  "leibung",
  "unklassifiziert",
]);

export const openingTypEnum = pgEnum("opening_typ", [
  "fenster",
  "tuer",
  "garagentor",
  "sonstige",
]);

export const anbauTypEnum = pgEnum("anbau_typ", [
  "gaube",
  "erker",
  "balkon",
  "vordach",
  "anbau",
  "sonstige",
]);

// Ein Messwert nach Eiserner Regel 4 (jsonb-Spalten).
export interface MesswertJson {
  wert: number;
  confidence: "high" | "medium" | "low";
  source: "measured" | "scaled" | "estimated";
  reference_used?: string | null;
  grund_bei_low?: string | null;
}

export const measureRunsTable = pgTable("measure_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  schemaVersion: text("schema_version").notNull().default("1.0"),
  // Das komplette Mess-JSON des Laufs (validiert gegen den Vertrag).
  messJson: jsonb("mess_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gebaeudeTable = pgTable("gebaeude", {
  id: uuid("id").primaryKey().defaultRandom(),
  measureRunId: uuid("measure_run_id")
    .notNull()
    .unique()
    .references(() => measureRunsTable.id, { onDelete: "cascade" }),
  gebaeudetyp: gebaeudetypEnum("gebaeudetyp"),
  geschosse: integer("geschosse"),
  dachform: dachformEnum("dachform").notNull(),
  footprint: jsonb("footprint"),
  traufhoeheMm: jsonb("traufhoehe_mm").$type<MesswertJson | null>(),
  firsthoeheMm: jsonb("firsthoehe_mm").$type<MesswertJson | null>(),
  attikahoeheMm: jsonb("attikahoehe_mm").$type<MesswertJson | null>(),
  geteilteWaende: jsonb("geteilte_waende").$type<string[] | null>(),
});

export const facesTable = pgTable(
  "faces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    bauteilId: text("bauteil_id").notNull(), // z. B. "W-1", "D-1"
    faceClass: faceClassEnum("face_class").notNull(),
    fassade: fassadeEnum("fassade"),
    material: materialEnum("material"),
    flaecheMm2: jsonb("flaeche_mm2").$type<MesswertJson>().notNull(),
    flaecheNettoMm2: jsonb("flaeche_netto_mm2").$type<MesswertJson | null>(),
    neigung: jsonb("neigung").$type<{
      original_grad?: number;
      gerundet_grad?: number;
    } | null>(),
    ausrichtungGrad: doublePrecision("ausrichtung_grad"),
  },
  (t) => [unique("faces_run_bauteil_unique").on(t.measureRunId, t.bauteilId)],
);

export const edgesTable = pgTable(
  "edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    bauteilId: text("bauteil_id").notNull(), // z. B. "K-1"
    edgeClass: edgeClassEnum("edge_class").notNull(),
    laengeMm: jsonb("laenge_mm").$type<MesswertJson>().notNull(),
    gehoertZuFassade: fassadeEnum("gehoert_zu_fassade"),
  },
  (t) => [unique("edges_run_bauteil_unique").on(t.measureRunId, t.bauteilId)],
);

export const openingsTable = pgTable(
  "openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    bauteilId: text("bauteil_id").notNull(), // z. B. "F-1", "T-1", "G-1"
    typ: openingTypEnum("typ").notNull(),
    fassade: fassadeEnum("fassade").notNull(),
    breiteMm: jsonb("breite_mm").$type<MesswertJson>().notNull(),
    hoeheMm: jsonb("hoehe_mm").$type<MesswertJson>().notNull(),
    bruestungMm: jsonb("bruestung_mm").$type<MesswertJson | null>(),
    positionMm: jsonb("position_mm").$type<{ x?: number; y?: number } | null>(),
    flaecheMm2: jsonb("flaeche_mm2").$type<MesswertJson | null>(),
    umfangMm: jsonb("umfang_mm").$type<MesswertJson | null>(),
    // Eiserne Regel 5: Öffnungsmaße zeigen immer diesen Hinweis.
    hinweis: text("hinweis").notNull().default("Richtmaß, kein Bestellmaß"),
  },
  (t) => [
    unique("openings_run_bauteil_unique").on(t.measureRunId, t.bauteilId),
  ],
);

export const anbautenTable = pgTable(
  "anbauten",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    measureRunId: uuid("measure_run_id")
      .notNull()
      .references(() => measureRunsTable.id, { onDelete: "cascade" }),
    bauteilId: text("bauteil_id").notNull(), // z. B. "A-1"
    typ: anbauTypEnum("typ").notNull(),
    fassade: fassadeEnum("fassade"),
    breiteMm: jsonb("breite_mm").$type<MesswertJson | null>(),
    hoeheMm: jsonb("hoehe_mm").$type<MesswertJson | null>(),
    tiefeMm: jsonb("tiefe_mm").$type<MesswertJson | null>(),
  },
  (t) => [
    unique("anbauten_run_bauteil_unique").on(t.measureRunId, t.bauteilId),
  ],
);

export type MeasureRun = typeof measureRunsTable.$inferSelect;
export type InsertMeasureRun = typeof measureRunsTable.$inferInsert;
export type GebaeudeRow = typeof gebaeudeTable.$inferSelect;
export type FaceRow = typeof facesTable.$inferSelect;
export type EdgeRow = typeof edgesTable.$inferSelect;
export type OpeningRow = typeof openingsTable.$inferSelect;
export type AnbauRow = typeof anbautenTable.$inferSelect;
