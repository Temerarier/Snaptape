// Read-only inputs for the existing loopback SwiftShader harness. No provider.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "../../lib/db/src/index";
import { loadTestHouse, TEST_HOUSES } from "../../artifacts/aufmass-app/app/viewer-next/testHouses";

async function main() {
  const cases = [];
  for (const house of TEST_HOUSES.slice(1)) {
    cases.push({ id: house.id, ...await loadTestHouse(house.id) });
  }
  const id = "8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a";
  const { rows: [project] } = await pool.query(
    "SELECT measurement, model3d, model3d_status FROM projects WHERE id=$1", [id]);
  if (!project?.model3d || project.model3d_status !== "ready") throw new Error("Real project is not ready");
  cases.push({ id, measurement: project.measurement, model3d: project.model3d });
  const output = fileURLToPath(new URL("../../generated-artifacts/viewer-a/", import.meta.url));
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/inputs.json`, JSON.stringify(cases));
  console.log(`Exported ${cases.length} cases, read-only; provider calls: 0`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
