// One explicitly authorized development acceptance run. Never auto-retry this script.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  db, pool, projectsTable, projectFilesTable, creditLedgerTable,
  measureRunsTable, modelRunsTable,
} from "@workspace/db";
import { holeGuthaben, verbucheMessung } from "../lib/credits/service";
import { dateiFuerPfad, getPrivateObjectDir } from "../lib/storage/objectStorage";
import { fuehreMessLaufAus } from "../lib/messung/pipeline";
import { MESS_MODELL, MESS_EFFORT } from "../lib/messung/modelle";
import { SCHRITT2_MODELL, SCHRITT2_EFFORT } from "../lib/modell3d/schritt2";

const sourceId = "dbc4aede-680e-4747-992e-0d69a19e1cfa";
// Fixed ID deliberately prevents a second paid run after restart or accidental rerun.
const copyId = "0782db46-7e84-4996-a149-e08f7c6a4baf";
const evidencePath = "docs/step2-live-verification.json";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function sourceSnapshot() {
  return {
    project: await db.select().from(projectsTable).where(eq(projectsTable.id, sourceId)),
    files: await db.select().from(projectFilesTable).where(eq(projectFilesTable.projectId, sourceId)),
    ledger: await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.projectId, sourceId)),
    measures: await db.select().from(measureRunsTable).where(eq(measureRunsTable.projectId, sourceId)),
  };
}

async function main() {
  assert.equal(process.env.EXTRAKTOR_STUB === "1", false, "Real extraction required");
  assert.equal((await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(eq(projectsTable.id, copyId))).length, 0, "Acceptance copy already exists; DO NOT repeat");
  const original = await sourceSnapshot();
  const source = original.project[0];
  assert.ok(source?.classification, "Existing classification required");
  assert.equal(original.files.length, 7);
  const balanceBefore = await holeGuthaben(source.userId);
  assert.ok(balanceBefore >= 1, "No measurement credit");
  const startedAt = new Date().toISOString();
  const base = { sourceProjectId: sourceId, projectId: copyId, startedAt,
    measurementModel: MESS_MODELL, measurementEffort: MESS_EFFORT,
    step2Model: SCHRITT2_MODELL, step2Effort: SCHRITT2_EFFORT, balanceBefore };
  await db.insert(projectsTable).values({
    id: copyId, userId: source.userId, name: "Schritt-2-Abnahme – separate Testkopie",
    adresse: source.adresse, quality: source.quality, status: "classified",
    classification: source.classification, referenceObject: source.referenceObject,
    referenceValue: source.referenceValue, referenceUnit: source.referenceUnit,
  });
  await writeFile(evidencePath, JSON.stringify({ ...base, state: "copying", paidRunStarted: false }, null, 2) + "\n");
  const copiedPaths = new Map<string, string>();
  async function copyObject(path: string | null): Promise<string | null> {
    if (!path) return null;
    const existing = copiedPaths.get(path);
    if (existing) return existing;
    const target = `${getPrivateObjectDir()}/projekte/${copyId}/abnahme/${randomUUID()}-${path.split("/").pop()}`;
    await dateiFuerPfad(path).copy(dateiFuerPfad(target), { preconditionOpts: { ifGenerationMatch: 0 } });
    copiedPaths.set(path, target);
    return target;
  }
  for (const file of original.files) {
    await db.insert(projectFilesTable).values({
      ...file, id: randomUUID(), projectId: copyId, createdAt: new Date(),
      storagePath: (await copyObject(file.storagePath))!,
      previewPath: await copyObject(file.previewPath),
      pageImagePaths: file.pageImagePaths
        ? await Promise.all(file.pageImagePaths.map(async p => (await copyObject(p))!)) : null,
    });
  }
  const files = await db.select().from(projectFilesTable).where(eq(projectFilesTable.projectId, copyId));
  assert.equal(files.length, 7);
  assert.ok(files.every(f => !original.files.some(old => old.storagePath === f.storagePath)));
  const runId = randomUUID();
  const creditLedgerId = await db.transaction(async tx => {
    const debit = await verbucheMessung(source.userId, copyId, tx);
    await tx.update(projectsTable).set({
      status: "processing", currentRunId: runId, currentCreditLedgerId: debit, processingSince: new Date(),
    }).where(eq(projectsTable.id, copyId));
    return debit;
  });
  await writeFile(evidencePath, JSON.stringify({ ...base, state: "running", runId,
    copiedObjects: copiedPaths.size, paidRunStarted: true }, null, 2) + "\n");
  console.log(JSON.stringify({ event: "AUTHORIZED_LIVE_RUN_STARTED", projectId: copyId, runId,
    measurementModel: MESS_MODELL, step2Model: SCHRITT2_MODELL }));
  // Application's real pipeline, credit/refund handling, provider and isolate; no dependency injection.
  await fuehreMessLaufAus({
    projektId: copyId, runId, quality: source.quality, creditLedgerId,
    klassifizierung: source.classification, dateien: files,
  });
  const [done] = await db.select().from(projectsTable).where(eq(projectsTable.id, copyId));
  const measures = await db.select().from(measureRunsTable).where(eq(measureRunsTable.projectId, copyId));
  const models = await db.select().from(modelRunsTable).where(eq(modelRunsTable.projectId, copyId));
  const ledger = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.projectId, copyId));
  assert.ok(done);
  const measurementUnchanged = done.status === "model_ready" && measures.length === 1 &&
    digest(done.measurement) === digest(measures[0]!.measureJson);
  const originalUnchanged = digest(original) === digest(await sourceSnapshot());
  const result = {
    ...base, state: "finished", completedAt: new Date().toISOString(), paidRunStarted: true,
    copiedObjects: copiedPaths.size, status: done.status, model3dStatus: done.model3dStatus,
    measurementErrors: done.measurementErrors, measurementUnchanged,
    measurementSha256: done.measurement ? digest(done.measurement) : null, originalUnchanged,
    debitRows: ledger.filter(r => r.delta === -1).length,
    refundRows: ledger.filter(r => r.reason === "refund").length,
    balanceAfter: await holeGuthaben(source.userId),
    measurementRuns: measures.map(r => ({
      id: r.id, outcome: r.outcome, schemaVersion: r.schemaVersion, model: r.model,
      inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd,
      durationMs: r.durationMs, retryUsed: r.retryUsed, repairUsed: r.repairUsed,
      errors: r.errors, modelDiagnostics: r.modelDiagnostics,
    })),
    step2: done.model3dReport ? {
      stufe: done.model3dReport.stufe, correctionUsed: done.model3dReport.korrektur_genutzt,
      effort: done.model3dReport.effort, durationMs: done.model3dReport.duration_ms,
      error: done.model3dReport.error,
    } : null,
    modelRuns: models.map(r => ({
      id: r.id, stufe: r.stufe, correctionUsed: r.korrekturGenutzt, model: r.model,
      effort: r.effort, inputTokens: r.inputTokens, outputTokens: r.outputTokens,
      costUsd: r.costUsd, durationMs: r.durationMs, sandboxMs: r.sandboxMs, codeChars: r.codeChars,
    })),
  };
  await writeFile(evidencePath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  assert.ok(originalUnchanged, "Original data changed");
  assert.equal(result.debitRows, 1);
  assert.equal(measures.length, 1);
  if (done.status === "model_ready") {
    assert.ok(measurementUnchanged, "Step 2 changed the saved measurement");
    assert.equal(result.refundRows, 0);
    assert.ok(["ready", "unavailable"].includes(done.model3dStatus ?? ""));
    assert.ok(done.model3dReport);
    assert.ok(models.length >= 1 && models.length <= 2);
  }
}
main().catch(error => {
  console.error("Acceptance stopped; never rerun automatically:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => pool.end());
