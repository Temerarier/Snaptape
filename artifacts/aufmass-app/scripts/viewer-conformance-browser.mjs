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
    ["desktop",1440,1000], ["tablet-landscape",1024,768],
    ["tablet-portrait",768,1024], ["phone",390,844], ["short-phone",375,667],
    ["phone-boundary",767,900], ["wide-landscape-boundary",1279,900],
    ["desktop-boundary",1280,900],
    ["narrow-landscape",768,600], ["compact-landscape",840,600],
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
    if (width >= 768 && width < 1024 && width > height) {
      await check(`${name}: all header controls remain visible and operable`, async () => {
        const controls = await evaluate(`(() => {
          const header=document.querySelector('.viewer-next-header').getBoundingClientRect();
          const panel=document.querySelector('.viewer-next-panel').getBoundingClientRect();
          return {panelWidth:panel.width,items:[...document.querySelectorAll('.viewer-next-header button')].map(b=>{
            const r=b.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return {label:b.textContent.trim(),contained:r.left>=header.left&&r.right<=header.right&&r.top>=header.top&&r.bottom<=header.bottom,hit:top===b||b.contains(top),x:r.x+r.width/2,y:r.y+r.height/2};
          })};
        })()`);
        assert.equal(controls.panelWidth,480);
        assert.ok(controls.items.every(c=>c.contained&&c.hit),JSON.stringify(controls));
        for (const control of controls.items) {
          await mouse("mousePressed",control.x,control.y,{button:"left",clickCount:1});
          await mouse("mouseReleased",control.x,control.y,{button:"left",clickCount:1});
          await pause(100);
        }
        assert.match(await evaluate(`document.querySelector('.viewer-next-toast')?.textContent ?? ''`),/photo|capture/i);
        assert.equal(await evaluate(`document.querySelector('[data-control="conditions"]').getAttribute('aria-pressed')`),"true");
        assert.equal(await evaluate(`document.querySelector('.viewer-next-selection-box')?.innerText ?? null`),null);
        await click('[data-control="conditions"]');
      });
    }
    await check(`${name}: tally presentation matches the responsive contract`, async () => {
      await tally("RF-1"); await tally("RF-2"); await tally("edge-eave"); await tally("WL-1");
      const geometry = await evaluate(`(() => {
        const rect=n=>{const r=n.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
        const bubble=document.querySelector('[data-calc-bubble]');
         const pill=document.querySelector('.viewer-next-measure-wide');
        return {bubble:rect(bubble),canvas:rect(document.querySelector('.viewer-next-viewport canvas')),width:innerWidth,
           pill:pill && getComputedStyle(pill).display!=="none" ? rect(pill) : null,
          targets:[...bubble.querySelectorAll('button')].every(b=>b.getBoundingClientRect().width>=44&&b.getBoundingClientRect().height>=44)};
      })()`);
      assert.ok(geometry.bubble.left>=0 && geometry.bubble.right<=geometry.width);
       if (geometry.pill) {
         const intersects = geometry.bubble.left < geometry.pill.right &&
           geometry.bubble.right > geometry.pill.left &&
           geometry.bubble.top < geometry.pill.bottom &&
           geometry.bubble.bottom > geometry.pill.top;
         assert.equal(intersects, false, JSON.stringify(geometry));
       }
       if (width < 768) {
         assert.ok(Math.abs(geometry.bubble.bottom - height) < 1, JSON.stringify(geometry));
         assert.ok(geometry.canvas.bottom <= geometry.bubble.top, JSON.stringify(geometry));
         const calcScroll = await evaluate(`(() => {
           const bubble=document.querySelector('[data-calc-bubble]');
           bubble.scrollTop=bubble.scrollHeight;
           return {top:bubble.scrollTop,max:bubble.scrollHeight-bubble.clientHeight};
         })()`);
         assert.ok(calcScroll.top >= calcScroll.max - 1, JSON.stringify(calcScroll));
       }
      assert.equal(geometry.targets,true);
      const shot = await browser.send("Page.captureScreenshot",{format:"jpeg",quality:85});
      await writeFile(`attached_assets/viewer-conformance/${name}-calc.jpg`,Buffer.from(shot.data,"base64"));
      await button("Clear");
    });
  }
  for (const [width,height] of [[390,844],[375,667],[767,900],[768,1024]]) {
    await check(`${width}x${height}: fixed split and full-model states`, async () => {
      await browser.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
      await browser.send("Page.navigate",{url:base});
      await waitUntil(browser,`!!document.querySelector('[data-viewer-row-id="RF-1"]')`);
      await tally("RF-1");
      const metrics = () => evaluate(`(() => {
        const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
         return {mode:document.querySelector('.viewer-next-shell').dataset.layoutMode,panel:rect(document.querySelector('.viewer-next-panel')),
           model:rect(document.querySelector('.viewer-next-model-section')),
          scroller:rect(document.querySelector('[data-viewer-panel-scroll]')),canvas:rect(document.querySelector('.viewer-next-viewport canvas')),
           bubble:rect(document.querySelector('[data-calc-bubble]')),
           toggle:rect(document.querySelector('.viewer-next-layout-toggle')),
           handle:document.querySelector('.viewer-next-panel-handle'),
           modelOverflow:getComputedStyle(document.querySelector('.viewer-next-model-section')).overflowY};
      })()`);
       let m=await metrics();
       assert.equal(m.mode,"split");
       assert.ok(m.model.height>=321,JSON.stringify(m));
       assert.ok(m.canvas.height>=260,JSON.stringify(m));
       assert.ok(m.panel.height>0 && m.scroller.height>=63,JSON.stringify(m));
       assert.equal(m.handle,null);
       assert.equal(m.modelOverflow,"hidden");
       assert.ok(m.toggle.height>=44 && m.toggle.bottom<=height,JSON.stringify(m));
       await click('.viewer-next-layout-toggle');
       m=await metrics();
       assert.equal(m.mode,"model");
       assert.ok(m.model.height>260,JSON.stringify(m));
       assert.ok(m.panel.height<1,JSON.stringify(m));
       assert.ok(m.toggle.height>=44 && m.toggle.bottom<=height,JSON.stringify(m));
       await click('.viewer-next-layout-toggle');
       assert.equal((await metrics()).mode,"split");
      await click('[data-viewer-row-id="RF-2"] > button');
       assert.equal((await metrics()).mode,"split");
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
       await writeFile(`attached_assets/viewer-conformance/two-state-${width}x${height}.jpg`,Buffer.from(shot.data,"base64"));
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