import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { de } from "@/i18n/de";
import { requireUser } from "@/lib/auth/session";
import { StatusBadge } from "@/components/projekte/StatusBadge";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) notFound();

  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id)))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();

  const t = de.projectDetail;
  const cards = [
    t.cards.fotos,
    t.cards.modell,
    t.cards.messwerte,
    t.cards.report,
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/app"
        className="text-sm font-medium text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
      >
        ← {de.common.back}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <StatusBadge status={project.status} />
        {project.archivedAt ? (
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
            {de.projects.archivedBadge}
          </span>
        ) : null}
      </div>
      {project.adresse ? (
        <p className="mt-1 text-neutral-500">{project.adresse}</p>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <section
            key={card.title}
            className="rounded-xl border border-neutral-200 bg-white p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-neutral-900">{card.title}</h2>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                {t.placeholderHint}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">{card.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
