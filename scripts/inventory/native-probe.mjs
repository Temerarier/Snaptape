import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const directory = await mkdtemp("/tmp/snaptape-inventory-ivm-");
const result = {checkedAt:new Date().toISOString(),node:process.version,abi:process.versions.modules,packageManager:"pnpm scratch workspace (not project dependencies)",install:null,execution:null,elapsedMs:0,cleaned:false};
const start = Date.now();
try {
  await writeFile(`${directory}/package.json`, JSON.stringify({name:"inventory-isolated-vm-probe",version:"1.0.0",private:true,pnpm:{onlyBuiltDependencies:["isolated-vm"]}}));
  await writeFile(`${directory}/pnpm-workspace.yaml`, "packages:\n  - '.'\nonlyBuiltDependencies:\n  - isolated-vm\n");
  const install = spawnSync("pnpm", ["add","isolated-vm"], {cwd:directory,encoding:"utf8",timeout:240000});
  const log = `$ pnpm add isolated-vm (isolated scratch workspace)\n${install.stdout ?? ""}\n${install.stderr ?? ""}`;
  await writeFile("scripts/inventory/native-install.log",log);
  result.install = {code:install.status,error:install.error?.message ?? null,first30Lines:log.split("\n").slice(0,30)};
  if (install.status===0) {
    await writeFile(`${directory}/probe.cjs`, "const ivm=require('isolated-vm');const i=new ivm.Isolate({memoryLimit:128});const c=i.createContextSync();console.log(JSON.stringify({version:require('isolated-vm/package.json').version,memoryLimit:128,value:c.evalSync('1+1')}));i.dispose();\n");
    const run = spawnSync(process.execPath,["probe.cjs"],{cwd:directory,encoding:"utf8",timeout:20000});
    result.execution = {code:run.status,stdout:run.stdout,stderr:run.stderr,error:run.error?.message ?? null};
  }
} finally {
  result.elapsedMs=Date.now()-start;
  await rm(directory,{recursive:true,force:true});
  result.cleaned=true;
  await writeFile("scripts/inventory/native-probe.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
