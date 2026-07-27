import {
  boolean,
  doublePrecision,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Status-Maschine ab Etappe 1: draft → files_uploaded → processing →
// model_ready → failed. Die alten Werte reviewing/ready bleiben erhalten
// (Seed-Daten und bisheriger Viewer-Fluss nutzen sie noch); neue Werte
// werden hinten angehängt, damit Drizzle nur ADD VALUE ausführt.
export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "reviewing",
  "ready",
  "failed",
  "files_uploaded",
  "processing",
  "model_ready",
]);

// Messqualität (neutrale Labels, keine Modellnamen in der UI).
export const measureQualityEnum = pgEnum("measure_quality", [
  "standard",
  "premium",
]);

// Einheit des optionalen Referenzmaßes. Gespeichert wie eingegeben;
// die Pipeline erzeugt daraus später einen references[]-Eintrag mit
// scale_type "user_provided" (Umrechnung erst bei Verwendung).
export const referenceUnitEnum = pgEnum("reference_unit", [
  "mm",
  "cm",
  "m",
  "inch",
  "feet",
]);

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  adresse: text("adresse"),
  status: projectStatusEnum("status").notNull().default("draft"),
  paid: boolean("paid").notNull().default(false),
  // Upload-Einstellungen (Etappe 1).
  quality: measureQualityEnum("quality").notNull().default("standard"),
  // Referenzobjekt als Freitext (z. B. "entry door height") – kein
  // Foto-Bezug; die Pipeline findet das Objekt selbst in den Fotos.
  referenceObject: text("reference_object"),
  referenceValue: doublePrecision("reference_value"),
  referenceUnit: referenceUnitEnum("reference_unit"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  archivedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectStatus = Project["status"];
