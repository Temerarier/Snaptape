import Link from "next/link";
import type { Project } from "@workspace/db";
import { de } from "@/i18n/de";
import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/lib/projekte/actions";
import { StatusBadge } from "./StatusBadge";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function ProjectCard({ project }: { project: Project }) {
  const t = de.projects;
  const isArchived = project.archivedAt !== null;

  return (
    <li className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/app/projekt/${project.id}`}
          className="min-w-0 flex-1"
        >
          <h2 className="truncate font-semibold text-neutral-900">
            {project.name}
          </h2>
          {project.adresse ? (
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {project.adresse}
            </p>
          ) : null}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={project.status} />
          {isArchived ? (
            <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
              {t.archivedBadge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
        <p className="text-xs text-neutral-400">
          {t.createdAtPrefix} {formatDate(project.createdAt)}
        </p>
        {isArchived ? (
          <form action={restoreProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              {t.restore}
            </button>
          </form>
        ) : (
          <form action={archiveProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              {t.archive}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
