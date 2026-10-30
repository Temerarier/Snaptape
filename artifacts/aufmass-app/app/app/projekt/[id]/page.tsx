import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireUser } from "@/lib/auth/session";
import { raeumeHaengendeMessungenAuf } from "@/lib/messung/aufraeumen";

// Keep old card/bookmark URLs, but no intermediate project detail screen.
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  await raeumeHaengendeMessungenAuf(user.id);
  const [project] = await db.select({ status: projectsTable.status })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
    .limit(1);
  if (!project) notFound();
  redirect(`/app/projekt/${id}/${project.status === "model_ready" ? "viewer" : "upload"}`);
}
