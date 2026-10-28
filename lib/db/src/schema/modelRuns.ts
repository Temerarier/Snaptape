import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { measureRunsTable } from "./messung";
import type { Model3dReport } from "../model3d";

export const modelRunsTable = pgTable("model_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  measureRunId: uuid("measure_run_id").references(() => measureRunsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  model: text("model").notNull(),
  effort: text("effort").notNull(),
  stufe: text("stufe").$type<"ok" | "merken" | "stopp">().notNull(),
  korrekturGenutzt: boolean("korrektur_genutzt").notNull().default(false),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: doublePrecision("cost_usd"),
  durationMs: integer("duration_ms").notNull(),
  sandboxMs: integer("sandbox_ms").notNull(),
  codeChars: integer("code_chars").notNull(),
  report: jsonb("report").$type<Model3dReport>().notNull(),
  // Server-side audit only. Never select this field for customer DTOs.
  aiCode: text("ai_code"),
});
