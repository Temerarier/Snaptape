// Projektkarte im Snaptape-Stil: 3D-Thumbnail-Platzhalter, Name +
// Status-Badge, Adresse, Datum. Klick auf die Karte öffnet direkt das
// 3D-Modell; Archivieren steckt im kleinen Karten-Menü (⋯).
// Server-Komponente: Sprache und Texte kommen als Props von der Seite.
import Link from "next/link";
import type { Project } from "@workspace/db";
import type { Dictionary, Locale } from "@/i18n";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProjectCardMenu } from "./ProjectCardMenu";
import { StatusBadge } from "./StatusBadge";

// Datumsformat je Sprache: en-US → MM/DD/YYYY, de-DE → DD.MM.YYYY.
function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function ProjectCard({
  project,
  locale,
  t,
}: {
  project: Project;
  locale: Locale;
  t: Dictionary["projects"];
}) {
  const isArchived = project.archivedAt !== null;

  return (
    <li className="list-none">
      <Card className="relative flex h-full flex-col transition hover:shadow-md">
        {/* Unsichtbarer Flächen-Link: ganze Karte öffnet das Projekt;
            die Detailseite leitet statusabhängig weiter (Upload/Viewer). */}
        <Link
          href={`/app/projekt/${project.id}`}
          aria-label={project.name}
          className="absolute inset-0 rounded-karte"
        />
        <div className="schraffur flex h-40 items-center justify-center overflow-hidden rounded-eingabe border border-linie">
          <span className="rounded-full bg-flaeche px-3 py-1 font-mono text-xs text-schrift-tertiaer">
            {t.thumbnailPlatzhalter}
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate font-semibold text-schrift">
            {project.name}
          </h2>
          <div className="relative z-10 flex shrink-0 items-center gap-1">
            <StatusBadge status={project.status} labels={t.status} />
            <ProjectCardMenu projektId={project.id} archiviert={isArchived} />
          </div>
        </div>
        {project.adresse ? (
          <p className="mt-0.5 truncate text-sm text-schrift-sekundaer">
            {project.adresse}
          </p>
        ) : null}
        {isArchived ? (
          <div className="mt-2">
            <Badge variante="neutral">{t.archivedBadge}</Badge>
          </div>
        ) : null}
        <p className="mt-auto pt-3 text-xs text-schrift-tertiaer">
          {formatDate(project.createdAt, locale)}
        </p>
      </Card>
    </li>
  );
}
