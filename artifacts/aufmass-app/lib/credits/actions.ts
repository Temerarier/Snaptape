"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/staff";
import { getDictionary, toLocale } from "@/i18n";
import { bucheCredits } from "./service";

export async function bucheStaffCreditsAction(_state: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const staff = await requireStaff();
  const t = getDictionary(toLocale(staff.locale)).admin.users.form;
  const userId = String(form.get("userId") ?? "");
  const raw = String(form.get("delta") ?? "");
  const delta = Number(raw);
  const note = String(form.get("note") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !raw.trim() || !Number.isInteger(delta) ||
    delta === 0 || delta < -100 || delta > 100 || !note || note.length > 500) return { error: t.invalid };
  await bucheCredits({ userId, delta, note, reason: delta > 0 ? "staff_grant" : "adjustment", staffUserId: staff.id });
  revalidatePath("/admin/users");
  revalidatePath("/app", "layout");
  return { ok: true };
}
