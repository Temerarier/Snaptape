// Executes ONLY the five explicitly authorized, user-supplied reference fixtures.
// No live model output, network call, sandbox claim, product edit, or DB write.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, writeFile, rm, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const archive=process.argv[2];
if(!archive)throw Error("Usage: node scripts/inventory/variante-a.mjs <uploaded ZIP>");
const requireMeasurement=createRequire(resolve("lib/measurement/package.json"));
const Ajv2020=requireMeasurement("ajv/dist/2020.js").default;
const result={
  checkedAt:new Date().toISOString(),node:process.version,
  command:"node scripts/inventory/variante-a.mjs <uploaded ZIP>",
  method:"Original core.js measurementToMess → runBuild with supplied buildhouse.js → pruefen; plain Node expressly allowed for authored reference fixtures. Standalone Ajv2020/allErrors/strict:false; no production validator changed.",
  ajvVersion:requireMeasurement("ajv/package.json").version,
  schemaDialect:null,requiredFilesMissing:[],unexpectedHouses:[],cases:[],cleaned:false
};
let extracted;
try {
  extracted=JSON.parse(execFileSync("python",["scripts/inventory/variante-a-extract.py",archive],{encoding:"utf8"}));
  const root=extracted.root;
  const manifest=JSON.parse(await readFile("scripts/inventory/variante-a-manifest.json","utf8"));
  const available=new Set(manifest.files.map(f=>f.path.replace(/^variante-a-paket\//,"")));
  const required=[
    "shared/schema/measurement-v1.8.json","artifacts/aufmass-app/lib/modell3d/core.js",
    "test-fixtures/variante-a/erwartet.json","REPLIT-PROMPTS-VARIANTE-A.md",
    ...["extract-photo-prompt.md","extract-plan-prompt.md","extract-mixed-prompt.md","buildhouse-prompt.md","buildhouse-correction-prompt.md"].map(f=>"docs/pipeline/"+f)
  ];
  const fixtureRoot=join(root,"test-fixtures/variante-a");
  const expected=JSON.parse(await readFile(join(fixtureRoot,"erwartet.json"),"utf8"));
  const houses=Object.keys(expected).sort();
  if(houses.length!==5)throw Error("Expected five authored reference houses");
  for(const house of houses)required.push(`test-fixtures/variante-a/${house}/messung.json`,`test-fixtures/variante-a/${house}/buildhouse.js`);
  result.requiredFilesMissing=required.filter(p=>!available.has(p));
  if(result.requiredFilesMissing.length)throw Error("Incomplete supplied package");
  const fixtureDirs=(await readdir(fixtureRoot,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name);
  result.unexpectedHouses=fixtureDirs.filter(h=>!houses.includes(h));
  if(result.unexpectedHouses.length)throw Error("Unexpected house directories");
  const core=createRequire(join(root,"artifacts/aufmass-app/lib/modell3d/core.js"))("./core.js");
  result.coreVersion=core.VERSION;
  const schema=JSON.parse(await readFile(join(root,"shared/schema/measurement-v1.8.json"),"utf8"));
  result.schemaDialect=schema.$schema;
  const ajv=new Ajv2020({allErrors:true,strict:false});
  const validate=ajv.compile(schema);
  for(const house of houses){
    const file=join(fixtureRoot,house,"messung.json");
    const measurement=JSON.parse(await readFile(file,"utf8"));
    const schemaValid=validate(measurement);
    const schemaErrors=JSON.parse(JSON.stringify(validate.errors??[]));
    const code=await readFile(join(fixtureRoot,house,"buildhouse.js"),"utf8");
    const MESS=core.measurementToMess(measurement);
    const model=core.runBuild(MESS,code);
    const check=core.pruefen(MESS,model);
    const actual={
      stufe:check.stufe,ids_fehlen:check.zahlen.ids_fehlen,stopp:check.zahlen.fehler,
      flaechen:model.flaechen.length,oeffnungen:model.oeffnungen.length,kanten:model.kanten.length
    };
    const differences=Object.entries(expected[house]).filter(([key,value])=>actual[key]!==value).map(([key,value])=>({key,expected:value,actual:actual[key]??null}));
    const record={
      house,expected:expected[house],actual,differences,comparisonPass:differences.length===0,
      schemaVersion:measurement.meta?.schema_version??null,schemaValid,schemaErrors,
      go:check.go,buildErrors:model.fehler,buildWarnings:model.hinweise,
      checkNumbers:check.zahlen,checkRows:check.zeilen
    };
    result.cases.push(record);
    console.log(house,JSON.stringify({schemaValid,comparisonPass:record.comparisonPass,actual,schemaErrorCount:schemaErrors.length}));
  }
  result.comparisonPassed=result.cases.filter(c=>c.comparisonPass).length;
  result.schemaPassed=result.cases.filter(c=>c.schemaValid).length;
  result.allPass=result.comparisonPassed===5 && result.schemaPassed===5;
  if(!result.allPass)process.exitCode=1;
}catch(error){
  result.fatal=error.stack??String(error);process.exitCode=1;console.error(result.fatal);
}finally{
  if(extracted){await rm(extracted.temporary,{recursive:true,force:true});result.cleaned=true;}
  await writeFile("scripts/inventory/variante-a-results.json",JSON.stringify(result,null,2)+"\n");
}
