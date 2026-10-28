// Explicit, offline development verification. No provider clients or model calls.
// All synthetic database rows are rolled back, including on assertion failures.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  db, pool, usersTable, projectsTable, measureRunsTable, type ModelDiagnostics,
} from "@workspace/db";

async function main() {
  const rollback = new Error("intentional verification rollback");
  let testUserId: string | undefined;
  let checked = 0;
  const diagnostics: ModelDiagnostics = {
    effort: "medium", usageComplete: true,
    responses: [{
      phase: "extract", responseId: "msg_SIMULATED_NO_PROVIDER_CALL", model: "claude-opus-5-5",
      stopReason: "max_tokens", contentTypes: ["thinking"],
      inputTokens: 100, outputTokens: 64000,
      cacheReadInputTokens: null, cacheCreationInputTokens: null,
    }],
  };
  try {
    try {
      await db.transaction(async (tx) => {
        const [user] = await tx.insert(usersTable).values({ firstName: "Diagnostic fixture" }).returning();
        testUserId = user!.id;
        const [project] = await tx.insert(projectsTable).values({
          userId: user!.id, name: "Rolled-back diagnostic verification",
        }).returning();
        for (const complete of [true, false]) {
          const payload = { ...diagnostics, usageComplete: complete };
          const [inserted] = await tx.insert(measureRunsTable).values({
            projectId: project!.id, schemaVersion: "unknown", outcome: "failed",
            errors: ["SIMULATED no-text response; no provider contacted"],
            model: "claude-opus-5-5", route: "photo", quality: "premium",
            inputTokens: complete ? 100 : null, outputTokens: complete ? 64000 : null,
            costUsd: complete ? 1.2804 : null, modelDiagnostics: payload,
          }).returning();
          const [stored] = await tx.select().from(measureRunsTable).where(eq(measureRunsTable.id, inserted!.id));
          assert.deepEqual(stored!.modelDiagnostics, payload);
          assert.equal(stored!.inputTokens, complete ? 100 : null);
          assert.equal(stored!.costUsd, complete ? 1.2804 : null);
          checked++;
        }
        const [legacy] = await tx.insert(measureRunsTable).values({
          projectId: project!.id, schemaVersion: "1.7",
        }).returning();
        assert.equal(legacy!.modelDiagnostics, null);
        checked++;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    assert.ok(testUserId);
    assert.equal((await db.select().from(usersTable).where(eq(usersTable.id, testUserId))).length, 0);
    const result = { postgresRoundtripsPassed: checked, syntheticRowsRolledBack: true, realModelCalls: 0 };
    await writeFile("docs/model-diagnostics-db-verification.json", JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
