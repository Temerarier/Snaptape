// Recovery of the one authorized trial verification run after the workspace
// process was lost. This makes NO model calls and does not change product code.
import { readFile, writeFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db, pool, usersTable, projectsTable, measureRunsTable, creditLedgerTable } from "@workspace/db";
import { erstatteMessung } from "../lib/credits/service";
import { MESS_MODELL, MESS_EFFORT } from "../lib/messung/modelle";

async function main() {
  const context = JSON.parse(await readFile("scripts/credits-test-context.json", "utf8"));
  try {
    const result = await db.transaction(async (tx) => {
      await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, context.userUuid)).for("update");
      const [project] = await tx.select().from(projectsTable)
        .where(and(eq(projectsTable.id, context.projectUuid), eq(projectsTable.userId, context.userUuid))).for("update");
      if (!project) throw new Error("Owned verification project missing");
      if (project.status === "processing") {
        const errors = ["Measurement interrupted by workspace restart during verification"];
        const [applied] = await tx.update(projectsTable).set({
          status: "failed", measurement: null, measurementErrors: errors,
          processingSince: null, currentRunId: null, currentCreditLedgerId: null,
        }).where(and(eq(projectsTable.id, project.id), eq(projectsTable.currentRunId, project.currentRunId!),
          eq(projectsTable.status, "processing"))).returning();
        if (!applied) throw new Error("Run changed during recovery");
        const [run] = await tx.insert(measureRunsTable).values({
          projectId: project.id, model: MESS_MODELL, quality: "premium", outcome: "failed",
          schemaVersion: "unknown", measureJson: null, errors, warnings: [],
          durationMs: project.processingSince ? Date.now() - project.processingSince.getTime() : null,
          // The lost stream never returned usage. Do not invent tokens/cost.
          inputTokens: null, outputTokens: null, costUsd: null,
        }).returning();
        if (project.currentCreditLedgerId) await erstatteMessung(tx, project.currentCreditLedgerId, run!.id, "measurement failed");
      }
      const [settled] = await tx.select({ id: projectsTable.id, status: projectsTable.status, errors: projectsTable.measurementErrors })
        .from(projectsTable).where(eq(projectsTable.id, project.id));
      const runs = await tx.select({
        id: measureRunsTable.id, model: measureRunsTable.model, outcome: measureRunsTable.outcome,
        durationMs: measureRunsTable.durationMs, inputTokens: measureRunsTable.inputTokens,
        outputTokens: measureRunsTable.outputTokens, costUsd: measureRunsTable.costUsd,
      }).from(measureRunsTable).where(eq(measureRunsTable.projectId, project.id));
      const ledger = await tx.select({
        delta: creditLedgerTable.delta, reason: creditLedgerTable.reason,
        note: creditLedgerTable.note, projectId: creditLedgerTable.projectId,
      }).from(creditLedgerTable).where(eq(creditLedgerTable.userId, context.userUuid));
      return { project: settled, model: MESS_MODELL, effort: MESS_EFFORT, runs, ledger,
        balance: ledger.reduce((sum, r) => sum + r.delta, 0),
        usageRecoverable: false, paidMeasurementStarts: 1,
        note: "Workspace restart destroyed the only authorized live stream; no second run was started.",
      };
    });
    await writeFile("docs/credits-real-verification.json", JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
