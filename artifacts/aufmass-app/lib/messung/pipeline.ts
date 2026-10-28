// Messpipeline: läuft nach bestandener Klassifizierung im Hintergrund.
// Extrahieren (echt oder Stub) → gegen den Measurement-Vertrag validieren →
// Ergebnis nur anwenden, wenn das Projekt noch zu genau diesem Lauf
// gehört. Jeder Lauf hinterlässt eine Protokollzeile in measure_runs –
// auch veraltete – inkl. Modell, Route, Tokens, Kosten und Kennzahlen.
import { and, eq } from "drizzle-orm";
import {
  db,
  measureRunsTable,
  projectsTable,
  usersTable,
  type ProjectClassification,
  type ProjectFile,
} from "@workspace/db";
import { validateMeasurement } from "@workspace/measurement";
import { heileNullFelder } from "./berechnung";
import { ExtraktionsFehler } from "./echterExtraktor";
import { standardExtraktor, type ExtraktionsErgebnis } from "./extraktor";
import type { NutzerReferenz } from "./prompts";
import { erstatteMessung } from "@/lib/credits/service";
import { MESS_MODELL } from "./modelle";
import { fuehreModellLaufAus, pendingReport, modellGuard, stoppReport } from "@/lib/modell3d/schritt2";

// Ajv-Fehler in lesbare Sätze übersetzen (für Anzeige + Protokoll).
function lesbareFehler(
  fehler: { instancePath?: string; message?: string }[],
): string[] {
  return fehler.map((f) => {
    const pfad = f.instancePath && f.instancePath !== "" ? f.instancePath : "(root)";
    return `${pfad}: ${f.message ?? "invalid"}`;
  });
}

// Kennzahlen fürs Protokoll aus dem validierten Measurement ziehen.
// Fehlende Werte bleiben null – keine stillen Ersatzwerte.
function kennzahlen(roh: unknown): {
  roofAreaMm2: number | null;
  netWallAreaMm2: number | null;
  openingCount: number | null;
} {
  const r = roh as {
    faces?: unknown;
    openings?: unknown;
  };
  const faces = Array.isArray(r?.faces) ? r.faces : null;
  const openings = Array.isArray(r?.openings) ? r.openings : null;
  const wert = (m: unknown): number | null =>
    m && typeof m === "object" && typeof (m as { value?: unknown }).value === "number"
      ? ((m as { value: number }).value)
      : null;
  let roof: number | null = null;
  let wandNetto: number | null = null;
  if (faces) {
    for (const f of faces as { face_class?: string; area_mm2?: unknown; net_area_mm2?: unknown }[]) {
      if (f?.face_class === "roof_face") {
        const a = wert(f.area_mm2);
        if (a !== null) roof = (roof ?? 0) + a;
      } else if (f?.face_class === "wall") {
        const n = wert(f.net_area_mm2);
        if (n !== null) wandNetto = (wandNetto ?? 0) + n;
      }
    }
  }
  return {
    roofAreaMm2: roof,
    netWallAreaMm2: wandNetto,
    openingCount: openings ? openings.length : null,
  };
}

// Das Laufprotokoll beschreibt genau das erhaltene JSON. Insbesondere bei
// fehlgeschlagenen Extraktionen darf es keine erfundene Schema-Version
// behaupten.
export function schemaVersionFuerProtokoll(roh: unknown): string {
  if (!roh || typeof roh !== "object") return "unknown";
  const meta = (roh as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return "unknown";
  const schemaVersion = (meta as { schema_version?: unknown }).schema_version;
  return typeof schemaVersion === "string" && schemaVersion.trim() !== ""
    ? schemaVersion
    : "unknown";
}

export async function fuehreMessLaufAus(args: {
  projektId: string;
  runId: string;
  quality: "standard" | "premium";
  creditLedgerId?: string;
  klassifizierung: ProjectClassification;
  dateien: ProjectFile[];
  referenz?: NutzerReferenz | null;
}): Promise<void> {
  const start = Date.now();
  let ergebnis: ExtraktionsErgebnis | null = null;
  // Metadaten gescheiterter Extraktionen (Tokens/Kosten fielen trotzdem an).
  let fehlerMeta: ExtraktionsFehler["meta"] | null = null;
  let roh: unknown = null;
  let fehlerListe: string[] = [];
  let warnungen: string[] = [];
  let ausgang: "model_ready" | "failed" = "failed";

  // Referenzmaß nachladen, falls der Aufrufer es nicht mitgibt (das
  // Projekt speichert es seit Etappe 1).
  let referenz = args.referenz ?? null;
  if (args.referenz === undefined) {
    const [projekt] = await db
      .select({
        referenceObject: projectsTable.referenceObject,
        referenceValue: projectsTable.referenceValue,
        referenceUnit: projectsTable.referenceUnit,
      })
      .from(projectsTable)
      .where(eq(projectsTable.id, args.projektId));
    if (
      projekt?.referenceObject &&
      typeof projekt.referenceValue === "number" &&
      projekt.referenceUnit
    ) {
      referenz = {
        objekt: projekt.referenceObject,
        wert: projekt.referenceValue,
        einheit: projekt.referenceUnit,
      };
    }
  }

  try {
    ergebnis = await standardExtraktor(args.dateien, args.klassifizierung, {
      quality: args.quality,
      referenz,
    });
    roh = ergebnis.roh;
    let validierung = validateMeasurement(roh);
    if (!validierung.valid) {
      // A1: genau EINE Heilungsrunde – null-Werte in optionalen Feldern
      // entfernen (Arrays -> []) und ein zweites Mal validieren.
      const geheilt = heileNullFelder(roh, validierung.errors ?? []);
      if (geheilt > 0) validierung = validateMeasurement(roh);
    }
    if (validierung.valid && roh !== null) {
      ausgang = "model_ready";
      const q = (roh as { quality?: { warnings?: unknown } }).quality;
      warnungen = Array.isArray(q?.warnings)
        ? q.warnings.filter((w): w is string => typeof w === "string")
        : [];
    } else {
      fehlerListe = roh === null ? ["Measurement returned null"] : lesbareFehler(validierung.errors ?? []);
    }
  } catch (fehler) {
    // Extraktor selbst gescheitert: explizit als failed protokollieren.
    if (fehler instanceof ExtraktionsFehler) fehlerMeta = fehler.meta;
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
  const appliedMeasureRunId = await db.transaction(async (tx) => {
  const [owner] = await tx.select({ userId: projectsTable.userId }).from(projectsTable).where(eq(projectsTable.id, args.projektId));
  if (owner) await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, owner.userId)).for("update");
  const angewendet = await tx
    .update(projectsTable)
    .set(
      ausgang === "model_ready"
        ? {
            status: "model_ready" as const,
            measurement: roh,
            measurementErrors: null,
            currentRunId: null,
            processingSince: null,
            currentCreditLedgerId: null,
          }
        : {
            status: "failed" as const,
            measurement: null,
            measurementErrors: fehlerListe,
            currentRunId: null,
            processingSince: null,
            currentCreditLedgerId: null,
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

  const zahlen = ausgang === "model_ready" ? kennzahlen(roh) : {
    roofAreaMm2: null,
    netWallAreaMm2: null,
    openingCount: null,
  };
  const [run] = await tx.insert(measureRunsTable).values({
    projectId: args.projektId,
    schemaVersion: schemaVersionFuerProtokoll(roh),
    measureJson: roh,
    quality: "premium",
    durationMs: Date.now() - start,
    outcome: ausgang,
    warnings: warnungen,
    errors: fehlerListe,
    model: ergebnis?.model ?? fehlerMeta?.model ?? MESS_MODELL,
    route: ergebnis?.route ?? fehlerMeta?.route ?? null,
    inputTokens: ergebnis?.inputTokens ?? fehlerMeta?.inputTokens ?? null,
    outputTokens: ergebnis?.outputTokens ?? fehlerMeta?.outputTokens ?? null,
    costUsd: ergebnis?.costUsd ?? fehlerMeta?.costUsd ?? null,
    retryUsed: ergebnis?.retryUsed ?? fehlerMeta?.retryUsed ?? null,
    repairUsed: ergebnis?.repairUsed ?? fehlerMeta?.repairUsed ?? null,
    modelDiagnostics: ergebnis?.modelDiagnostics ?? fehlerMeta?.modelDiagnostics ?? null,
    roofAreaMm2: zahlen.roofAreaMm2,
    netWallAreaMm2: zahlen.netWallAreaMm2,
    openingCount: zahlen.openingCount,
  }).returning({ id: measureRunsTable.id });
  // Superseded runs never refund: only the still-current guarded run owns
  // the debit; timeout cleanup may already have refunded that same charge.
  if (ausgang === "failed" && angewendet.length > 0 && args.creditLedgerId) {
    await erstatteMessung(tx, args.creditLedgerId, run!.id, "measurement failed");
  }
  if (ausgang === "model_ready" && angewendet.length > 0) {
    await tx.update(projectsTable).set({
      model3d: null, model3dStatus: "pending", model3dReport: pendingReport(run!.id),
    }).where(eq(projectsTable.id, args.projektId));
    return run!.id;
  }
  return null;
  });
  // Commit step 1 before starting the optional 3D extra. Its failure must never
  // enter the step-1 failure/refund branch.
  if (appliedMeasureRunId) {
    try {
      await fuehreModellLaufAus({ projektId: args.projektId, measureRunId: appliedMeasureRunId, dateien: args.dateien });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
      await db.update(projectsTable).set({
        model3d: null, model3dStatus: "unavailable",
        model3dReport: { ...pendingReport(appliedMeasureRunId), ...stoppReport(message), error: message },
      }).where(modellGuard(args.projektId, appliedMeasureRunId));
    }
  }
}
