import { readFile, writeFile } from "node:fs/promises";
import { pool } from "../lib/db/src/index";

const context = JSON.parse(await readFile("scripts/credits-test-context.json", "utf8"));
const deadline = Date.now() + 65 * 60_000;
try {
  while (Date.now() < deadline) {
    const { rows: projects } = await pool.query(
      "select id,status,processing_since,measurement is not null as has_measurement,measurement_errors from projects where id=$1 and user_id=$2",
      [context.projectUuid, context.userUuid],
    );
    const project = projects[0];
    if (!project) throw new Error("Owned test project missing");
    if (project.status !== "processing") {
      const { rows: runs } = await pool.query(
        "select id,model,outcome,duration_ms,input_tokens,output_tokens,cost_usd,quality,retry_used,repair_used,errors from measure_runs where project_id=$1 order by created_at desc",
        [project.id],
      );
      const { rows: ledger } = await pool.query(
        "select delta,reason,note,project_id,measure_run_id from credit_ledger where user_id=$1 order by created_at",
        [context.userUuid],
      );
      const result = { project, runs, ledger, checkedAt: new Date().toISOString() };
      await writeFile("docs/credits-real-verification.json", JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20_000));
  }
} finally { await pool.end(); }
