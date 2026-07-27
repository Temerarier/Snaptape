// Hochgeladene Projektdateien (Etappe 1): Fotos (jpg/png/heic) und
// Plan-PDFs. Originale bleiben unverändert im Object Storage; zu PDFs
// werden direkt nach dem Upload PNG-Seitenbilder (~3000 px lange Kante)
// gerendert – alle späteren KI-Aufrufe nutzen NUR diese Seitenbilder,
// nie das Roh-PDF. Zu Fotos wird eine kleine Browser-Vorschau (JPEG)
// erzeugt (HEIC können Browser nicht anzeigen).
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectFileKindEnum = pgEnum("project_file_kind", [
  "photo",
  "pdf",
]);

export const projectFilesTable = pgTable("project_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  kind: projectFileKindEnum("kind").notNull(),
  originalName: text("original_name").notNull(),
  // MIME wird serverseitig aus der Dateiendung abgeleitet (nicht vom
  // Client übernommen): image/jpeg, image/png, image/heic, application/pdf.
  mimeType: text("mime_type").notNull(),
  // Tatsächliche Größe laut Object-Storage-Metadaten (Server-Wahrheit).
  sizeBytes: integer("size_bytes").notNull(),
  // Voller Objektpfad "/<bucket>/<objekt>" des Originals. UNIQUE:
  // verhindert doppelte Registrierung desselben Storage-Objekts.
  storagePath: text("storage_path").notNull().unique(),
  // Browser-Vorschau (JPEG) für Fotos; null, wenn keine erzeugt werden
  // konnte (UI zeigt dann einen Platzhalter).
  previewPath: text("preview_path"),
  // Nur PDFs: Seitenzahl und gerenderte Seitenbilder in Seitenreihenfolge.
  pageCount: integer("page_count"),
  pageImagePaths: jsonb("page_image_paths").$type<string[] | null>(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProjectFile = typeof projectFilesTable.$inferSelect;
export type InsertProjectFile = typeof projectFilesTable.$inferInsert;
export type ProjectFileKind = ProjectFile["kind"];
