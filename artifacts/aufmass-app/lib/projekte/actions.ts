"use server";

import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";

export type ProjectFormState = { error?: string; success?: boolean };

const MAX_NAME_LENGTH = 200;
const MAX_ADRESSE_LENGTH = 300;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  // Fehlermeldungen in der Sprache des angemeldeten Nutzers.
  const t = getDictionary(toLocale(user.locale)).projects;

  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  const adresseRaw = String(formData.get("adresse") ?? "")
    .trim()
    .slice(0, MAX_ADRESSE_LENGTH);

  if (name.length === 0) {
    return { error: t.errorNameRequired };
  }

  await db.insert(projectsTable).values({
    userId: user.id,
    name,
    adresse: adresseRaw.length > 0 ? adresseRaw : null,
  });

  revalidatePath("/app");
  // Erfolg als Status zurückgeben (kein Redirect): Der Dialog in der
  // Kopfzeile bleibt über Navigationen hinweg gemountet und schließt
  // sich client-seitig, sobald success gesetzt ist.
  return { success: true };
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
