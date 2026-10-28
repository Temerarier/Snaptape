// 3D-Modell eines Projekts: nur für model_ready-Projekte; alle anderen
// Status geben 404 zurück, damit der Viewer nie mit Testdaten für
// ein Entwurfs- oder Verarbeitungsprojekt erscheint.
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireUser } from "@/lib/auth/session";
import { ProjectViewer } from "@/components/viewer-next/ProjectViewer";
import { ProjectMeasurementState } from "@/components/projekte/ProjectMeasurementState";
import { getDictionary, toLocale } from "@/i18n";
import { Model3dProgress } from "@/components/projekte/Model3dProgress";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjektViewerSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) notFound();

  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      adresse: projectsTable.adresse,
      status: projectsTable.status,
      measurement: projectsTable.measurement,
      model3dStatus: projectsTable.model3dStatus,
    })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();
  const dict = getDictionary(toLocale(user.locale));
  if (project.status !== "model_ready") {
    return (
      <ProjectMeasurementState
        status={project.status}
        projectName={project.name}
        projectAddress={project.adresse}
        dict={dict.projectDetail}
        retryHref={`/app/projekt/${project.id}/upload`}
      />
    );
  }
  return (
    <>
    <Model3dProgress status={project.model3dStatus}
      pendingText={dict.viewerNext.model3dPending}
      unavailableText={dict.viewerNext.model3dUnavailable} />
    <ProjectViewer
      measurement={project.measurement}
      projectName={project.name}
      projectAddress={project.adresse}
      dict={dict.viewerNext}
      webglMessage={dict.viewer.webglFehler}
    />
    </>
  );
}
