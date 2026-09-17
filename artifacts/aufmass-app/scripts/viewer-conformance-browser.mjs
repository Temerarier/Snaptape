import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { connectBrowser, pause, waitUntil } from "./viewer-browser-cdp.mjs";

const browser = await connectBrowser();
const results = [];
const viewports = [];
const base = process.env.VIEWER_TEST_URL ??
  `https://${process.env.REPLIT_DEV_DOMAIN}/viewer-next`;
const fixture = JSON.parse(await readFile(new URL("../../../fixtures/garage-house.json", import.meta.url)));
const roofSum = fixture.faces.filter(face => ["RF-1", "RF-2"].includes(face.id))
  .reduce((sum, face) => sum + face.area_mm2.value / 92903.04, 0);
const check = async (name, test) => {
  try { await test(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
};
const evaluate = browser.evaluate;
const click = async selector => {
  await evaluate(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) throw new Error('Missing: '+${JSON.stringify(selector)}); node.click(); })()`);
  await pause(150);
};
const button = async text => {
  await evaluate(`(() => { const node = [...document.querySelectorAll('button')].find(n => n.textContent.trim() === ${JSON.stringify(text)}); if (!node) throw new Error('Missing button: '+${JSON.stringify(text)}); node.click(); })()`);
  await pause(150);
};
const tally = id => click(`[data-viewer-row-id="${id}"] button[title="Tally"]`);
const bubbleText = () => evaluate(`document.querySelector('[data-calc-bubble]')?.innerText ?? ''`);

try {
  await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__clipboard = '';
    window.__clipboardReject = false;
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value: {
      writeText: async text => {
        if (window.__clipboardReject) throw new Error('Permission denied for test');
        window.__clipboard = text;
      }
    }});
  ` });
  await browser.send("Emulation.setDeviceMetricsOverride", { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  // Runtime.enable replays exceptions from the previous document.
  browser.exceptions.length = 0;
  await browser.send("Page.navigate", { url:base });
  await waitUntil(browser, `document.querySelectorAll('[data-viewer-row-id]').length > 10`);
  await pause(1200);

  await check("fixture heroes and all nine cards", async () => {
    const text = await evaluate("document.body.innerText");
    assert.match(text.replaceAll(",", ""), /2097/);
    assert.match(text, /21\.0 SQ/);
    assert.match(text, /6 facets/);
    assert.match(text.replaceAll(",", ""), /2779/);
    assert.equal(await evaluate(`document.querySelectorAll('[aria-controls^="card-"]').length`), 9);
  });
  await check("RF-1 plus RF-2 uses raw fixture areas", async () => {
    await tally("RF-1"); await tally("RF-2");
    assert.match(await bubbleText(), new RegExp(Math.round(roofSum).toLocaleString("en-US")));
  });
  await check("mixed length and area stay separate", async () => {
    await tally("edge-eave");
    assert.match(await bubbleText(), /sq ft/);
    assert.match(await bubbleText(), /118' 0"/);
  });
  await check("same unit, different semantic class stays separate", async () => {
    await tally("WL-1");
    const text = await bubbleText();
    assert.match(text, /Roof/);
    assert.match(text, /Walls/);
  });
  await check("tally survives trade filters with correct card sets", async () => {
    const before = await bubbleText();
    for (const [name, count] of [["Roofing",5],["Siding",4],["Painting",4],["All",9]]) {
      await button(name);
      assert.equal(await bubbleText(), before);
      assert.equal(await evaluate(`document.querySelectorAll('[aria-controls^="card-"]').length`), count);
    }
  });
  await check("copy subtotals and truthful clipboard error", async () => {
    await click("[data-calc-bubble] button");
    assert.match(await evaluate("window.__clipboard"), /Roof/);
    await evaluate("window.__clipboardReject = true");
    await click("[data-calc-bubble] button");
    assert.match(await bubbleText(), /could not|failed|unavailable|unable/i);
    await evaluate("window.__clipboardReject = false");
  });
  await check("remove chip and clear preserve row expansion and selection", async () => {
    await click('[data-viewer-row-id="WL-1"] > button');
    assert.equal(await evaluate(`document.querySelector('[data-viewer-row-id="WL-1"] button').getAttribute('aria-expanded')`), "true");
    const remove = await evaluate(`document.querySelector('[data-calc-bubble] button[aria-label*="RF-1"]')?.getAttribute('aria-label')`);
    assert.ok(remove);
    await click(`[data-calc-bubble] button[aria-label=${JSON.stringify(remove)}]`);
    assert.doesNotMatch(await bubbleText(), /RF-1/);
    await button("Clear");
    assert.equal(await bubbleText(), "");
    assert.equal(await evaluate(`document.querySelector('[data-viewer-row-id="WL-1"] button').getAttribute('aria-expanded')`), "true");
  });
  await check("single tap row expansion persists through filters", async () => {
    await click('[data-viewer-row-id="op_window"] > button');
    await button("Roofing"); await button("All");
    assert.equal(await evaluate(`document.querySelector('[data-viewer-row-id="op_window"] button').getAttribute('aria-expanded')`), "true");
    await click('[data-viewer-row-id="op_window"] > button');
    assert.equal(await evaluate(`document.querySelector('[data-viewer-row-id="op_window"] button').getAttribute('aria-expanded')`), "false");
  });
  await check("collapsed card retains its hero", async () => {
    await click('[aria-controls="card-roof_area"]');
    assert.match(await evaluate(`document.querySelector('[aria-controls="card-roof_area"]').innerText.replaceAll(',','')`), /2097/);
    assert.equal(await evaluate(`!!document.querySelector('[data-viewer-row-id="RF-1"]')`), false);
    await click('[aria-controls="card-roof_area"]');
  });
  await check("WebGL viewport renders and selection has dimensions", async () => {
    assert.equal(await evaluate(`!!document.querySelector('.viewer-next-viewport canvas')`), true);
    await click('[data-viewer-row-id="RF-1"] > button');
    await waitUntil(browser, `!!document.querySelector('.viewer-next-selection-box')`);
    assert.match(await evaluate(`document.querySelector('.viewer-next-selection-box').innerText`), /8\/12/);
  });
  const canvasRect = () => evaluate(`(() => { const r=document.querySelector('.viewer-next-viewport canvas').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  const mouse = (type,x,y,extra={}) => browser.send("Input.dispatchMouseEvent", {type,x,y,...extra});
  await check("orbit drag does not select; reset restores framing", async () => {
    await click('[data-control="reset"]');
    await pause(300);
    const before = await evaluate(`document.querySelector('.viewer-next-dimension-label').getAttribute('style')`);
    const r = await canvasRect(), x=r.x+r.width*.45, y=r.y+r.height*.5;
    await mouse("mousePressed",x,y,{button:"left",clickCount:1});
    for(let i=1;i<=8;i++) await mouse("mouseMoved",x+i*12,y+i*3,{button:"left",buttons:1});
    await mouse("mouseReleased",x+96,y+24,{button:"left",clickCount:1});
    await pause(500);
    assert.notEqual(await evaluate(`document.querySelector('.viewer-next-dimension-label').getAttribute('style')`),before);
    assert.equal(await evaluate(`document.querySelector('.viewer-next-selection-box')?.innerText ?? null`),null);
    await click('[data-control="reset"]'); await pause(500);
    assert.equal(await evaluate(`document.querySelector('.viewer-next-dimension-label').getAttribute('style')`),before);
  });
  await check("measure two points, retain several lines, Clear and Esc", async () => {
    await click('.viewer-next-measure-wide [data-control="measure"]');
    const r=await canvasRect();
    const tap = async (fx,fy) => {
      const x=r.x+r.width*fx,y=r.y+r.height*fy;
      await mouse("mouseMoved",x,y);
      await mouse("mousePressed",x,y,{button:"left",clickCount:1});
      await mouse("mouseReleased",x,y,{button:"left",clickCount:1});
      await pause(100);
    };
    await tap(.43,.50); await tap(.57,.50);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`),1);
    await tap(.46,.54); await tap(.54,.54);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`),2);
    await click('.viewer-next-measure-wide [data-control="measure-clear"]');
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`),0);
    await tap(.43,.50); await tap(.57,.50);
    await browser.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await pause(150);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`),0);
    assert.equal(await evaluate(`!!document.querySelector('[data-control="measure-clear"]')`),false);
  });
  await check("conditions toggle shows on/off state", async () => {
    await click('[data-control="conditions"]');
    assert.equal(await evaluate(`document.querySelector('[data-control="conditions"]').getAttribute('aria-pressed')`),"true");
    await click('[data-control="conditions"]');
    assert.equal(await evaluate(`document.querySelector('[data-control="conditions"]').getAttribute('aria-pressed')`),"false");
  });

  await mkdir("attached_assets/viewer-conformance", { recursive:true });
  for (const [name, width, height] of [
    ["desktop",1440,1000], ["tablet-landscape",1190,830],
    ["tablet-portrait",830,1190], ["phone",390,844], ["narrow-phone",320,740],
  ]) {
    await browser.send("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await browser.send("Emulation.setTouchEmulationEnabled", { enabled:name!=="desktop", maxTouchPoints:5 });
    await pause(500);
    await evaluate(`document.querySelector('[data-viewer-panel-scroll]').scrollTop=0`);
    await check(`${name}: no overflow, readable type, 44px controls`, async () => {
      const metrics = await evaluate(`(() => {
        const root = document.querySelector('.viewer-next-shell');
        const rect = node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
        const visible = node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
        const smallText = [...root.querySelectorAll('*')].filter(n => visible(n) && [...n.childNodes].some(c => c.nodeType===3 && c.textContent.trim()) && parseFloat(getComputedStyle(n).fontSize)<12).map(n=>n.textContent.slice(0,50));
        const smallControls = [...root.querySelectorAll('button,input')].filter(visible).filter(n=>{const r=n.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(n=>({label:n.textContent.trim()||n.getAttribute('aria-label'),...rect(n)}));
        return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,smallText,smallControls,panel:rect(document.querySelector('.viewer-next-panel')),viewport:rect(document.querySelector('.viewer-next-viewport'))};
      })()`);
      viewports.push({name,...metrics});
      assert.ok(metrics.scrollWidth <= width, `Horizontal overflow ${metrics.scrollWidth} > ${width}`);
      assert.deepEqual(metrics.smallText, []);
      assert.deepEqual(metrics.smallControls, []);
    });
    const shot = await browser.send("Page.captureScreenshot", { format:"jpeg",quality:85 });
    await writeFile(`attached_assets/viewer-conformance/${name}.jpg`, Buffer.from(shot.data,"base64"));
    await check(`${name}: bounded tally does not cover controls or model`, async () => {
      await tally("RF-1"); await tally("RF-2"); await tally("edge-eave"); await tally("WL-1");
      const geometry = await evaluate(`(() => {
        const rect=n=>{const r=n.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        const bubble=document.querySelector('[data-calc-bubble]');
        return {bubble:rect(bubble),canvas:rect(document.querySelector('.viewer-next-viewport canvas')),width:innerWidth,
          targets:[...bubble.querySelectorAll('button')].every(b=>b.getBoundingClientRect().width>=44&&b.getBoundingClientRect().height>=44)};
      })()`);
      assert.ok(geometry.bubble.left>=0 && geometry.bubble.right<=geometry.width);
      assert.ok(geometry.bubble.bottom<=geometry.canvas.top, JSON.stringify(geometry));
      assert.equal(geometry.targets,true);
      const shot = await browser.send("Page.captureScreenshot",{format:"jpeg",quality:85});
      await writeFile(`attached_assets/viewer-conformance/${name}-calc.jpg`,Buffer.from(shot.data,"base64"));
      await button("Clear");
    });
  }
  for (const [width,height] of [[390,844],[320,640],[320,568]]) {
    await check(`${width}x${height}: active-calc detent taps, drags, selection and scroll area`, async () => {
      await browser.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
      await browser.send("Page.navigate",{url:base});
      await waitUntil(browser,`!!document.querySelector('[data-viewer-row-id="RF-1"]')`);
      await tally("RF-1");
      const heights = [];
      const metrics = () => evaluate(`(() => {
        const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
        return {detent:document.querySelector('.viewer-next-shell').dataset.panelDetent,panel:rect(document.querySelector('.viewer-next-panel')),
          scroller:rect(document.querySelector('[data-viewer-panel-scroll]')),canvas:rect(document.querySelector('.viewer-next-viewport canvas')),
          bubble:rect(document.querySelector('[data-calc-bubble]'))};
      })()`);
      for (const expected of ["half","full","peek"]) {
        await pause(250);
        const m=await metrics();
        assert.equal(m.detent,expected);
        assert.ok(Math.abs(m.panel.y - height*({half:.42,full:.12,peek:.72}[expected])) < 1, JSON.stringify(m));
        assert.ok(m.scroller.height>=63,JSON.stringify(m));
        assert.ok(m.canvas.height>0,JSON.stringify(m));
        assert.ok(m.bubble.bottom<=m.canvas.y+1,JSON.stringify(m));
        heights.push(m.panel.y);
        await click('.viewer-next-panel-handle');
      }
      assert.equal(new Set(heights).size,3,`Collapsed detents: ${heights.join(',')}`);
      const dragTo = async fraction => {
        const r=await evaluate(`(() => {const r=document.querySelector('.viewer-next-panel-handle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
        const targetY=height*fraction+22;
        await mouse("mousePressed",r.x,r.y,{button:"left",clickCount:1});
        await mouse("mouseMoved",r.x,targetY,{button:"left",buttons:1});
        await mouse("mouseReleased",r.x,targetY,{button:"left",clickCount:1});
        await pause(250);
      };
      for(const [detent,fraction] of [["full",.12],["half",.42],["peek",.72]]) {
        await dragTo(fraction);
        const m=await metrics();
        assert.equal(m.detent,detent);
        assert.ok(Math.abs(m.panel.y-height*fraction)<1,JSON.stringify(m));
      }
      await click('.viewer-next-panel-handle'); // peek -> half
      await click('[data-viewer-row-id="RF-2"] > button');
      assert.equal((await metrics()).detent,"peek");
      assert.match(await bubbleText(),/RF-1/);
      await tally("RF-2");
      assert.match(await bubbleText(),/1,346/);
      await pause(250);
      const selection = await evaluate(`(() => {
        const box=document.querySelector('.viewer-next-selection-box').getBoundingClientRect();
        const host=document.querySelector('.viewer-next-viewport').getBoundingClientRect();
        return {top:box.top,bottom:box.bottom,left:box.left,right:box.right,hostTop:host.top,hostBottom:host.bottom,width:innerWidth};
      })()`);
      assert.ok(selection.top>=selection.hostTop && selection.bottom<=selection.hostBottom+1 &&
        selection.left>=0 && selection.right<=selection.width,JSON.stringify(selection));
      await evaluate(`document.querySelector('[data-viewer-panel-scroll]').scrollTop = 500`);
      assert.ok(await evaluate(`document.querySelector('[data-viewer-panel-scroll]').scrollTop > 0`));
      const shot=await browser.send("Page.captureScreenshot",{format:"jpeg",quality:85});
      await writeFile(`attached_assets/viewer-conformance/active-detents-${width}x${height}.jpg`,Buffer.from(shot.data,"base64"));
      await button("Clear");
    });
  }
  await check("no uncaught browser errors", async () => assert.deepEqual(browser.exceptions, []));
} finally {
  browser.close();
}
await writeFile("attached_assets/viewer-conformance/browser-results.json", JSON.stringify({results,viewports},null,2));
const failed = results.filter(result=>!result.passed);
console.log(`Browser checks: ${results.length-failed.length} passed, ${failed.length} failed`);
for (const failure of failed) console.log(`FAIL ${failure.name}: ${failure.error}`);
process.exitCode = failed.length ? 1 : 0;