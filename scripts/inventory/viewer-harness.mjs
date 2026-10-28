// Actual ProjectViewer + compiled app CSS, isolated from auth; never impersonates users.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, mkdir, rm, mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { connectBrowser, pause, waitUntil } from "../../artifacts/aufmass-app/scripts/viewer-browser-cdp.mjs";
import { checkVarianteA } from "./viewer-a-checks.mjs";
const base=process.cwd(),directory=path.join(base,"scripts/inventory");
const varianteA=process.argv.includes("--variante-a");
const args=process.argv.slice(2).filter(arg=>arg!=="--variante-a");
const inputFile=args[0] ?? path.join(directory,"ready-projects.json");
const outputFile=varianteA ? args[1]??"generated-artifacts/viewer-a/results.json" : args[0] ? path.join(directory,`${path.basename(inputFile,".json")}-viewer-results.json`) : path.join(directory,"viewer-results.json");
const require=createRequire(import.meta.url);
const vr=createRequire(require.resolve("vitest/package.json"));
const ar=createRequire(path.join(base,"artifacts/aufmass-app/package.json"));
const three=path.join(path.dirname(ar.resolve("three")),"three.module.js");
const {build}=vr("esbuild");
const {outputFiles}=await build({
  entryPoints:[path.join(directory,varianteA?"viewer-a-entry.tsx":"viewer-entry.tsx")],bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",
  alias:{"@":path.join(base,"artifacts/aufmass-app"),"@workspace/measurement":path.join(base,"scripts/diagnose/measurement-browser.ts")},
  nodePaths:[path.join(base,"artifacts/aufmass-app/node_modules")],define:{"process.env.NODE_ENV":'"production"'},
  plugins:[{name:"observe-three",setup(b){
    if(varianteA) {
      b.onResolve({filter:/^three\/examples\/jsm\/controls\/OrbitControls\.js$/},()=>({path:"controls",namespace:"inventory-controls"}));
      b.onLoad({filter:/.*/,namespace:"inventory-controls"},()=>({contents:`import {OrbitControls as C} from ${JSON.stringify(ar.resolve("three/examples/jsm/controls/OrbitControls.js"))};export class OrbitControls extends C{constructor(...a){super(...a);window.inventoryControls=this}}`,loader:"js",resolveDir:base}));
    }
    b.onResolve({filter:/^three$/},()=>({path:"observer",namespace:"inventory"}));
    b.onLoad({filter:/.*/,namespace:"inventory"},()=>({contents:`export * from ${JSON.stringify(three)};import {WebGLRenderer as R} from ${JSON.stringify(three)};export class WebGLRenderer extends R{constructor(...a){super(...a);const r=this.render.bind(this);this.render=(s,c)=>{r(s,c);window.observeRender?.call(this,s,c)}}}`,loader:"js",resolveDir:base}));
  }}]
});
const cssDirectory=path.join(base,"artifacts/aufmass-app/.next/static/css");
const css=(await Promise.all((await readdir(cssDirectory)).filter(f=>f.endsWith(".css")).map(f=>readFile(path.join(cssDirectory,f),"utf8")))).join("\n");
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\nbody{margin:0;font-family:Arial,sans-serif}#root{min-height:100vh}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server=createServer((req,res)=>{res.setHeader("Content-Type",req.url==="/bundle.js"?"text/javascript":"text/html");res.end(req.url==="/bundle.js"?outputFiles[0].text:html)});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const profile=await mkdtemp("/tmp/snaptape-inventory-chromium-");
const chromium=spawn("/repl/tools/bin/chromium",["--headless=new","--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--remote-debugging-address=127.0.0.1","--remote-debugging-port=9223",`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","about:blank"],{stdio:"ignore"});
const shots=varianteA?"generated-artifacts/viewer-a":"screenshots/inventory-2026-10-25";
await mkdir(shots,{recursive:true});
let browser;
const results=[];
try{
  for(let i=0;i<80;i++){try{browser=await connectBrowser();break}catch{await pause(200)}}
  if(!browser)throw Error("Chromium CDP unavailable");
  await browser.send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await browser.send("Page.navigate",{url:`http://127.0.0.1:${server.address().port}`});
  await waitUntil(browser,"typeof window.mountInventory==='function'",30000);
  const cases=JSON.parse(await readFile(inputFile,"utf8"));
  for(const c of cases){
    browser.exceptions.length=0;browser.consoleMessages.length=0;
    const r={id:c.id};
    try{
      Object.assign(r,await browser.evaluate(`window.mountInventory(${JSON.stringify(c.id)},${JSON.stringify(c.measurement)},${JSON.stringify(c.model3d??null)})`));
      if(r.preparation==="viewer" && !r.modelError)await waitUntil(browser,"window.inventoryRender?.triangles>0",20000);
      if(varianteA) {
        r.checks=await checkVarianteA(browser,c,shots);
        r.render=await browser.evaluate("window.inventoryRender");
        r.state=await browser.evaluate("window.inventoryState()");
      }
      await pause(700);
      r.render=await browser.evaluate("window.inventoryRender");
      r.pageState=await browser.evaluate("document.querySelector('[data-project-viewer-state]')?.getAttribute('data-project-viewer-state') ?? 'viewer'");
      r.olderNotice=await browser.evaluate("document.body.innerText.includes('older version')");
      const filename=c.captureLabel?`${c.captureLabel}-desktop.png`:`real-${c.id}.png`;
      const image=await browser.send("Page.captureScreenshot",{format:"png"});
      await writeFile(`${shots}/${filename}`,Buffer.from(image.data,"base64"));
      r.screenshot=`${shots}/${filename}`;
      r.horizontalOverflow=await browser.evaluate("document.documentElement.scrollWidth>innerWidth");
      if(c.captureLabel){
        await browser.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
        await pause(1200);
        const phone=await browser.send("Page.captureScreenshot",{format:"png"});
        r.phoneScreenshot=`${shots}/${c.captureLabel}-phone.png`;
        await writeFile(r.phoneScreenshot,Buffer.from(phone.data,"base64"));
        r.phone={width:390,render:await browser.evaluate("window.inventoryRender"),horizontalOverflow:await browser.evaluate("document.documentElement.scrollWidth>innerWidth")};
        await browser.send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
      }
    }catch(e){r.error=String(e)}
    r.exceptions=[...browser.exceptions];
    r.console=[...browser.consoleMessages].map(m=>({type:m.type,args:m.args.map(a=>a.value ?? a.description).filter(Boolean)}));
    results.push(r);
    await writeFile(outputFile,JSON.stringify({method:"Actual ProjectViewer, ViewerNextClient, preparation, builder/Variante-A adapter, materials and compiled production CSS; isolated loopback component host with system font fallback, no authenticated route ownership bypass. Full inherited app layout and owner-specific locale not tested. Software WebGL SwiftShader, desktop1280x900; optional phone390x844. Test-only Three wrappers expose the live renderer/camera/controls for repeatable views; selection and measuring use actual DOM/CDP events.",cases:results},null,2)+"\n");
    console.log(c.id,r.preparation,r.modeled,r.error??"OK");
    if(r.checks?.interactionError) { console.error(r.checks.interactionError); process.exitCode=1; }
    if(varianteA && r.error) { process.exitCode=1; break; }
  }
}finally{
  browser?.close();chromium.kill("SIGTERM");server.close();await pause(400);await rm(profile,{recursive:true,force:true});
}
