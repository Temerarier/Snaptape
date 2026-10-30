import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pause, waitUntil } from "../../artifacts/aufmass-app/scripts/viewer-browser-cdp.mjs";

export async function checkVarianteA(browser,c,shots) {
  const result={views:[], clicks:[]};
  const capture=async label=>{
    const filename=`${shots}/${c.id}-${label}.png`;
    const image=await browser.send("Page.captureScreenshot",{format:"png"});
    await writeFile(filename,Buffer.from(image.data,"base64"));
    return filename;
  };
  const click=async p=>{
    await browser.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:p.x,y:p.y});
    await browser.send("Input.dispatchMouseEvent",{type:"mousePressed",x:p.x,y:p.y,button:"left",buttons:1,clickCount:1});
    await browser.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:p.x,y:p.y,button:"left",buttons:0,clickCount:1});
    await pause(250);
  };
  assert.equal(await browser.evaluate("window.inventoryState().source"),"model3d");
  assert.equal(await browser.evaluate("window.inventoryState().webgl"),"ready");
  for(const [view,angle] of [["front",.6],["back",.6+Math.PI]]) {
    const camera=await browser.evaluate(`window.inventoryView(${angle})`);
    assert.ok(camera.framed,`${view}: geometry bounds do not fit in viewport`);
    await pause(700);
    const render=await browser.evaluate("window.inventoryRender");
    assert.ok(render.triangles>0 && render.glError===0 && !render.contextLost,JSON.stringify(render));
    result.views.push({view,camera,render,screenshot:await capture(view)});
  }
  if(c.presentationOnly) {
    result.colors=await browser.evaluate("window.inventoryColors()");
    assert.ok(result.colors.walls.length && result.colors.roofs.length,"Missing colored roof/walls");
    assert.ok(result.colors.walls.every(w=>/^#[0-9a-f]{6}$/i.test(w.hex) && !w.neutral));
    assert.ok(result.colors.roofs.every(w=>/^#[0-9a-f]{6}$/i.test(w.hex) && !w.neutral));
    const link=await browser.evaluate(`(()=>{const a=document.querySelector('a[aria-label="Projects"]');return {href:a?.getAttribute("href"),text:a?.innerText}})()`);
    assert.equal(link.href,"/app");
    assert.ok(link.text.includes("Projects"));
    await browser.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await pause(700);
    result.mobileScreenshot=await capture("ready-390");
    result.mobile=await browser.evaluate(`(()=>{const a=document.querySelector('a[aria-label="Projects"]');return {overflow:document.documentElement.scrollWidth>innerWidth,backText:a?.innerText,backLabel:a?.getAttribute("aria-label")}})()`);
    assert.equal(result.mobile.overflow,false);
    assert.equal(result.mobile.backText.trim(),"←");
    if(c.id==="leipzig-villa") {
      await browser.evaluate(`window.mountInventory(${JSON.stringify(c.id)},${JSON.stringify(c.measurement)},${JSON.stringify(c.model3d)},"pending")`);
      await pause(300);
      assert.ok(await browser.evaluate(`!!document.querySelector('[data-model3d-state="pending"] .animate-spin')`));
      assert.ok(await browser.evaluate(`document.body.innerText.includes("This usually takes 1–3 minutes.")`));
      result.pendingMobileScreenshot=await capture("pending-390");
      await browser.send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
      await pause(300);
      result.pendingDesktopScreenshot=await capture("pending-desktop");
      await waitUntil(browser,"window.inventoryRefreshes>0",12000);
      result.pendingRefreshes=await browser.evaluate("window.inventoryRefreshes");
      await browser.evaluate(`window.mountInventory(${JSON.stringify(c.id)},${JSON.stringify(c.measurement)},${JSON.stringify(c.model3d)},"ready")`);
      await waitUntil(browser,"window.inventoryState().webgl==='ready' && window.inventoryRender?.triangles>0",20000);
      assert.equal(await browser.evaluate(`!!document.querySelector('[data-model3d-state="pending"]')`),false);
      result.readyAfterPendingScreenshot=await capture("ready-after-pending");
    }
    await browser.send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    return result;
  }
  try {
  if(c.id==="leipzig-villa") {
    await browser.evaluate("document.querySelector('[data-control=\"conditions\"]').click()");
    await pause(200);
    for(const id of c.onlyDownspout?["DS-1"]:["WL-1","CA-1","DS-1"]) {
      let point;
      for(const angle of [0,.6,-.6,Math.PI/2,-Math.PI/2,Math.PI,Math.PI+.6,Math.PI-.6]) {
        await browser.evaluate(`window.inventoryView(${angle})`);
        await pause(250);
        point=await browser.evaluate(`window.inventoryPick(${JSON.stringify(id)})`);
        if(point)break;
      }
      if(!point) {
        await browser.evaluate("window.inventoryView(-Math.PI/2)");
        await pause(250);
        point=await browser.evaluate(`window.inventoryPick(${JSON.stringify(id)},true)`);
        assert.ok(point,`No projected geometry for ${id}`);
        await click(point);
        const state=await browser.evaluate("window.inventoryState()");
        result.clicks.push({id,point,state,occlusionProbe:true,screenshot:await capture(`click-${id}`)});
        assert.ok(state.selected.includes(id),`Click on projected ${id} selected ${JSON.stringify(state.selected)} instead; nearest raycast hit: ${point.predictedHit}`);
        continue;
      }
      await click(point);
      await waitUntil(browser,`window.inventoryState().selected.includes(${JSON.stringify(id)})`,4000);
      const state=await browser.evaluate("window.inventoryState()");
      if(id==="WL-1")assert.match(state.blackbox??"",/14,300 mm.*8,140 mm/);
      result.clicks.push({id,point,state,screenshot:await capture(`click-${id}`)});
    }
  }
  if(c.id==="farmhouse-140040rk") {
    await browser.evaluate("window.inventoryView(0)");
    await pause(300);
    await browser.evaluate("document.querySelector('[data-control=\"measure\"]').click()");
    const eave=await browser.evaluate("window.inventoryEave()");
    assert.ok(eave.start.visible && eave.midpoint.visible,`Eave outside viewport: ${JSON.stringify(eave)}`);
    await browser.send("Input.dispatchMouseEvent",{type:"mouseMoved",x:eave.midpoint.x,y:eave.midpoint.y});
    await pause(300);
    result.snapPreview=await browser.evaluate("document.querySelector('.viewer-next-snap-label')?.textContent");
    result.snapScreenshot=await capture("eave-snap");
    assert.equal(result.snapPreview,"edge snap","Production viewport did not report an edge snap at eave midpoint");
    await click(eave.start);
    await click(eave.midpoint);
    await waitUntil(browser,"window.inventoryState().measures.length>0",4000);
    result.eave={...eave,state:await browser.evaluate("window.inventoryState()"),screenshot:await capture("eave-measure")};
  }
  } catch(error) {
    result.interactionError=String(error);
    result.failureScreenshot=await capture("interaction-failure");
  }
  return result;
}
