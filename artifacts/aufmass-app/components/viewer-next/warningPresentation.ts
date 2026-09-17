import type { ModelDiagnostic } from "@/lib/viewer-next/model/types";

export interface ViewerWarningLabels {
  readonly approximatedLayout: string;
  readonly omittedElements: string;
  readonly missingDimensions: string;
  readonly modelFailure: string;
}

type WarningCategory = keyof ViewerWarningLabels;

/**
 * Model notes are implementation diagnostics. Keep them in the model report,
 * but expose only a small, user-facing category summary in the panel.
 */
export function presentViewerWarnings(
  sourceWarnings: readonly string[],
  modelDiagnostics: readonly ModelDiagnostic[],
  modelNotes: readonly string[],
  labels: ViewerWarningLabels,
): string[] {
  const categories = new Set<WarningCategory>();
  for (const diagnostic of modelDiagnostics) {
    if (diagnostic.category === "inference") categories.add("approximatedLayout");
    if (
      diagnostic.category === "omission" ||
      diagnostic.category === "unsupported" ||
      diagnostic.category === "ambiguity"
    ) {
      categories.add("omittedElements");
    }
    if (diagnostic.category === "model_failure") categories.add("modelFailure");
  }
  for (const note of modelNotes) {
    const normalized = note.toLowerCase();
    if (
      /missing\s+(?:width|depth|height)|missing\s+\w+\s+dimension/.test(normalized)
    ) {
      categories.add("missingDimensions");
    }
    if (
      /omitted|no unambiguous|unsupported face class|degraded to massing/.test(normalized)
    ) {
      categories.add("omittedElements");
    }
    if (/position inferred|no parent_face_id|inferred at the centre/.test(normalized)) {
      categories.add("approximatedLayout");
    }
  }

  const modelWarnings = (Object.keys(labels) as WarningCategory[])
    .filter(category => categories.has(category))
    .slice(0, 3)
    .map(category => labels[category]);
  return Array.from(new Set([...sourceWarnings, ...modelWarnings]));
}