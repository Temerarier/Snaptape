// 3D-Modell eines Projekts: nur für model_ready-Projekte; alle anderen
// Status geben 404 zurück, damit der Viewer nie mit Testdaten für
// ein Entwurfs- oder Verarbeitungsprojekt erscheint.
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireUser } from "@/lib/auth/session";
import { ModellViewer } from "@/components/viewer/ModellViewer";
import { adaptiereV15FuerAnzeige } from "@/lib/messung/anzeigeAdapterV15";

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
    })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();
  // Viewer nur für fertig gemessene Projekte freigeben.
  if (project.status !== "model_ready") notFound();

  // model_ready ohne gespeichertes Measurement wäre ein Datenfehler –
  // explizit 404 statt stillem Fallback auf Testdaten.
  if (project.measurement === null || project.measurement === undefined) {
    notFound();
  }
  // Wegwerf-Adapter: gespeichertes v1.5-JSON nur für die Anzeige auf
  // den v1.2-Vertrag des bestehenden Viewers mappen (wirft bei
  // inkompatiblen Daten, kein stiller Fallback).
  const mess = adaptiereV15FuerAnzeige(project.measurement);
  return (
    <ModellViewer
      mess={mess}
      projektName={project.name}
      projektAdresse={project.adresse}
    />
  );
}
