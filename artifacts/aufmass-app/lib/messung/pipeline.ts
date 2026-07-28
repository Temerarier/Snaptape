// Messpipeline (Etappe 2, Skelett): läuft nach bestandener
// Klassifizierung im Hintergrund. Extrahieren (Stub) → gegen den
// v1.5-Vertrag validieren → Ergebnis nur anwenden, wenn das Projekt
// noch zu genau diesem Lauf gehört. Jeder Lauf hinterlässt eine
// Protokollzeile in measure_runs – auch veraltete.
import { and, eq } from "drizzle-orm";
import {
  db,
  measureRunsTable,
  projectsTable,
  type ProjectClassification,
  type ProjectFile,
} from "@workspace/db";
import { validateMeasurement } from "@workspace/measurement";
import { standardExtraktor } from "./extraktor";

// Ajv-Fehler in lesbare Sätze übersetzen (für Anzeige + Protokoll).
function lesbareFehler(
  fehler: { instancePath?: string; message?: string }[],
): string[] {
  return fehler.map((f) => {
    const pfad = f.instancePath && f.instancePath !== "" ? f.instancePath : "(root)";
    return `${pfad}: ${f.message ?? "invalid"}`;
  });
}

export async function fuehreMessLaufAus(args: {
  projektId: string;
  runId: string;
  quality: "standard" | "premium";
  klassifizierung: ProjectClassification;
  dateien: ProjectFile[];
}): Promise<void> {
  const start = Date.now();
  let roh: unknown = null;
  let fehlerListe: string[] = [];
  let warnungen: string[] = [];
  let ausgang: "model_ready" | "failed" = "failed";

  try {
    roh = await standardExtraktor(args.dateien, args.klassifizierung, {
      quality: args.quality,
    });
    const validierung = validateMeasurement(roh);
    if (validierung.valid) {
      ausgang = "model_ready";
      const q = (roh as { quality?: { warnings?: unknown } }).quality;
      warnungen = Array.isArray(q?.warnings)
        ? q.warnings.filter((w): w is string => typeof w === "string")
        : [];
    } else {
      fehlerListe = lesbareFehler(validierung.errors ?? []);
    }
  } catch (fehler) {
    // Extraktor selbst gescheitert: explizit als failed protokollieren.
    fehlerListe = [fehler instanceof Error ? fehler.message : String(fehler)];
    console.error(`Messlauf ${args.runId} (Projekt ${args.projektId}):`, fehler);
  }

  // Guard: nur schreiben, wenn das Projekt noch auf "processing" steht
  // UND unsere Run-ID trägt. So können parallele Projekte und veraltete
  // Läufe (z. B. nach Datei-Änderungen) nichts überschreiben/vermischen.
  const guard = and(
    eq(projectsTable.id, args.projektId),
    eq(projectsTable.currentRunId, args.runId),
    eq(projectsTable.status, "processing"),
  );
  const angewendet = await db
    .update(projectsTable)
    .set(
      ausgang === "model_ready"
        ? {
            status: "model_ready" as const,
            measurement: roh,
            measurementErrors: null,
            currentRunId: null,
          }
        : {
            status: "failed" as const,
            measurement: null,
            measurementErrors: fehlerListe,
            currentRunId: null,
          },
    )
    .where(guard)
    .returning({ id: projectsTable.id });
  if (angewendet.length === 0) {
    warnungen = [
      ...warnungen,
      "stale run: project changed while measuring, result was not applied",
    ];
  }

  await db.insert(measureRunsTable).values({
    projectId: args.projektId,
    schemaVersion: "1.5",
    measureJson: roh,
    quality: args.quality,
    durationMs: Date.now() - start,
    outcome: ausgang,
    warnings: warnungen,
    errors: fehlerListe,
  });
}
