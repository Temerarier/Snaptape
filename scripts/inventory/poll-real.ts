// SELECT-only monitor of the single authorized UI-started standard test.
import { writeFile } from "node:fs/promises";
import { pool } from "../../lib/db/src/index";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
import { buildModel } from "../../artifacts/aufmass-app/lib/viewer-next/model";
import { getDictionary } from "../../artifacts/aufmass-app/i18n";
const projectId="93e09fad-fef3-4e2b-af9f-adf4bd137831";
const started=Date.now();
let previous="", iteration=0;
try {
  while(Date.now()-started<65*60*1000){
    const {rows:[p]}=await pool.query("SELECT id,name,status,quality,current_run_id,classification,measurement,measurement_errors FROM projects WHERE id=$1",[projectId]);
    if(!p || !p.name.startsWith("Inventory 2026-10-25"))throw Error("Unexpected/non-inventory target");
    const {rows:runs}=await pool.query("SELECT id,outcome,schema_version,model,route,duration_ms,input_tokens,output_tokens,cost_usd,retry_used,repair_used,warnings,errors,created_at FROM measure_runs WHERE project_id=$1 ORDER BY created_at DESC",[projectId]);
    let metrics=null;
    if(p.measurement){
      const prepared=prepareProjectMeasurement(p.measurement,getDictionary("en-US").viewerNext);
      if(prepared.kind==="viewer"){
        const m=buildModel(prepared.measurement as any,prepared.derived);
        metrics={preparation:prepared.kind,walls:m.walls.length,roofs:m.roofFaces.length,openings:m.openings.length};
      }else metrics={preparation:prepared.kind};
    }
    const evidence={
      checkedAt:new Date().toISOString(),projectId,projectStatus:p.status,quality:p.quality,currentRunId:p.current_run_id,
      observedDurationMs:Date.now()-started,measurementSchemaVersion:p.measurement?.meta?.schema_version??null,
      projectErrors:p.measurement_errors,route:p.classification?.projectType??null,
      runs,modelMetrics:metrics,
      terminal:["failed","model_ready"].includes(p.status),method:"Created/uploaded/started through actual authenticated UI; SELECT-only monitoring. Model metrics are source execution, not a WebGL screenshot."
    };
    await writeFile("scripts/inventory/real-result.json",JSON.stringify(evidence,null,2)+"\n");
    const signature=JSON.stringify([p.status,p.current_run_id,runs.length]);
    if(signature!==previous || iteration%20===0)console.log(evidence.checkedAt,p.status,"runs",runs.length);
    previous=signature;iteration++;
    if(evidence.terminal && runs.length)break;
    await new Promise(r=>setTimeout(r,15000));
  }
} finally {await pool.end();}
