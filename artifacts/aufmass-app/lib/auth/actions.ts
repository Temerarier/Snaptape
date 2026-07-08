"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, usersTable } from "@workspace/db";
import { DEFAULT_LOCALE, getDictionary, isLocale } from "@/i18n";
import { createSession, destroySession, requireUser } from "./session";

export type AuthState = { error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 12;

// Vor dem Login gibt es kein Nutzer-Locale – Fehlermeldungen der
// Auth-Formulare erscheinen daher in der Standardsprache (en-US).
const t = getDictionary(DEFAULT_LOCALE).auth;

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
    return { error: t.errorEmailInvalid };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: t.errorPasswordTooShort };
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { error: t.errorEmailTaken };
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
      return { error: t.errorEmailTaken };
    }
    throw err;
  }

  if (!user) {
    return { error: t.errorGeneric };
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
    return { error: t.errorInvalidCredentials };
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
    return { error: t.errorInvalidCredentials };
  }

  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// Sprachumschalter (Benutzermenü): speichert die Auswahl am Nutzer
// (users.locale), damit sie Reload und erneuten Login überlebt.
export async function setLocaleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wert = String(formData.get("locale") ?? "");
  if (!isLocale(wert) || wert === user.locale) return;

  await db
    .update(usersTable)
    .set({ locale: wert })
    .where(eq(usersTable.id, user.id));

  // Gesamtes Layout neu rendern – die Sprache betrifft alle Seiten.
  revalidatePath("/", "layout");
}
