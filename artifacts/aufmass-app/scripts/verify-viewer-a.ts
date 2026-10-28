// Read-only acceptance against the real, already-paid project. No provider calls.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, pool, projectsTable } from "@workspace/db";
import { modelFromModel3d } from "../lib/viewer-next/model/fromModel3d";
import { prepareProjectMeasurement } from "../lib/viewer-next/projectMeasurement";
import { enUS } from "../i18n/en-US";

async function main() {
  const id = "8c12e2b9-7cd3-48a9-b1dd-799e5e05bd9a";
  const [p] = await db.select({
    measurement: projectsTable.measurement, model3d: projectsTable.model3d,
    model3dStatus: projectsTable.model3dStatus,
  }).from(projectsTable).where(eq(projectsTable.id, id));
  assert.ok(p?.model3d && p.model3dStatus === "ready");
  const prepared = prepareProjectMeasurement(p.measurement, enUS.viewerNext);
  assert.equal(prepared.kind, "viewer");
  if (prepared.kind !== "viewer") throw new Error(prepared.kind);
  const model = modelFromModel3d(p.model3d, prepared.measurement, prepared.derived);
  const result = {
    projectId: id, readOnly: true, providerCalls: 0, source: "stored-model3d",
    walls: model.walls.length, roofs: model.roofFaces.length, openings: model.openings.length,
    attachments: model.attachments.length, conditions: model.conditions.length,
    edges: model.edges.length, decorations: model.massing.length,
    geometryIdsRetained: ["flaechen", "oeffnungen", "anbauten", "kanten", "fallrohre", "schaeden"].every(group =>
      p.model3d![group as keyof typeof p.model3d] instanceof Array &&
      (p.model3d![group as keyof typeof p.model3d] as Record<string, unknown>[]).every(row =>
        [...model.walls, ...model.roofFaces, ...model.openings, ...model.attachments, ...model.conditions, ...model.edges]
          .some(part => part.id === row.id_1_7))),
  };
  assert.ok(result.geometryIdsRetained);
  await writeFile("docs/viewer-a-real-project-verification.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
