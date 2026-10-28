import type { Model3dReport } from "@workspace/db";

export interface CostSum { known: number; unknown: number }
export function addCost(sum: CostSum, cost: number | null): CostSum {
  return cost === null || !Number.isFinite(cost)
    ? { known: sum.known, unknown: sum.unknown + 1 }
    : { known: sum.known + cost, unknown: sum.unknown };
}
export function formatAuditCost(sum: CostSum, partial: string): string {
  return `${sum.unknown ? "≥ " : ""}$${sum.known.toFixed(3)}${sum.unknown ? ` (${partial})` : ""}`;
}
export interface ModelRunSummary {
  id: string; projectId: string; model: string; stufe: "ok" | "merken" | "stopp";
  korrekturGenutzt: boolean; costUsd: number | null;
}
/** Rows must be newest first, including correction attempts. No join fan-out. */
export function summarizeModelRuns(rows: readonly ModelRunSummary[]) {
  const result = new Map<string, { latest: ModelRunSummary; cost: CostSum }>();
  for (const row of rows) {
    const group = result.get(row.projectId) ?? { latest: row, cost: { known: 0, unknown: 0 } };
    group.cost = addCost(group.cost, row.costUsd);
    result.set(row.projectId, group);
  }
  return result;
}
export function model3dState(status: string | null, report: Model3dReport | null, latest?: ModelRunSummary) {
  if (status === "pending") return "pending";
  return report?.stufe ?? (status === "unavailable" ? "stopp" : latest?.stufe ?? "—");
}
export function isModel3dIssue(status: string) {
  return status === "merken" || status === "stopp";
}
export function groupedChecks(report: Model3dReport | null) {
  const rows = report?.zeilen ?? [];
  return [
    { status: "stopp", rows: rows.filter(row => row.status === "fail") },
    { status: "merken", rows: rows.filter(row => row.status === "warn") },
    { status: "info", rows: rows.filter(row => row.status === "info") },
  ];
}
