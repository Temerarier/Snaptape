// Staff-Ansicht des gespeicherten Measurement-JSONs eines Projekts
// (kundenübergreifend, daher zwingend hinter dem Staff-Gate).
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminProjektJsonSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const dict = getDictionary(toLocale(user.locale));
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      measurement: projectsTable.measurement,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();
  if (project.measurement === null || project.measurement === undefined) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-schrift">
          {dict.admin.json.title} – {project.name}
        </h1>
        <Link
          href="/admin/measurements"
          className="shrink-0 text-sm text-schrift-sekundaer underline underline-offset-2 hover:text-schrift"
        >
          {dict.admin.json.zurueck}
        </Link>
      </div>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-linie bg-flaeche p-4 font-mono text-xs leading-relaxed text-schrift">
        {JSON.stringify(project.measurement, null, 2)}
      </pre>
    </main>
  );
}
