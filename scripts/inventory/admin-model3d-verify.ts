// SELECT-only evidence for the internal audit UI; no provider or ledger writes.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pool } from "../../lib/db/src/index";
const phase = process.argv[2];
assert.ok(phase === "before" || phase === "after");
const directory = "generated-artifacts/admin-model3d";
const id = "8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a";
const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");
  const { rows: [project] } = await client.query(`
    SELECT p.id, p.model3d_status, p.model3d_report->>'stufe' AS stufe,
      p.model3d_report->'zahlen' AS counts,
      (SELECT sum(cost_usd)::float8 FROM measure_runs WHERE project_id=p.id) AS step1,
      (SELECT sum(cost_usd)::float8 FROM model_runs WHERE project_id=p.id) AS step2,
      (SELECT count(*)::int FROM model_runs WHERE project_id=p.id) AS model_attempts,
      (SELECT model FROM model_runs WHERE project_id=p.id ORDER BY created_at DESC,id DESC LIMIT 1) AS model
    FROM projects p WHERE p.id=$1`, [id]);
  assert.ok(project?.model_attempts > 0 && project.model3d_status === "ready");
  const { rows: [ownerCosts] } = await client.query(`
    SELECT
      (SELECT coalesce(sum(r.cost_usd),0)::float8 FROM measure_runs r JOIN projects p ON p.id=r.project_id
        WHERE p.user_id=(SELECT user_id FROM projects WHERE id=$1)) AS step1,
      (SELECT coalesce(sum(r.cost_usd),0)::float8 FROM model_runs r JOIN projects p ON p.id=r.project_id
        WHERE p.user_id=(SELECT user_id FROM projects WHERE id=$1)) AS step2`, [id]);
  const { rows: [ledger] } = await client.query(`
    SELECT count(*)::int AS rows, md5(coalesce(string_agg(to_jsonb(l)::text,',' ORDER BY id),'')) AS digest
    FROM credit_ledger l`);
  await client.query("COMMIT");
  const evidence = {
    readOnly: true, providerCalls: 0,
    project: { ...project, total: project.step1 + project.step2 },
    ownerCosts: { ...ownerCosts, total: ownerCosts.step1 + ownerCosts.step2 }, ledger,
  };
  await mkdir(directory, { recursive: true });
  if (phase === "after") {
    const before = JSON.parse(await readFile(`${directory}/before.json`, "utf8"));
    assert.deepEqual(ledger, before.ledger, "Ledger changed during read-only verification");
  }
  await writeFile(`${directory}/${phase}.json`, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  client.release();
  await pool.end();
}
