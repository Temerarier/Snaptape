// Run with: pnpm exec tsx artifacts/aufmass-app/scripts/viewer-polish-browser.mjs
// Uses the same fixture and real WebGL browser as the conformance walkthrough.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildModel } from "../lib/viewer-next/model/buildModel.ts";
import { connectBrowser, pause, waitUntil } from "./viewer-browser-cdp.mjs";

const fixture = JSON.parse(await readFile(new URL("../../../fixtures/garage-house.json", import.meta.url)));
const model = buildModel(fixture);
const ids = [...model.walls, ...model.roofFaces, ...model.edges, ...model.openings, ...model.attachments].map(part => part.id);
const browser = await connectBrowser();
const output = "attached_assets/viewer-polish";
const base = `https://${process.env.REPLIT_DEV_DOMAIN}/viewer-next`;
const results = [];
const constraints = [];
await mkdir(output, { recursive: true });
const click = async selector => {
  await browser.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  // DOM wrapping and ResizeObserver feed the measured label sizes back into
  // the solver; sample only after that browser rendering cycle settles.
  await pause(200);
};
const shot = async name => writeFile(`${output}/${name}.png`,
  Buffer.from((await browser.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
const geometry = () => browser.evaluate(`(() => {
  const host = document.querySelector('[data-testid="viewer-viewport"]');
  const h = host.getBoundingClientRect();
  const rect = e => { const r=e.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom}; };
  const labels = [...document.querySelectorAll('[data-overlay-label], [data-testid="selection-label"]')]
    .map(e => ({id:e.dataset.testid,text:e.textContent,rect:rect(e)}));
  const controls = [...document.querySelectorAll('[data-control], [data-calc-bubble], .viewer-next-toast')]
    .filter(e=>e.getBoundingClientRect().width && e.getBoundingClientRect().height).map(rect);
  const overlap = (a,b) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
    Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return {
    webgl:host.dataset.webglState, constraint:host.dataset.overlayConstraint,
    selection:document.querySelector('[data-testid="selection-label"]')?.textContent,
    selectedId:document.querySelector('[data-viewer-row-id].viewer-next-selected-row')?.dataset.viewerRowId,
    labels: labels.map(l=>({...l,contained:l.rect.left>=h.left-.5&&l.rect.right<=h.right+.5&&l.rect.top>=h.top-.5&&l.rect.bottom<=h.bottom+.5})),
    collisions:labels.flatMap((l,i)=>labels.slice(i+1).filter(o=>overlap(l.rect,o.rect)>.5).map(o=>[l.id,o.id])),
    controlCollisions:labels.filter(l=>controls.some(c=>overlap(c,l.rect)>.5)).map(l=>l.id)
  };
})()`);
const drag = async (dx, dy) => {
  const p = await browser.evaluate(`(() => { const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5};})()`);
  await browser.send("Input.dispatchMouseEvent", { type: "mousePressed", ...p, button: "left", clickCount: 1 });
  for (let i=1; i<=24; i++) {
    await browser.send("Input.dispatchMouseEvent", { type:"mouseMoved",x:p.x+dx*i/24,y:p.y+dy*i/24,buttons:1 });
    await pause(20);
  }
  await browser.send("Input.dispatchMouseEvent", { type:"mouseReleased",x:p.x+dx,y:p.y+dy,button:"left",clickCount:1 });
  await pause(1000);
};
try {
  for (const [width,height] of [[390,844],[375,667],[767,1024],[768,1024],[1024,768],[1279,900],[1280,900],[1440,1000]]) {
    await browser.send("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await browser.send("Page.navigate", { url:base });
    await waitUntil(browser, `!!document.querySelector('[data-testid="label-width"]')`);
    await pause(600);
    const initial=await geometry();
    assert.equal(initial.webgl,"ready");
    assert.equal(initial.constraint,undefined,`${width} initial: ${initial.constraint}`);
    assert.ok(initial.labels.every(l=>l.contained),JSON.stringify(initial));
    assert.deepEqual(initial.collisions,[]);
    assert.deepEqual(initial.controlCollisions,[]);
    await shot(`after-${width}x${height}`);
    for(let i=0;i<3;i++) {
      await browser.evaluate(`document.querySelectorAll('[data-viewer-row-id] > button[aria-expanded="false"]').forEach(e=>e.click())`);
      await pause(80);
    }
    const selected=[];
    const modelOnly=[];
    for(const id of ids) {
      const selector=`[data-viewer-row-id="${id}"] > button`;
      const hasRow=await browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
      if(hasRow) await click(selector);
      else {
        // Opening perimeter edges intentionally have no individual panel row.
        // Exercise the live viewport-selection callback without a production test hook.
        await browser.evaluate(`(() => {
          const node=document.querySelector('[data-testid="viewer-viewport"]');
          let fiber=node[Object.keys(node).find(k=>k.startsWith('__reactFiber'))];
          while(fiber && !(fiber.memoizedProps?.model && fiber.memoizedProps?.onSelect)) fiber=fiber.return;
          if(!fiber) throw new Error('Viewport callback not found');
          fiber.memoizedProps.onSelect(${JSON.stringify(id)});
        })()`);
        await pause(200);
        modelOnly.push(id);
      }
      const state=await geometry();
      assert.ok(state.selection && (!hasRow || state.selectedId === id),`${width}: ${id} not selected`);
      assert.ok(state.labels.every(l=>l.contained),`${width} ${id}: labels outside viewport ${JSON.stringify(state)}`);
      if(state.constraint) constraints.push({width,height,id,message:state.constraint,collisions:state.collisions,controlCollisions:state.controlCollisions});
      else {
        assert.deepEqual(state.collisions,[],`${width} ${id} hidden collision`);
        assert.deepEqual(state.controlCollisions,[],`${width} ${id} hidden control collision`);
      }
      selected.push(id);
    }
    results.push({width,height,selected,modelOnly});
    if(width===1440) {
      for(const id of ["RF-1","WL-1","W-1"]) {
        await click('[data-control="reset"]');
        await click(`[data-viewer-row-id="${id}"] > button`);
        await pause(200);
        await shot(`after-selected-${id}`);
      }
      await click('[data-control="reset"]');
      await drag(180,-180);
      await shot("after-low-rear");
      await click('[data-control="reset"]');
      await drag(0,-280);
      await shot("after-underside");
      await click('[data-control="reset"]');
      await drag(230,-45);
      await shot("after-rear-contact-shadow");
    }
  }
  assert.deepEqual(browser.exceptions,[]);
} finally {
  await writeFile(`${output}/walkthrough-results.json`,JSON.stringify({results,constraints,exceptions:browser.exceptions},null,2));
  console.log(`${results.length} sizes, ${results.reduce((n,r)=>n+r.selected.length,0)} selections checked; ${constraints.length} constrained focused views recorded.`);
  browser.close();
}