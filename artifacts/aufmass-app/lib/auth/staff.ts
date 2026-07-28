// Staff-Check über das Secret STAFF_EMAILS (kommagetrennte Liste von
// Login-E-Mails). Staff nutzt normale Accounts, kein separater
// Admin-Login. Der Check läuft ausschließlich serverseitig – Nicht-Staff
// bekommt auf allen Admin-Routen 404, damit die Routen für normale
// Accounts schlicht nicht existieren.
import { notFound } from "next/navigation";
import type { User } from "@workspace/db";
import { requireUser } from "@/lib/auth/session";

export function istStaff(email: string): boolean {
  const roh = process.env.STAFF_EMAILS ?? "";
  const liste = roh
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return liste.includes(email.trim().toLowerCase());
}

// Serverseitige Pflicht-Prüfung für jede Admin-Seite: eingeloggt UND
// Staff, sonst 404 (bewusst kein 403 – keine Existenz-Preisgabe).
export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!istStaff(user.email)) notFound();
  return user;
}
