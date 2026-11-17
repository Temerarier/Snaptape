import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const creditReasonEnum = pgEnum("credit_reason", [
  "staff_grant", "measurement", "refund", "adjustment", "trial_grant",
]);

export const creditLedgerTable = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: creditReasonEnum("reason").notNull(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  measureRunId: uuid("measure_run_id"),
  refundOf: uuid("refund_of"),
  staffUserId: uuid("staff_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("credit_delta_nonzero", sql`${t.delta} <> 0`),
  index("credit_ledger_user_created_idx").on(t.userId, t.createdAt),
  // A charge can be refunded once, even across concurrent sweep/finalizer requests.
  uniqueIndex("credit_refund_charge_unique").on(t.refundOf),
]);

export type CreditReason = typeof creditReasonEnum.enumValues[number];
