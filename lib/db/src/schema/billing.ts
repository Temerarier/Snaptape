import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const billingReconciliationsTable = pgTable(
  "billing_reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    utcDay: date("utc_day", { mode: "string" }).notNull(),
    // "__account__" is the explicit account-level sentinel (Moonshot has no
    // model-level cost history); real provider model IDs are stored verbatim.
    model: text("model").notNull(),
    accountScope: text("account_scope").notNull(),
    actualCostUsd: doublePrecision("actual_cost_usd"),
    status: text("status").notNull(),
    detail: text("detail"),
    providerPayload: jsonb("provider_payload"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("billing_reconciliation_provider_day_model_scope_unique").on(
      table.provider,
      table.utcDay,
      table.model,
      table.accountScope,
    ),
  ],
);

export const billingBalanceSnapshotsTable = pgTable(
  "billing_balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    accountScope: text("account_scope").notNull(),
    utcDay: date("utc_day", { mode: "string" }).notNull(),
    balanceUsd: doublePrecision("balance_usd").notNull(),
    voucherBalanceUsd: doublePrecision("voucher_balance_usd").notNull(),
    cashBalanceUsd: doublePrecision("cash_balance_usd").notNull(),
    currency: text("currency").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    providerPayload: jsonb("provider_payload").notNull(),
  },
  (table) => [
    unique("billing_balance_provider_scope_day_unique").on(
      table.provider,
      table.accountScope,
      table.utcDay,
    ),
  ],
);

// Corrections append a new revision; old values are never updated or deleted.
export const billingTopupRevisionsTable = pgTable(
  "billing_topup_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topupId: uuid("topup_id").notNull(),
    revision: integer("revision").notNull(),
    provider: text("provider").notNull(),
    accountScope: text("account_scope").notNull(),
    amountUsd: doublePrecision("amount_usd").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    note: text("note").notNull(),
    staffActor: text("staff_actor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("billing_topup_id_revision_unique").on(
      table.topupId,
      table.revision,
    ),
  ],
);

export const billingProviderStateTable = pgTable("billing_provider_state", {
  provider: text("provider").primaryKey(),
  authRejectedAt: timestamp("auth_rejected_at", { withTimezone: true }),
  authRejectedDetail: text("auth_rejected_detail"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
