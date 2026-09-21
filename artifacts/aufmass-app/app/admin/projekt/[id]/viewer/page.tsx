// Staff-Viewer: 3D-Modell eines beliebigen Kundenprojekts
// (kundenübergreifend, daher zwingend hinter dem Staff-Gate).
// Nutzt dieselbe geschützte Messungsaufbereitung wie der Kunden-Viewer.
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireStaff } from "@/lib/auth/staff";
import { ProjectViewer } from "@/components/viewer-next/ProjectViewer";
import { getDictionary, toLocale } from "@/i18n";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminProjektViewerSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      adresse: projectsTable.adresse,
      status: projectsTable.status,
      measurement: projectsTable.measurement,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();
  if (project.status !== "model_ready") notFound();
  const dict = getDictionary(toLocale(user.locale));
  return (
    <ProjectViewer
      measurement={project.measurement}
      projectName={project.name}
      projectAddress={project.adresse}
      dict={dict.viewerNext}
      webglMessage={dict.viewer.webglFehler}
    />
  );
}
