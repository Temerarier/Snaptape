import { createHash } from "node:crypto";
import { readFile,writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pool } from "../../lib/db/src/index";
const canonical=(x:any):string=>x===null || typeof x!=="object"?JSON.stringify(x):Array.isArray(x)?`[${x.map(canonical).join(",")}]`:`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")}}`;
const hash=(x:any)=>createHash("sha256").update(canonical(x)).digest("hex");
try{
  const baseline=JSON.parse(await readFile("scripts/inventory/ready-projects.json","utf8"));
  const {rows}=await pool.query("SELECT id,measurement FROM projects WHERE id=ANY($1::uuid[])",[baseline.map((r:any)=>r.id)]);
  const differences=baseline.filter((old:any)=>hash(old.measurement)!==hash(rows.find((r:any)=>r.id===old.id)?.measurement)).map((r:any)=>r.id);
  const raw=execFileSync("git",["status","--porcelain","-z","-uall"],{encoding:"utf8"});
  const changed=raw.split("\0").filter(Boolean).map(l=>l.slice(3));
  const manifest=await readFile("scripts/inventory/variante-a-manifest.json","utf8").then(JSON.parse).catch(error=>{if(error.code==="ENOENT")return null;throw error});
  const userSuppliedInputPaths=manifest?.sourceArchive?[manifest.sourceArchive]:[];
  const outside=changed.filter(p=>!(p==="docs/inventory-2026-10-25.md" || p.startsWith("scripts/inventory/") || p.startsWith("screenshots/inventory-2026-10-25/") || userSuppliedInputPaths.includes(p)));
  const result={checkedAt:new Date().toISOString(),existingReadyProjectsChecked:baseline.length,existingMeasurementDifferences:differences,outsideAllowedPaths:outside,userSuppliedInputPaths,changedFiles:changed.length,scope:"Checks the 32 initial model_ready measurement values and Git-visible changed outputs; the exact manifest-identified uploaded ZIP is a separately listed user-provided input, not an agent output. Does not claim all rows or session state unchanged."};
  await writeFile("scripts/inventory/integrity.json",JSON.stringify(result,null,2)+"\n");
  console.log(result);
  if(differences.length||outside.length)process.exitCode=1;
}finally{await pool.end();}
