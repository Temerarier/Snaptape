"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, usersTable } from "@workspace/db";
import { isLocale } from "@/i18n";
import { requireUser } from "./session";

export async function setLocaleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wert = String(formData.get("locale") ?? "");
  if (!isLocale(wert) || wert === user.locale) return;
  await db.update(usersTable).set({ locale: wert }).where(eq(usersTable.id, user.id));
  revalidatePath("/", "layout");
}
