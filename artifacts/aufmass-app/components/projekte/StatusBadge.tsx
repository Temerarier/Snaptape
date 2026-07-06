import type { ProjectStatus } from "@workspace/db";
import { de } from "@/i18n/de";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  entwurf: "bg-neutral-100 text-neutral-700 border-neutral-200",
  in_pruefung: "bg-amber-50 text-amber-700 border-amber-200",
  fertig: "bg-green-50 text-green-700 border-green-200",
  fehler: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {de.projects.status[status]}
    </span>
  );
}
