// Intentionally a standalone HTML response: no inherited app UI or private RSC props.
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { requireUser } from "@/lib/auth/session";
import { istStaff } from "@/lib/auth/staff";
import { getDictionary, toLocale } from "@/i18n";
import { renderPrintSheet } from "@/lib/viewer-next/printSheet";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const [project] = await db.select({
    id: projectsTable.id, name: projectsTable.name, address: projectsTable.adresse,
    date: projectsTable.createdAt, status: projectsTable.status, measurement: projectsTable.measurement,
  }).from(projectsTable).where(and(eq(projectsTable.id, id),
    istStaff(user.email) ? undefined : eq(projectsTable.userId, user.id))).limit(1);
  if (!project || project.status !== "model_ready" || !project.measurement) notFound();
  const [files] = await db.select({ count: count() }).from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, id));
  const locale = toLocale(user.locale);
  const nonce = randomBytes(18).toString("base64");
  const html = renderPrintSheet({
    measurement: project.measurement, name: project.name, address: project.address,
    date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(project.date),
    fileCount: files?.count ?? 0, locale, dict: getDictionary(locale).viewerNext, nonce,
    preview: new URL(request.url).searchParams.get("preview") === "1",
  });
  if (!html) notFound();
  return new Response(html, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'self'`,
  } });
}
