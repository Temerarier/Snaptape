"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, usersTable } from "@workspace/db";
import { de } from "@/i18n/de";
import { createSession, destroySession } from "./session";

export type AuthState = { error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 12;

// Konstante Vergleichsdauer beim Login, auch wenn der Nutzer nicht existiert
// (verhindert Timing-basiertes User-Enumeration).
const DUMMY_HASH = bcrypt.hashSync("timing-equalization-dummy", BCRYPT_COST);

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_PATTERN.test(email)) {
    return { error: de.auth.errorEmailInvalid };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: de.auth.errorPasswordTooShort };
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { error: de.auth.errorEmailTaken };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let user: { id: string } | undefined;
  try {
    const inserted = await db
      .insert(usersTable)
      .values({ email, passwordHash })
      .returning({ id: usersTable.id });
    user = inserted[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: de.auth.errorEmailTaken };
    }
    throw err;
  }

  if (!user) {
    return { error: de.auth.errorGeneric };
  }

  await createSession(user.id);
  redirect("/app");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return { error: de.auth.errorInvalidCredentials };
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = rows[0];

  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !passwordMatches) {
    return { error: de.auth.errorInvalidCredentials };
  }

  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
