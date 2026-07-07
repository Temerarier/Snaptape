// Status-Badge auf Basis des Design-Systems: Fertig = grün (ok),
// In Prüfung = amber (warnung), Entwurf = grau (neutral), Fehler = rot.
import type { ProjectStatus } from "@workspace/db";
import { de } from "@/i18n/de";
import { Badge } from "@/components/ui/Badge";

const VARIANTEN: Record<
  ProjectStatus,
  "neutral" | "warnung" | "ok" | "fehler"
> = {
  entwurf: "neutral",
  in_pruefung: "warnung",
  fertig: "ok",
  fehler: "fehler",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variante={VARIANTEN[status]}>{de.projects.status[status]}</Badge>;
}
