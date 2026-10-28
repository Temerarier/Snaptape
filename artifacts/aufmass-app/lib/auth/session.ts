import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

export interface AuthProfile {
  id: string; email: string | null; firstName: string | null; lastName: string | null; sessionId: string;
}

export async function upsertAuthUser(profile: AuthProfile): Promise<User> {
  return db.transaction(async (tx) => {
    // Serialize first-login attempts for the same external identity, including email-less users.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profile.id}))`);
    const [existing] = await tx.select().from(usersTable).where(eq(usersTable.replitUserId, profile.id));
    const values = { email: profile.email?.toLowerCase() ?? null,
      firstName: profile.firstName, lastName: profile.lastName, replitUserId: profile.id };
    if (existing) {
      const [row] = await tx.update(usersTable).set({
        ...values,
        ...(existing.lastAuthSessionId !== profile.sessionId
          ? { lastLoginAt: new Date(), lastAuthSessionId: profile.sessionId } : {}),
      }).where(eq(usersTable.id, existing.id)).returning();
      return row!;
    }
    // Email is taken ONLY from a verified Clerk email; never attach by unverified claims.
    if (values.email) {
      const [attached] = await tx.update(usersTable).set({
        ...values, lastLoginAt: new Date(), lastAuthSessionId: profile.sessionId,
      }).where(and(eq(usersTable.email, values.email), isNull(usersTable.replitUserId))).returning();
      if (attached) return attached;
    }
    const [created] = await tx.insert(usersTable).values({
      ...values, lastLoginAt: new Date(), lastAuthSessionId: profile.sessionId,
    }).returning();
    return created!;
  });
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  if (!session.userId || !session.sessionId) return null;
  const profile = await currentUser();
  if (!profile) return null;
  const primary = profile.emailAddresses.find((e) => e.id === profile.primaryEmailAddressId);
  return upsertAuthUser({ id: profile.id, sessionId: session.sessionId,
    email: primary?.verification?.status === "verified" ? primary.emailAddress : null,
    firstName: profile.firstName, lastName: profile.lastName });
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const target = (await headers()).get("x-snaptape-return-to") ?? "/app";
    redirect(`/login?returnTo=${encodeURIComponent(target)}`);
  }
  return user;
}
