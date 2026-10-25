// Runs ONLY the explicitly authorized new inventory project's post-gate stub.
// The classification gate is intentionally NOT called: it lacks a free stub.
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { and, asc, eq, inArray } from "../../lib/db/node_modules/drizzle-orm";
import { db, pool, projectsTable, projectFilesTable } from "../../lib/db/src/index";
import { fuehreMessLaufAus } from "../../artifacts/aufmass-app/lib/messung/pipeline";

if (process.env.EXTRAKTOR_STUB !== "1") throw Error("Refusing to run: EXTRAKTOR_STUB must equal 1 in this process.");
const context = JSON.parse(await readFile("scripts/inventory/ui-context.json","utf8"));
const projectId = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(projectId ?? "")) throw Error("Expected new stub project UUID");
try {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id,projectId));
  if (!project || !project.name.startsWith("Inventory 2026-10-25") || project.measurement || !["draft","files_uploaded"].includes(project.status))
    throw Error("Refusing to modify any existing/measured/non-inventory project");
  if (!JSON.stringify(context).includes(projectId)) throw Error("Project absent from tester-created inventory context");
  const files = await db.select().from(projectFilesTable).where(eq(projectFilesTable.projectId,projectId)).orderBy(asc(projectFilesTable.sortOrder));
  if (files.length!==7 || files.some(f=>f.processingError)) throw Error("Expected seven successfully processed Braamheide files");
  const pages=files.filter(f=>f.kind==="pdf").reduce((n,f)=>n+(f.pageCount??0),0);
  const classification={
    projectType:"mixed",depthBasis:"known-fixture-stub",expectedAccuracy:"test fixture, not a live classification",
    referenceObjectsFound:[],planPagesUsable:pages,planPagesSelected:pages,
    raw:{inventoryStub:true,note:"Authored test metadata. Paid classification deliberately bypassed, not an end-to-end gate test."},
    classifiedAt:new Date().toISOString()
  };
  const runId=randomUUID();
  const changed=await db.update(projectsTable).set({status:"processing",quality:"standard",classification,currentRunId:runId})
    .where(and(eq(projectsTable.id,projectId),inArray(projectsTable.status,["draft","files_uploaded"])))
    .returning({id:projectsTable.id});
  if(changed.length!==1)throw Error("Project changed concurrently");
  const started=Date.now();
  await fuehreMessLaufAus({projektId:projectId,runId,quality:"standard",klassifizierung:classification,dateien:files});
  const [done]=await db.select().from(projectsTable).where(eq(projectsTable.id,projectId));
  const evidence={
    projectId,runId,status:done.status,durationMs:Date.now()-started,files:files.length,pdfPages:pages,
    schemaVersion:(done.measurement as any)?.meta?.schema_version ?? null,
    method:"Actual pipeline and EXTRAKTOR_STUB=1 in standalone tsx process, after UI upload. Synthetic classification metadata replaces paid gate only for this new inventory project. This does not establish that clicking Start in EXTRAKTOR_STUB mode is free.",
    errors:done.measurementErrors
  };
  await writeFile("scripts/inventory/stub-result.json",JSON.stringify(evidence,null,2)+"\n");
  console.log(evidence);
} finally {await pool.end();}
