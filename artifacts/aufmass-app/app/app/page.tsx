import Link from "next/link";
import { and, asc, desc, eq, ilike, isNull, isNotNull, or } from "drizzle-orm";
import { db, projectsTable, type ProjectStatus } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { NewProjectDialog } from "@/components/projekte/NewProjectDialog";
import { ProjectCard } from "@/components/projekte/ProjectCard";
import { SortSelect } from "@/components/projekte/SortSelect";

const STATUS_WERTE: readonly ProjectStatus[] = [
  "draft",
  "reviewing",
  "ready",
  "failed",
];

type SortWert = "neueste" | "aelteste";

// Baut die Listen-URL und erhält dabei Suche/Sortierung/Archiv-Ansicht.
function listenUrl(teile: {
  q: string;
  status: ProjectStatus | null;
  sort: SortWert;
  archiv: boolean;
}): string {
  const p = new URLSearchParams();
  if (teile.q) p.set("q", teile.q);
  if (teile.status) p.set("status", teile.status);
  if (teile.sort !== "neueste") p.set("sort", teile.sort);
  if (teile.archiv) p.set("archiv", "1");
  const s = p.toString();
  return s ? `/app?${s}` : "/app";
}

export default async function ProjectListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    archiv?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const showArchive = params.archiv === "1";
  const statusFilter = STATUS_WERTE.includes(params.status as ProjectStatus)
    ? (params.status as ProjectStatus)
    : null;
  const sort: SortWert = params.sort === "aelteste" ? "aelteste" : "neueste";
  const locale = toLocale(user.locale);
  const t = getDictionary(locale).projects;

  const conditions = [
    eq(projectsTable.userId, user.id),
    showArchive
      ? isNotNull(projectsTable.archivedAt)
      : isNull(projectsTable.archivedAt),
  ];

  if (statusFilter) {
    conditions.push(eq(projectsTable.status, statusFilter));
  }

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
    .orderBy(
      sort === "aelteste"
        ? asc(projectsTable.createdAt)
        : desc(projectsTable.createdAt),
    );

  const isSearching = query.length > 0;
  const anzahlText = `${projects.length} ${
    projects.length === 1 ? t.anzahlEinzahl : t.anzahlMehrzahl
  }`;

  const chips: { status: ProjectStatus | null; label: string }[] = [
    { status: null, label: t.filterAlle },
    ...STATUS_WERTE.map((s) => ({ status: s as ProjectStatus | null, label: t.status[s] })),
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-schrift">
          {t.title}
        </h1>
        <p className="text-sm text-schrift-tertiaer">{anzahlText}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const aktiv = chip.status === statusFilter;
            return (
              <Link
                key={chip.label}
                href={listenUrl({
                  q: query,
                  status: chip.status,
                  sort,
                  archiv: showArchive,
                })}
                aria-current={aktiv ? "true" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  aktiv
                    ? "bg-akzent text-white shadow-akzent"
                    : "border border-linie bg-flaeche text-schrift-sekundaer hover:text-schrift"
                }`}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SortSelect
            q={query}
            status={statusFilter}
            sort={sort}
            archiv={showArchive}
          />
          <Link
            href={listenUrl({
              q: query,
              status: statusFilter,
              sort,
              archiv: !showArchive,
            })}
            className="text-sm font-medium text-schrift-tertiaer underline-offset-4 transition hover:text-schrift hover:underline"
          >
            {showArchive ? t.showActive : t.showArchive}
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-14 flex flex-col items-center rounded-karte border border-dashed border-linie bg-flaeche px-6 py-16 text-center">
          {isSearching || statusFilter ? (
            <>
              <h2 className="text-lg font-semibold text-schrift">
                {t.noSearchResultsTitle}
              </h2>
              <p className="mt-1 max-w-md text-schrift-sekundaer">
                {t.noSearchResultsText}
              </p>
            </>
          ) : showArchive ? (
            <>
              <h2 className="text-lg font-semibold text-schrift">
                {t.emptyArchiveTitle}
              </h2>
              <p className="mt-1 max-w-md text-schrift-sekundaer">
                {t.emptyArchiveText}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-schrift">
                {t.emptyTitle}
              </h2>
              <p className="mt-1 max-w-md text-schrift-sekundaer">
                {t.emptyText}
              </p>
              <div className="mt-6">
                <NewProjectDialog ctaLabel={t.emptyCta} />
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              locale={locale}
              t={t}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
