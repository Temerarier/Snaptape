export type ProjectMeasurementStateKind =
  | "processing"
  | "failed"
  | "ready"
  | "unavailable";

export function projectMeasurementState(
  status: string,
): ProjectMeasurementStateKind {
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "model_ready") return "ready";
  return "unavailable";
}