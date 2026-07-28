import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { getDictionary, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { AutoRefresh } from "@/components/projekte/AutoRefresh";
import { StatusBadge } from "@/components/projekte/StatusBadge";
import { kategorieSummen } from "@/lib/berechnung/flaechen";
import { ladeTesthaus } from "@/lib/messung/testhaus";
import { formatMm2Roh, formatQuadratfuss } from "@/lib/viewer/anzeige";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kachel der Messwerte-Karte: gerundeter Wert sichtbar, Roh-Wert im
// Tooltip (Eiserne Regel 1: Rundung nur in der Anzeige).
function Kachel({
  label,
  wert,
  wertTitel,
}: {
  label: string;
  wert: string;
  wertTitel?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-neutral-900"
        title={wertTitel}
      >
        {wert}
      </p>
    </div>
  );
}

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

  // Statusabhängige Navigation: draft/files_uploaded/failed → Upload,
  // model_ready → Viewer. processing und Legacy-Status bleiben hier.
  if (
    project.status === "draft" ||
    project.status === "files_uploaded" ||
    project.status === "failed"
  ) {
    redirect(`/app/projekt/${id}/upload`);
  }
  if (project.status === "model_ready") {
    redirect(`/app/projekt/${id}/viewer`);
  }

  const [dateiZeile] = await db
    .select({ anzahl: count() })
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, project.id));
  const dateiAnzahl = dateiZeile?.anzahl ?? 0;

  const dict = getDictionary(toLocale(user.locale));
  const t = dict.projectDetail;
  const mess = ladeTesthaus();
  const summen = kategorieSummen(mess);
  const anzahlFenster = mess.openings.filter(
    (o) => o.type === "window",
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/app"
        className="text-sm font-medium text-neutral-500 underline-offset-4 transition hover:text-neutral-900 hover:underline"
      >
        ← {dict.common.back}
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <StatusBadge status={project.status} labels={dict.projects.status} />
        {project.status === "classified" ? (
          <span className="text-sm text-neutral-500">
            {t.klassifizierungBestanden}
          </span>
        ) : null}
        {project.status === "processing" ? (
          <>
            <span className="text-sm text-neutral-500">{t.messungLaeuft}</span>
            <AutoRefresh />
          </>
        ) : null}
        {project.classification &&
        project.classification.planPagesSelected <
          project.classification.planPagesUsable ? (
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
            {t.seitenNote
              .replace(
                "{classified}",
                String(project.classification.planPagesUsable),
              )
              .replace(
                "{used}",
                String(project.classification.planPagesSelected),
              )}
          </span>
        ) : null}
        {project.archivedAt ? (
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
            {dict.projects.archivedBadge}
          </span>
        ) : null}
      </div>
      {project.adresse ? (
        <p className="mt-1 text-neutral-500">{project.adresse}</p>
      ) : null}

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {/* Fotos & Pläne (Etappe 1: Einstieg in den Upload) */}
        <section className="flex flex-col rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold text-neutral-900">
            {t.cards.dateien.title}
          </h2>
          <p className="mt-1 flex-1 text-sm text-neutral-500">
            {dateiAnzahl === 0
              ? t.cards.dateien.leer
              : `${dateiAnzahl} ${
                  dateiAnzahl === 1
                    ? t.cards.dateien.anzahlEinzahl
                    : t.cards.dateien.anzahlMehrzahl
                }`}
          </p>
          <div className="mt-4">
            <Link
              href={`/app/projekt/${project.id}/upload`}
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {dateiAnzahl === 0
                ? t.cards.dateien.ctaLeer
                : t.cards.dateien.cta}
            </Link>
          </div>
        </section>

        {/* 3D-Modell */}
        <section className="flex flex-col rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-semibold text-neutral-900">
            {t.cards.modell3d.title}
          </h2>
          <div className="mt-4 flex flex-1 items-center justify-center rounded-lg bg-gradient-to-b from-neutral-100 to-neutral-200 py-10">
            {/* Platzhalter-Vorschau: stilisiertes Haus */}
            <svg
              viewBox="0 0 120 90"
              className="h-28 w-auto text-neutral-400"
              aria-hidden="true"
            >
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <path d="M20 48 60 18l40 30" />
                <path d="M28 44v34h64V44" />
                <path d="M50 78V58h20v20" />
                <rect x="36" y="52" width="8" height="8" />
                <rect x="76" y="52" width="8" height="8" />
              </g>
            </svg>
          </div>
          <div className="mt-4">
            <Link
              href="/app/viewer"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {t.cards.modell3d.oeffnen}
            </Link>
          </div>
        </section>

        {/* Messwerte */}
        <section className="flex flex-col rounded-xl border border-neutral-200 bg-white p-6">
          <div>
            <h2 className="font-semibold text-neutral-900">
              {t.cards.messwerte.title}
            </h2>
            <p className="text-xs text-neutral-400">{t.cards.messwerte.quelle}</p>
          </div>
          <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
            <Kachel
              label={t.cards.messwerte.dach}
              wert={formatQuadratfuss(summen.dachMm2)}
              wertTitel={formatMm2Roh(summen.dachMm2)}
            />
            <Kachel
              label={t.cards.messwerte.wandflaeche}
              wert={formatQuadratfuss(summen.waendeNettoMm2)}
              wertTitel={formatMm2Roh(summen.waendeNettoMm2)}
            />
            <Kachel
              label={t.cards.messwerte.fenster}
              wert={`${anzahlFenster}`}
            />
            <Link
              href="/app/viewer"
              className="group rounded-lg border border-neutral-200 bg-neutral-50 p-4 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              <p className="text-xs font-medium text-neutral-500">
                {t.cards.messwerte.gesamt}
              </p>
              <p className="mt-1 text-sm font-medium text-neutral-700 group-hover:text-neutral-900">
                {t.cards.messwerte.gesamtText} →
              </p>
            </Link>
          </div>
          <div className="mt-4">
            <button
              type="button"
              disabled
              title={t.placeholderHint}
              className="inline-flex cursor-not-allowed items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-400"
            >
              {t.cards.messwerte.pdf}
            </button>
            <span className="ml-3 text-xs text-neutral-400">
              {t.placeholderHint}
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
