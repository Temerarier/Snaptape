import Link from "next/link";
import { and, asc, desc, eq, ilike, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { NewProjectDialog } from "@/components/projekte/NewProjectDialog";
import { ProjectCard } from "@/components/projekte/ProjectCard";
import { SortSelect } from "@/components/projekte/SortSelect";
import { CreditsPill } from "@/components/credits/CreditsPill";
import { holeGuthaben } from "@/lib/credits/service";
import { raeumeHaengendeMessungenAuf } from "@/lib/messung/aufraeumen";

type SortWert = "neueste" | "aelteste";

// Baut die Listen-URL und erhält dabei Suche/Sortierung/Archiv-Ansicht.
function listenUrl(teile: {
  q: string;
  sort: SortWert;
  archiv: boolean;
}): string {
  const p = new URLSearchParams();
  if (teile.q) p.set("q", teile.q);
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
  await raeumeHaengendeMessungenAuf(user.id);
  const guthaben = await holeGuthaben(user.id);
  const supportEmail = process.env.SUPPORT_EMAIL || null;
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const showArchive = params.archiv === "1";
  const sort: SortWert = params.sort === "aelteste" ? "aelteste" : "neueste";
  const locale = toLocale(user.locale);
  const t = getDictionary(locale).projects;

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
    .select({
      id: projectsTable.id, name: projectsTable.name, adresse: projectsTable.adresse,
      status: projectsTable.status, archivedAt: projectsTable.archivedAt, createdAt: projectsTable.createdAt,
      // One scalar subquery, not one DB request per card. The delivery route
      // still checks the session and ownership; never expose storage paths.
      previewUrl: sql<string | null>`(
        select case
          when f.kind = 'pdf' and jsonb_array_length(coalesce(f.page_image_paths, '[]'::jsonb)) > 0
            then '/dateien/' || f.id || '?v=seite&nr=1'
          when f.preview_path is not null then '/dateien/' || f.id || '?v=vorschau'
          else null end
        from project_files f where f.project_id = ${sql.identifier("projects")}.${sql.identifier("id")}
        order by f.created_at asc, f.id asc limit 1
      )`,
    })
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-schrift">
          {t.title}
        </h1>
        <p className="text-sm text-schrift-tertiaer">{anzahlText}</p>
        <div className="ml-auto">
          <CreditsPill label={getDictionary(locale).upload.credits.pill} guthaben={guthaben} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SortSelect
            q={query}
            sort={sort}
            archiv={showArchive}
          />
          <Link
            href={listenUrl({
              q: query,
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
          {isSearching ? (
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
                {guthaben <= 0 ? t.willkommenTitel : t.emptyTitle}
              </h2>
              <p className="mt-1 max-w-md text-schrift-sekundaer">
                {guthaben <= 0 ? t.willkommenKeineCredits : t.emptyText}
              </p>
              {guthaben <= 0 && supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="mt-2 text-sm font-medium text-akzent underline-offset-4 hover:underline"
                >
                  {t.willkommenSupport} {supportEmail}.
                </a>
              ) : null}
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
