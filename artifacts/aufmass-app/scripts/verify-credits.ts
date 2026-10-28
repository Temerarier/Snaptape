import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { writeFile } from "node:fs/promises";
import { db, pool, projectsTable, measureRunsTable, creditLedgerTable, usersTable, type ProjectClassification } from "@workspace/db";
import { bucheCredits, holeGuthaben, verbucheMessung } from "../lib/credits/service";
import { fuehreMessLaufAus } from "../lib/messung/pipeline";
import { raeumeHaengendeMessungenAuf } from "../lib/messung/aufraeumen";

async function main() {
const isolated = process.argv[2] === "--isolated";
const userId = isolated ? randomUUID() : process.argv[2];
if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Supply the NEW trial-test user UUID or --isolated");
if (process.env.EXTRAKTOR_STUB !== "1" || process.env.EXTRAKTOR_STUB_KAPUTT !== "1") throw new Error("Both explicit stub flags are required; no paid calls permitted");
const classification: ProjectClassification = { projectType: "photo", depthBasis: "oblique_only",
  expectedAccuracy: "medium", referenceObjectsFound: [], planPagesUsable: 0, planPagesSelected: 0,
  raw: { creditRegressionStub: true }, classifiedAt: new Date().toISOString() };
const evidence: Record<string, unknown> = {};
try {
  if (isolated) {
    await db.insert(usersTable).values({ id: userId, replitUserId: `credits-verification-${userId}` });
    await bucheCredits({ userId, delta: 1, reason: "staff_grant", note: "isolated credit regression" });
  }
  const balanceBefore = await holeGuthaben(userId);
  if (balanceBefore < 1) throw new Error("Test user needs at least one credit (refunded in each test)");
  const create = async (name: string, ageMs: number) => db.transaction(async (tx) => {
    const [project] = await tx.insert(projectsTable).values({ userId, name, quality: "premium" }).returning();
    const ledgerId = await verbucheMessung(userId, project!.id, tx);
    const runId = randomUUID();
    // Test fixture ONLY: production processing_since is set solely by the start action.
    await tx.update(projectsTable).set({ status: "processing", currentRunId: runId,
      currentCreditLedgerId: ledgerId, processingSince: new Date(Date.now() - ageMs), classification })
      .where(eq(projectsTable.id, project!.id));
    return { project: project!, ledgerId, runId };
  });
  const broken = await create("Credits verification · forced stub failure", 0);
  await fuehreMessLaufAus({ projektId: broken.project.id, runId: broken.runId, quality: "premium",
    creditLedgerId: broken.ledgerId, klassifizierung: classification, dateien: [], referenz: null });
  const [failed] = await db.select().from(projectsTable).where(eq(projectsTable.id, broken.project.id));
  const failedLedger = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.projectId, broken.project.id));
  evidence.forcedFailure = { projectId: broken.project.id, status: failed!.status, entries: failedLedger.map(({ delta, reason, note }) => ({ delta, reason, note })) };
  if (failed!.status !== "failed" || failedLedger.filter((r) => r.reason === "refund" && r.note === "measurement failed").length !== 1) throw new Error("Failure refund missing");
  const timeout = await create("Credits verification · 2 hour timeout", 7_200_000);
  await raeumeHaengendeMessungenAuf(userId);
  await raeumeHaengendeMessungenAuf(userId);
  const [timed] = await db.select().from(projectsTable).where(eq(projectsTable.id, timeout.project.id));
  const timeoutLedger = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.projectId, timeout.project.id));
  const timeoutRuns = await db.select().from(measureRunsTable).where(eq(measureRunsTable.projectId, timeout.project.id));
  evidence.timeout = { projectId: timeout.project.id, status: timed!.status, errors: timed!.measurementErrors,
    runRows: timeoutRuns.length, entries: timeoutLedger.map(({ delta, reason, note }) => ({ delta, reason, note })) };
  if (timed!.status !== "failed" || timeoutRuns.length !== 1 || timeoutLedger.filter((r) => r.reason === "refund").length !== 1) throw new Error("Timeout not idempotent");
  const young = await create("Credits verification · young processing", 30_000);
  await raeumeHaengendeMessungenAuf(userId);
  const [youngRow] = await db.select().from(projectsTable).where(eq(projectsTable.id, young.project.id));
  evidence.young = { projectId: young.project.id, statusBeforeFinalization: youngRow!.status };
  if (youngRow!.status !== "processing") throw new Error("Young measurement swept too early");
  // Settle this test via forced failure, so no paid credit remains consumed.
  await fuehreMessLaufAus({ projektId: young.project.id, runId: young.runId, quality: "premium",
    creditLedgerId: young.ledgerId, klassifizierung: classification, dateien: [], referenz: null });
  const [nullProject] = await db.insert(projectsTable).values({ userId, name: "Credits verification · legacy null",
    status: "model_ready", measurement: null }).returning();
  await raeumeHaengendeMessungenAuf(userId);
  const [nullDone] = await db.select().from(projectsTable).where(eq(projectsTable.id, nullProject!.id));
  evidence.nullMeasurement = { projectId: nullProject!.id, status: nullDone!.status };
  const balanceAfter = await holeGuthaben(userId);
  evidence.balance = { before: balanceBefore, after: balanceAfter };
  if (balanceBefore !== balanceAfter || nullDone!.status !== "failed") throw new Error("Balance drift or null invariant failed");
  evidence.pass = true;
  console.log(JSON.stringify(evidence, null, 2));
  await writeFile("docs/credits-db-verification.json", JSON.stringify(evidence, null, 2) + "\n");
} finally {
  if (isolated) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
}
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
