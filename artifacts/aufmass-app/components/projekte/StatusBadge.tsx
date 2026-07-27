// Status-Badge auf Basis des Design-Systems: Fertig = grün (ok),
// In Prüfung = amber (warnung), Entwurf = grau (neutral), Fehler = rot.
// Server-Komponente ohne Kontext: Die Labels kommen als Prop aus dem
// Wörterbuch des Aufrufers (Dictionary["projects"]["status"]).
import type { ProjectStatus } from "@workspace/db";
import type { Dictionary } from "@/i18n";
import { Badge } from "@/components/ui/Badge";

const VARIANTEN: Record<
  ProjectStatus,
  "neutral" | "akzent" | "warnung" | "ok" | "fehler"
> = {
  draft: "neutral",
  files_uploaded: "akzent",
  processing: "warnung",
  model_ready: "ok",
  reviewing: "warnung",
  ready: "ok",
  failed: "fehler",
};

export function StatusBadge({
  status,
  labels,
}: {
  status: ProjectStatus;
  labels: Dictionary["projects"]["status"];
}) {
  return <Badge variante={VARIANTEN[status]}>{labels[status]}</Badge>;
}
