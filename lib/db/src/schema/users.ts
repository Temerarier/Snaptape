import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  // Historical column name retained; values are Clerk user IDs after auth cutover.
  replitUserId: text("replit_user_id").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastAuthSessionId: text("last_auth_session_id"),
  // BCP-47-Sprach-Tag der UI ("en-US" | "de-DE"); Default US-Englisch.
  locale: text("locale").notNull().default("en-US"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
