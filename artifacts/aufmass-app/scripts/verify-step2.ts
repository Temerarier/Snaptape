// Offline PostgreSQL integration: simulated provider, real core and V8 isolate.
// Synthetic users/projects/ledger/model rows are removed in finally.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db, pool, usersTable, projectsTable, measureRunsTable, modelRunsTable, creditLedgerTable,
} from "@workspace/db";
import { bucheCredits, verbucheMessung } from "../lib/credits/service";
import { fuehreModellLaufAus, pendingReport, SCHRITT2_MODELL } from "../lib/modell3d/schritt2";

async function main() {
  const userId = randomUUID();
  const measurement = JSON.parse(await readFile("test-fixtures/variante-a/farmhouse-140040rk/messung.json", "utf8"));
  const code = await readFile("test-fixtures/variante-a/farmhouse-140040rk/buildhouse.js", "utf8");
  const cases: unknown[] = [];
  try {
    await db.insert(usersTable).values({ id: userId, replitUserId: `step2-offline-${userId}` });
    await bucheCredits({ userId, delta: 3, reason: "staff_grant", note: "isolated offline verification" });
    for (const scenario of ["ready", "correction", "exception"]) {
      const [project] = await db.insert(projectsTable).values({ userId, name: `Offline step 2 ${scenario}`, status: "model_ready", measurement }).returning();
      const [measure] = await db.insert(measureRunsTable).values({ projectId: project!.id, schemaVersion: "1.8", measureJson: measurement, outcome: "model_ready" }).returning();
      await verbucheMessung(userId, project!.id);
      await db.update(projectsTable).set({ model3dStatus: "pending", model3dReport: pendingReport(measure!.id) }).where(eq(projectsTable.id, project!.id));
      let calls = 0;
      await fuehreModellLaufAus({ projektId: project!.id, measureRunId: measure!.id, dateien: [] }, {
        loadImages: async () => [{ marker: "offline", jpegBase64: "OFFLINE_NO_PROVIDER" }],
        modelCall: async () => {
          calls++;
          if (scenario === "exception") throw new Error("SIMULATED transport error; no provider");
          return {
            text: scenario === "correction" && calls === 1 ? "function buildHouse(){throw new Error('offline probe')}" : code,
            inputTokens: 100, outputTokens: 200,
            diagnostic: { responseId: `msg_SIMULATED_${calls}`, model: SCHRITT2_MODELL, stopReason: "end_turn",
              contentTypes: ["text"], inputTokens: 100, outputTokens: 200,
              cacheReadInputTokens: null, cacheCreationInputTokens: null },
          };
        },
      });
      const [done] = await db.select().from(projectsTable).where(eq(projectsTable.id, project!.id));
      const ledger = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.projectId, project!.id));
      const runs = await db.select().from(modelRunsTable).where(eq(modelRunsTable.projectId, project!.id));
      assert.equal(done!.status, "model_ready");
      assert.deepEqual(done!.measurement, measurement);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]!.delta, -1);
      assert.equal(done!.model3dStatus, scenario === "exception" ? "unavailable" : "ready");
      assert.equal(runs.length, scenario === "correction" ? 2 : 1);
      assert.equal(runs.length, calls);
      assert.ok(done!.model3dReport);
      if (scenario === "exception") {
        assert.equal(runs[0]!.costUsd, null);
        assert.equal(runs[0]!.inputTokens, null);
      } else {
        assert.ok(runs.every(r => r.costUsd === 0.0044 && r.inputTokens === 100 && r.outputTokens === 200));
      }
      // A stale invocation must not write, bill or replace the current result.
      const before = JSON.stringify(done);
      await fuehreModellLaufAus({ projektId: project!.id, measureRunId: randomUUID(), dateien: [] }, {
        modelCall: async () => { throw new Error("Stale job must not call provider"); },
      });
      const [unchanged] = await db.select().from(projectsTable).where(eq(projectsTable.id, project!.id));
      assert.equal(JSON.stringify(unchanged), before);
      cases.push({ scenario, status: done!.model3dStatus, stufe: done!.model3dReport!.stufe,
        correction: done!.model3dReport!.korrektur_genutzt, modelRows: runs.length,
        unchangedMeasurement: true, debitRows: 1, refunds: 0, staleJobIgnored: true });
    }
  } finally {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    assert.equal((await db.select().from(projectsTable).where(eq(projectsTable.userId, userId))).length, 0);
    await pool.end();
  }
  const result = { cases, realModelCalls: 0, syntheticDataRemoved: true };
  await writeFile("docs/step2-offline-db-verification.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
