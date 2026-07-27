"use server";

import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";

export type ProjectFormState = {
  error?: string;
  success?: boolean;
  /** ID des neu angelegten Projekts – für die Navigation zur Upload-Seite. */
  projektId?: string;
};

const MAX_NAME_LENGTH = 200;
const MAX_ADRESSE_LENGTH = 300;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Automatischer Projektname wenn kein Name übergeben wird, z. B.
 *  "New project – Jul 27" (en-US) / "Neues Projekt – 27. Jul" (de-DE). */
function autoName(locale: string): string {
  const datum = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date());
  return locale.startsWith("de")
    ? `Neues Projekt – ${datum}`
    : `New project – ${datum}`;
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  const locale = toLocale(user.locale);

  const nameRoh = String(formData.get("name") ?? "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  const adresseRaw = String(formData.get("adresse") ?? "")
    .trim()
    .slice(0, MAX_ADRESSE_LENGTH);

  // Kein Name übergeben → automatisch generieren (Ein-Klick-Erstellung).
  const name = nameRoh.length > 0 ? nameRoh : autoName(locale);

  const [zeile] = await db
    .insert(projectsTable)
    .values({
      userId: user.id,
      name,
      adresse: adresseRaw.length > 0 ? adresseRaw : null,
    })
    .returning({ id: projectsTable.id });

  revalidatePath("/app");
  return { success: true, projektId: zeile.id };
}

export async function renameProjectAction(
  projektId: string,
  name: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const t = getDictionary(toLocale(user.locale)).projects;

  if (!UUID_PATTERN.test(projektId)) return { error: t.errorGeneric };
  const nameTrimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (nameTrimmed.length === 0) return { error: t.errorNameRequired };

  await db
    .update(projectsTable)
    .set({ name: nameTrimmed })
    .where(
      and(eq(projectsTable.id, projektId), eq(projectsTable.userId, user.id)),
    );

  revalidatePath("/app");
  revalidatePath(`/app/projekt/${projektId}/upload`);
  return {};
}

export async function archiveProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return;

  await db
    .update(projectsTable)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(projectsTable.id, id),
        eq(projectsTable.userId, user.id),
        isNull(projectsTable.archivedAt),
      ),
    );

  revalidatePath("/app");
}

export async function restoreProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!UUID_PATTERN.test(id)) return;

  await db
    .update(projectsTable)
    .set({ archivedAt: null })
    .where(
      and(
        eq(projectsTable.id, id),
        eq(projectsTable.userId, user.id),
        isNotNull(projectsTable.archivedAt),
      ),
    );

  revalidatePath("/app");
}
