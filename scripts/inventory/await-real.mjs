// Event-based wait for the SELECT monitor's terminal result; no API/model calls.
import { watch, readFileSync } from "node:fs";
const file="scripts/inventory/real-result.json";
function terminal(){
  try{
    const result=JSON.parse(readFileSync(file,"utf8"));
    if(result.terminal){
      console.log(JSON.stringify({projectStatus:result.projectStatus,terminal:true,runs:result.runs},null,2));
      return true;
    }
  }catch{}
  return false;
}
if(!terminal()){
  const watcher=watch(file,()=>{if(terminal()){watcher.close();clearTimeout(timer)}});
  const timer=setTimeout(()=>{watcher.close();console.log("Still awaiting terminal measurement result; no new model call or retry.");},285000);
}
