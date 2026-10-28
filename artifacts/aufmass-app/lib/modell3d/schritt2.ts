import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db, projectsTable, modelRunsTable,
  type ProjectFile, type Model3dCheck, type Model3dReport, type Model3dData,
} from "@workspace/db";
import {
  MESS_MODELL, ModellAntwortFehler, rufeMessModell, schaetzeKostenUsd,
  type ModellOptionen, type BildTeil,
} from "@/lib/messung/modelle";
import { baueBildTeile } from "@/lib/messung/echterExtraktor";
import { measurementToMess, pruefen } from "./coreHost";
import { extrahiereBuildHouse } from "./extract";
import { baueKorrekturPrompt, ladeBuildhousePrompt } from "./prompts";
import { fuehreSandboxAus, leeresModell } from "./sandbox";

export const SCHRITT2_MODELL = process.env.SCHRITT2_MODELL ?? MESS_MODELL;
export const SCHRITT2_EFFORT = (process.env.SCHRITT2_EFFORT ?? "medium") as NonNullable<ModellOptionen["effort"]>;

export function stoppReport(error: string): Model3dCheck {
  return { stufe: "stopp", zahlen: {}, zeilen: [{ id: "–", pruefung: "Modell", status: "fail", text: error }] };
}
export function pendingReport(measureRunId: string): Model3dReport {
  return {
    ...stoppReport("3D-Modell wird erstellt"), korrektur_genutzt: false,
    modell: SCHRITT2_MODELL, effort: SCHRITT2_EFFORT, measure_run_id: measureRunId,
  };
}
// Step 1 deliberately clears currentRunId. A private report token binds step 2
// to its committed measure_runs row without changing that step-1 contract.
export function modellGuard(projektId: string, measureRunId: string) {
  return and(
    eq(projectsTable.id, projektId), eq(projectsTable.status, "model_ready"),
    isNull(projectsTable.currentRunId), eq(projectsTable.model3dStatus, "pending"),
    sql`${projectsTable.model3dReport}->>'measure_run_id' = ${measureRunId}`,
  );
}
type Args = { projektId: string; measureRunId: string; dateien: ProjectFile[] };
// Server-only dependency injection permits offline integration tests without a
// provider client; no route/action accepts these dependencies from a browser.
type Dependencies = {
  modelCall?: typeof rufeMessModell;
  loadImages?: (files: ProjectFile[]) => Promise<BildTeil[]>;
};
export async function fuehreModellLaufAus(args: Args, dependencies: Dependencies = {}): Promise<void> {
  const startedAt = Date.now();
  const guard = modellGuard(args.projektId, args.measureRunId);
  const isCurrent = async () => (await db.select({ id: projectsTable.id }).from(projectsTable).where(guard).limit(1)).length > 0;
  let report = pendingReport(args.measureRunId);
  let finalResult: Model3dData | null = null;
  let correction = false;
  try {
    const [project] = await db.select({ measurement: projectsTable.measurement }).from(projectsTable).where(guard).limit(1);
    if (!project) return;
    if (!["low", "medium", "high", "xhigh", "max"].includes(SCHRITT2_EFFORT)) throw new Error("Invalid SCHRITT2_EFFORT");
    const measurement = project.measurement;
    if (measurement === null) throw new Error("Gespeicherte Messung fehlt");
    const mess = measurementToMess(measurement);
    const bilder = await (dependencies.loadImages ?? baueBildTeile)(args.dateien);
    const system = ladeBuildhousePrompt();
    let userText = "MEASUREMENT:\n" + JSON.stringify(measurement);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!await isCurrent()) return;
      correction = attempt === 1;
      const started = Date.now();
      let code: string | null = null;
      let sandboxMs = 0;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let costUsd: number | null = null;
      let result = leeresModell("Keine Funktion buildHouse in der Antwort");
      let check: Model3dCheck;
      let exception: string | undefined;
      let antwort: unknown;
      try {
        const response = await (dependencies.modelCall ?? rufeMessModell)({ system, userText, bilder }, {
          model: SCHRITT2_MODELL, effort: SCHRITT2_EFFORT,
        });
        inputTokens = response.inputTokens;
        outputTokens = response.outputTokens;
        costUsd = schaetzeKostenUsd(inputTokens, outputTokens);
        antwort = response.diagnostic;
        try { code = extrahiereBuildHouse(response.text); }
        catch { code = null; } // A missing function is STOP, with one correction.
        if (code !== null) {
          const execution = await fuehreSandboxAus(mess, code);
          result = execution.result;
          sandboxMs = execution.sandboxMs;
        }
        check = pruefen(mess, result);
        if (code === null) check = stoppReport("Keine Funktion buildHouse in der Antwort");
      } catch (error) {
        exception = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
        if (error instanceof ModellAntwortFehler) {
          antwort = error.diagnostic;
          inputTokens = error.diagnostic.inputTokens;
          outputTokens = error.diagnostic.outputTokens;
          costUsd = schaetzeKostenUsd(inputTokens, outputTokens);
        }
        check = stoppReport(exception);
      }
      report = {
        ...check, korrektur_genutzt: correction, modell: SCHRITT2_MODELL,
        effort: SCHRITT2_EFFORT, measure_run_id: args.measureRunId,
        usageComplete: inputTokens !== null && outputTokens !== null,
        ...(exception ? { error: exception } : {}), ...(antwort ? { antwort } : {}),
      };
      await db.insert(modelRunsTable).values({
        projectId: args.projektId, measureRunId: args.measureRunId, model: SCHRITT2_MODELL,
        effort: SCHRITT2_EFFORT, stufe: check.stufe, korrekturGenutzt: correction,
        inputTokens, outputTokens, costUsd, durationMs: Date.now() - started,
        sandboxMs, codeChars: code?.length ?? 0, report, aiCode: code,
      });
      if (exception) break;
      if (check.stufe !== "stopp") { finalResult = result; break; }
      if (attempt === 0) userText = baueKorrekturPrompt(check, code ?? "");
    }
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
    report = { ...pendingReport(args.measureRunId), ...stoppReport(message), error: message, korrektur_genutzt: correction };
    finalResult = null;
  }
  // No measurement/status/credit fields are ever written by step 2.
  report = { ...report, duration_ms: Date.now() - startedAt };
  await db.update(projectsTable).set({
    model3d: finalResult, model3dStatus: finalResult === null ? "unavailable" : "ready", model3dReport: report,
  }).where(guard);
}
