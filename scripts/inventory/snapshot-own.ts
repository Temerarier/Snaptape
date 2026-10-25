import { writeFile } from "node:fs/promises";
import { pool } from "../../lib/db/src/index";
const mode=process.argv[2];
const id=mode==="stub"?"2a4ba0ce-7e33-455a-9f81-b449eb0c7ed0":mode==="real"?"93e09fad-fef3-4e2b-af9f-adf4bd137831":null;
if(!id)throw Error("Expected stub or real");
try{
  const {rows}=await pool.query("SELECT id,measurement FROM projects WHERE id=$1 AND user_id=$2 AND status='model_ready'",[id,"1767f1f4-f5d1-468c-b791-d77c959f389f"]);
  if(rows.length!==1 || !rows[0].measurement)throw Error("Own inventory project not model_ready with measurement");
  await writeFile(`scripts/inventory/${mode}-project.json`,JSON.stringify([{...rows[0],captureLabel:mode}],null,2)+"\n");
  console.log(mode,"snapshot ready");
}finally{await pool.end();}
