import Link from "next/link";
import { and, desc, eq, ilike, isNull, isNotNull, or } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { de } from "@/i18n/de";
import { requireUser } from "@/lib/auth/session";
import { NewProjectDialog } from "@/components/projekte/NewProjectDialog";
import { ProjectCard } from "@/components/projekte/ProjectCard";

export default async function ProjectListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archiv?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const showArchive = params.archiv === "1";
  const t = de.projects;

  const conditions = [
    eq(projectsTable.userId, user.id),
    showArchive
      ? isNotNull(projectsTable.archivedAt)
      : isNull(projectsTable.archivedAt),
  ];

  if (query.length > 0) {
    const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(projectsTable.name, pattern),
        ilike(projectsTable.adresse, pattern),
      )!,
    );
  }

  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(...conditions))
    .orderBy(desc(projectsTable.createdAt));

  const isSearching = query.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={showArchive ? "/app" : "/app?archiv=1"}
            className="text-sm font-medium text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
          >
            {showArchive ? t.showActive : t.showArchive}
          </Link>
          <NewProjectDialog />
        </div>
      </div>

      <form action="/app" className="mt-6 flex gap-2">
        {showArchive ? <input type="hidden" name="archiv" value="1" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t.searchPlaceholder}
          className="w-full max-w-md rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          {t.searchButton}
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="mt-16 flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          {isSearching ? (
            <>
              <h2 className="text-lg font-semibold">
                {t.noSearchResultsTitle}
              </h2>
              <p className="mt-1 max-w-md text-neutral-500">
                {t.noSearchResultsText}
              </p>
            </>
          ) : showArchive ? (
            <>
              <h2 className="text-lg font-semibold">{t.emptyArchiveTitle}</h2>
              <p className="mt-1 max-w-md text-neutral-500">
                {t.emptyArchiveText}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{t.emptyTitle}</h2>
              <p className="mt-1 max-w-md text-neutral-500">{t.emptyText}</p>
              <div className="mt-6">
                <NewProjectDialog ctaLabel={t.emptyCta} />
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      )}
    </main>
  );
}
