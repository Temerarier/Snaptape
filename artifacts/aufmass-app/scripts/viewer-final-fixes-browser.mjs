// Final real-WebGL verification for .local/tasks/viewer-five-final-fixes.md.
// Prerequisite: the real Chromium test browser is already listening on 9223.
// Run (only after the 5B checkpoint): pnpm exec tsx artifacts/aufmass-app/scripts/viewer-final-fixes-browser.mjs
//
// Test-only bridges are deliberately limited to:
// 1. calling the live ViewerViewport onMeasurePoint prop with model dimension
//    endpoints, so the user-measure preservation check has no fragile canvas
//    coordinates; and
// 2. temporarily emptying the live ViewerNextClient measurement.condition_areas
//    prop to exercise the empty-data UI. Navigation immediately restores the
//    canonical fixture. No production test hook is required.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  computeDerived,
  formatFeetInches,
  formatSquareFeet,
  mm2ToSquareFeet,
  mmToInches,
} from "../../../lib/measurement/src/index.ts";
import { connectBrowser, pause, waitUntil } from "./viewer-browser-cdp.mjs";

const fixture = JSON.parse(await readFile(new URL("../../../fixtures/garage-house.json", import.meta.url)));
const derived = computeDerived(fixture);
const output = "attached_assets/viewer-final-fixes";
const base = process.env.VIEWER_TEST_URL ??
  `https://${process.env.REPLIT_DEV_DOMAIN}/viewer-next`;
const browser = await connectBrowser();
const results = [];
const evidence = {
  browser: "realChromium9223 (real Chromium CDP on localhost:9223)",
  clipboard: "navigator.clipboard.writeText stub installed before navigation",
  testOnlyBridges: [
    "live ViewerViewport onMeasurePoint callback with permanent-dimension endpoints",
    "live ViewerNextClient measurement.condition_areas temporary in-memory mutation",
  ],
  viewports: [],
};

const check = async (name, test) => {
  try {
    await test();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error?.stack ?? String(error) });
  }
};
const evaluate = browser.evaluate;
const visible = selector => `(() => [...document.querySelectorAll(${JSON.stringify(selector)})]
  .find(node => { const r=node.getBoundingClientRect(); const s=getComputedStyle(node);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; }))()`;
const click = async selector => {
  await evaluate(`(() => { const node=${visible(selector)}; if(!node) throw new Error("Missing visible control: "+${JSON.stringify(selector)}); node.click(); })()`);
  await pause(180);
};
const settle = async (expression = "true") => {
  await waitUntil(browser, expression);
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  let previous = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const signature = await evaluate(`(() => [
      document.querySelectorAll('[data-overlay-label]').length,
      document.querySelectorAll('[data-testid^="dimension-stroke-"]').length,
      document.querySelector('[data-testid="viewer-viewport"]')?.dataset.webglState,
      document.querySelector('[data-testid="viewer-viewport"]')?.dataset.overlayConstraint ?? "",
      document.body.scrollWidth, document.body.scrollHeight
    ].join("|"))()`);
    if (signature === previous) return;
    previous = signature;
    await pause(120);
  }
};
const navigate = async (width, height) => {
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await browser.send("Emulation.setTouchEmulationEnabled", {
    enabled: width < 1024, maxTouchPoints: 5,
  });
  browser.exceptions.length = 0;
  await browser.send("Page.navigate", { url: base });
  await settle(`document.querySelector('[data-testid="viewer-viewport"]')?.dataset.webglState === "ready" &&
    !!document.querySelector('[data-viewer-row-id="op_window"]')`);
};
const screenshot = async name => {
  const image = await browser.send("Page.captureScreenshot", { format: "png" });
  await writeFile(`${output}/${name}.png`, Buffer.from(image.data, "base64"));
};
const ensureExpanded = async id => {
  const selector = `[data-viewer-row-id="${id}"] > button`;
  await waitUntil(browser, `!!document.querySelector(${JSON.stringify(selector)})`);
  if (await evaluate(`document.querySelector(${JSON.stringify(selector)}).getAttribute("aria-expanded")==="false"`))
    await click(selector);
  await settle();
};
const dimensionsState = () => evaluate(`(() => ({
  labels:[...document.querySelectorAll('[data-overlay-label]')]
    .filter(n=>["length","depth","eave"].includes(n.dataset.overlayLabel))
    .map(n=>({id:n.dataset.overlayLabel,text:n.textContent.trim(),aria:n.getAttribute("aria-label")})),
  strokes:[...document.querySelectorAll('[data-testid^="dimension-stroke-"]')]
    .map(n=>n.dataset.dimensionId),
  ridgeLabels:[...document.querySelectorAll('[data-overlay-label]')]
    .filter(n=>/ridge/i.test((n.dataset.overlayLabel||"")+" "+n.textContent)).length
}))()`);
const dimensionControl = width => width < 768
  ? '[data-control="dimensions-mobile"], [aria-label="Show dimensions"]'
  : '[data-control="dimensions"], [aria-label="Show dimensions"]';
const conditionsControl = width => width < 768
  ? '[data-control="conditions-mobile"]'
  : '[data-control="conditions"]';
const rowData = id => evaluate(`(() => {
  const row=document.querySelector('[data-viewer-row-id="${id}"]');
  if(!row) return null;
  return {
    text:row.innerText.replace(/\\s+/g," ").trim(),
    label:row.querySelector('.viewer-next-row-label > div')?.textContent.trim(),
    value:row.querySelector('.viewer-next-row-value')?.innerText.replace(/\\s+/g," ").trim(),
    copyDisabled:row.querySelector('button[aria-label="Copy"]')?.disabled,
    tallyDisabled:row.querySelector('button[aria-label="Tally"]')?.disabled,
  };
})()`);
const invokeViewportProp = async (prop, argument) => {
  await evaluate(`(() => {
    const node=document.querySelector('[data-testid="viewer-viewport"]');
    let fiber=node?.[Object.keys(node).find(key=>key.startsWith('__reactFiber'))];
    while(fiber && typeof fiber.memoizedProps?.[${JSON.stringify(prop)}] !== "function") fiber=fiber.return;
    if(!fiber) throw new Error("Live ViewerViewport callback not found: "+${JSON.stringify(prop)});
    fiber.memoizedProps[${JSON.stringify(prop)}](${JSON.stringify(argument)});
  })()`);
  await settle();
};

const expectedDimensionLabels = new Map([
  ["length", formatFeetInches(mmToInches(derived.footprint.length_mm.value))],
  ["depth", formatFeetInches(mmToInches(derived.footprint.depth_mm.value))],
  ["eave", formatFeetInches(mmToInches(derived.footprint.eave_height_mm.value))],
]);
assert.deepEqual([...expectedDimensionLabels.values()], [`40' 0"`, `28' 0"`, `18' 0"`]);

try {
  await mkdir(output, { recursive: true });
  await browser.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__viewerFinalClipboard = "";
    Object.defineProperty(navigator, "clipboard", { configurable:true, value:{
      writeText: async text => { window.__viewerFinalClipboard = String(text); }
    }});
  ` });

  await navigate(1440, 1000);
  await check("all derived opening parent groups show count, perimeter, area, copy and tally", async () => {
    const groupedTypes = [...new Set(derived.openings.items.map(item => item.type))]
      .filter(type => derived.openings.items.filter(item => item.type === type).length > 6);
    assert.ok(groupedTypes.includes("window"));
    for (const type of groupedTypes) {
      await ensureExpanded(`op_${type}`);
      for (const group of derived.openings.parentGroups.filter(item => item.type === type)) {
        const id = `og_${type}_${group.parent_face_id ?? `unassigned_${group.elevation ?? "unknown"}`}`;
        const row = await rowData(id);
        assert.ok(row, `Missing derived parent group ${id}`);
        const area = group.area_mm2.value === null ? "—" :
          formatSquareFeet(mm2ToSquareFeet(group.area_mm2.value)).replace(" sq ft", "");
        const perimeter = group.perimeter.total_mm.value === null ? "—" :
          formatFeetInches(mmToInches(group.perimeter.total_mm.value));
        assert.match(row.text, new RegExp(`${group.count.value} EA`));
        assert.ok(row.text.includes(`Perimeter ${perimeter}`), `${id}: ${row.text}`);
        assert.equal(row.value, `${area} sq ft`);
        assert.equal(row.copyDisabled, false);
        assert.equal(row.tallyDisabled, false);

        await click(`[data-viewer-row-id="${id}"] button[aria-label="Copy"]`);
        assert.equal(await evaluate("window.__viewerFinalClipboard"), `${row.label}: ${area} sq ft`);
        await click(`[data-viewer-row-id="${id}"] button[aria-label="Tally"]`);
        const bubble = await evaluate(`document.querySelector('[data-calc-bubble]')?.innerText ?? ""`);
        assert.ok(bubble.includes(Math.round(mm2ToSquareFeet(group.area_mm2.value)).toLocaleString("en-US")),
          `${id} tally did not contain derived area: ${bubble}`);
        await click(`[data-viewer-row-id="${id}"] button[aria-label="Tally"]`);
      }
    }
  });

  await check("conditions expose two truthful dark callouts and selection reveals hidden conditions", async () => {
    assert.equal(await evaluate(`${visible('[data-control="conditions"]')}.getAttribute("aria-pressed")`), "false");
    await ensureExpanded("CA-1");
    await click('[data-viewer-row-id="CA-1"] > button');
    await settle(`document.querySelector('[data-control="conditions"]').getAttribute("aria-pressed")==="true" &&
      document.querySelectorAll('.viewer-next-condition-label').length===2`);
    const state = await evaluate(`(() => {
      const viewport=document.querySelector('[data-testid="viewer-viewport"]');
      let fiber=viewport[Object.keys(viewport).find(key=>key.startsWith('__reactFiber'))];
      while(fiber && !Array.isArray(fiber.memoizedProps?.model?.conditions)) fiber=fiber.return;
      const metadata=fiber?.memoizedProps.model.conditions.map(c=>({
        id:c.id,type:c.type,parentFaceId:c.parentFaceId,elevation:c.elevation,
        severity:c.severity,area:c.areaMm2,photoIndex:c.photoIndex
      }));
      const labels=[...document.querySelectorAll('.viewer-next-condition-label')].map(node=>{
        const color=getComputedStyle(node).backgroundColor;
        const rgb=(color.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
        return {text:node.innerText,background:color,dark:rgb.length===3&&Math.max(...rgb)<100};
      });
      return {
        metadata, labels,
        connectors:document.querySelectorAll('[data-testid^="connector-condition-"]').length,
        selected:document.querySelector('[data-viewer-row-id="CA-1"]').classList.contains('viewer-next-selected-row'),
        viewportSelectedId:fiber?.memoizedProps.selectedId,
        viewportConditions:fiber?.memoizedProps.showConditions
      };
    })()`);
    assert.equal(state.metadata.length, 2);
    assert.deepEqual(state.metadata.map(item => item.id).sort(), ["CA-1", "CA-2"]);
    for (const expected of fixture.condition_areas) {
      const actual = state.metadata.find(item => item.id === expected.id);
      assert.ok(actual);
      assert.equal(actual.type, expected.type);
      assert.equal(actual.parentFaceId, expected.parent_face_id);
      assert.equal(actual.elevation, expected.elevation);
      assert.equal(actual.severity, expected.severity);
      assert.equal(actual.photoIndex, expected.photo_index);
      assert.equal(actual.area, expected.area_mm2.value);
    }
    assert.equal(state.labels.length, 2);
    assert.ok(state.labels.every(label => label.dark), JSON.stringify(state.labels));
    assert.ok(state.labels.some(label => /Photo #4/.test(label.text)), JSON.stringify(state.labels));
    assert.ok(state.labels.some(label => /Photo #3/.test(label.text)), JSON.stringify(state.labels));
    assert.equal(state.connectors, 2);
    assert.equal(state.selected, true);
    assert.equal(state.viewportSelectedId, "CA-1");
    assert.equal(state.viewportConditions, true);
  });

  await check("conditions off remove labels, connectors, and their layout reservations", async () => {
    await click('[data-control="conditions"]');
    await settle(`document.querySelector('[data-control="conditions"]').getAttribute("aria-pressed")==="false"`);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-condition-label,[data-testid^="connector-condition-"]').length`), 0);
    const after = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-overlay-label="length"],[data-overlay-label="depth"],[data-overlay-label="eave"]')].map(n=>[n.dataset.overlayLabel,n.getAttribute("style")]))`);
    await click('[data-control="conditions"]');
    await settle(`document.querySelectorAll('.viewer-next-condition-label').length===2`);
    await click('[data-control="conditions"]');
    await settle(`document.querySelectorAll('.viewer-next-condition-label').length===0`);
    const restored = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-overlay-label="length"],[data-overlay-label="depth"],[data-overlay-label="eave"]')].map(n=>[n.dataset.overlayLabel,n.getAttribute("style")]))`);
    assert.equal(restored, after);
  });

  await check("empty live measurement retains toggle and shows exact notice", async () => {
    await evaluate(`(() => {
      const viewport=document.querySelector('[data-testid="viewer-viewport"]');
      let fiber=viewport[Object.keys(viewport).find(key=>key.startsWith('__reactFiber'))];
      while(fiber && !Array.isArray(fiber.memoizedProps?.measurement?.condition_areas)) fiber=fiber.return;
      if(!fiber) throw new Error("Live ViewerNextClient measurement prop not found");
      window.__viewerFinalSavedConditions=[...fiber.memoizedProps.measurement.condition_areas];
      fiber.memoizedProps.measurement.condition_areas.splice(0);
    })()`);
    await click('[data-control="conditions"]');
    await settle(`document.querySelector('.viewer-next-toast')?.textContent.trim()==="No conditions recorded."`);
    assert.equal(await evaluate(`document.querySelector('[data-control="conditions"]').getAttribute("aria-pressed")`), "true");
    assert.equal(await evaluate(`document.querySelector('.viewer-next-toast').textContent.trim()`), "No conditions recorded.");
  });

  const viewports = [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["phone", 390, 844],
    ["short-phone", 375, 667],
    ["narrow-landscape", 768, 600],
    ["compact-landscape", 840, 600],
  ];
  for (const [name, width, height] of viewports) {
    await navigate(width, height);
    await check(`${name}: corrected dimensions default on with exact labels`, async () => {
      const state = await dimensionsState();
      assert.equal(state.ridgeLabels, 0);
      assert.equal(state.labels.length, 3, JSON.stringify(state));
      assert.deepEqual(new Map(state.labels.map(item => [item.id, item.text])), expectedDimensionLabels);
      assert.deepEqual([...new Set(state.strokes)].sort(), ["depth", "eave", "length"]);
      assert.match(state.labels.find(item => item.id === "eave").aria, /eave height/i);
    });

    await check(`${name}: dimensions off preserve measure, selection, and conditions; on restores exactly three`, async () => {
      await ensureExpanded("CA-1");
      await click('[data-viewer-row-id="CA-1"] > button');
      const segment = await evaluate(`(() => {
        const viewport=document.querySelector('[data-testid="viewer-viewport"]');
        let fiber=viewport[Object.keys(viewport).find(key=>key.startsWith('__reactFiber'))];
        while(fiber && !fiber.memoizedProps?.model?.permanentDimensions?.length) fiber=fiber.return;
        const s=fiber?.memoizedProps.model.permanentDimensions.length.segments[0];
        if(!s) throw new Error("Permanent length segment unavailable");
        return {start:s.start,end:s.end};
      })()`);
      await invokeViewportProp("onMeasurePoint", segment.start);
      await invokeViewportProp("onMeasurePoint", segment.end);
      assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`), 1);
      await click(dimensionControl(width));
      await settle();
      const off = await dimensionsState();
      assert.equal(off.labels.length, 0);
      assert.equal(off.strokes.length, 0);
      assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`), 1);
      assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-condition-label').length`), 2);
      assert.ok(await evaluate(`document.querySelector('[data-viewer-row-id="CA-1"]').classList.contains('viewer-next-selected-row')`));
      assert.equal(await evaluate(`(() => {
        const viewport=document.querySelector('[data-testid="viewer-viewport"]');
        let fiber=viewport[Object.keys(viewport).find(key=>key.startsWith('__reactFiber'))];
        while(fiber && !("selectedId" in (fiber.memoizedProps||{}))) fiber=fiber.return;
        return fiber?.memoizedProps.selectedId;
      })()`), "CA-1");
      await click(dimensionControl(width));
      await settle();
      const on = await dimensionsState();
      assert.equal(on.labels.length, 3);
      assert.deepEqual(new Map(on.labels.map(item => [item.id, item.text])), expectedDimensionLabels);
    });

    if (width < 768) {
      await check(`${name}: four accessible 44px phone controls use SVG icons`, async () => {
        const controls = await evaluate(`(() => [...document.querySelectorAll('.viewer-next-mobile-controls > button')]
          .filter(node=>node.getBoundingClientRect().width>0 && node.dataset.control!=="measure-clear-mobile").map(node=>{
            const r=node.getBoundingClientRect();
            return {control:node.dataset.control,label:node.getAttribute('aria-label'),
              title:node.getAttribute('title'),width:r.width,height:r.height,svg:!!node.querySelector('svg')};
          }))()`);
        assert.equal(controls.length, 4, JSON.stringify(controls));
        assert.deepEqual(controls.slice(0, 3).map(item => item.control),
          ["measure", "conditions-mobile", "reset-mobile"]);
        assert.ok(/dimension/.test(controls[3].control));
        assert.ok(controls.every(item => item.label && item.title && item.svg));
        assert.ok(controls.every(item => item.width >= 44 && item.height >= 44));
      });
    } else {
      await check(`${name}: desktop/tablet dimension switch is accessible`, async () => {
        const control = await evaluate(`(() => {
          const node=${visible(dimensionControl(width))}; const r=node?.getBoundingClientRect();
          return node&&{label:node.getAttribute('aria-label')||node.textContent.trim(),
            pressed:node.getAttribute('aria-pressed'),width:r.width,height:r.height};
        })()`);
        assert.ok(control);
        assert.match(control.label, /show dimensions/i);
        assert.equal(control.pressed, "true");
        assert.ok(control.width >= 44 && control.height >= 44);
      });
    }

    if ((width === 768 || width === 840) && height === 600) {
      await check(`${name}: every visible header control is contained and hit-testable`, async () => {
        const controls = await evaluate(`(() => {
          const header=document.querySelector('.viewer-next-header').getBoundingClientRect();
          return [...document.querySelectorAll('.viewer-next-header button')].filter(node=>{
            const r=node.getBoundingClientRect(); return r.width>0&&r.height>0;
          }).map(node=>{ const r=node.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return {label:node.getAttribute('aria-label')||node.textContent.trim(),
              contained:r.left>=header.left-.5&&r.right<=header.right+.5&&r.top>=header.top-.5&&r.bottom<=header.bottom+.5,
              hit:hit===node||node.contains(hit),width:r.width,height:r.height};
          });
        })()`);
        assert.ok(controls.some(control => /dimensions/i.test(control.label)));
        assert.ok(controls.every(control => control.contained && control.hit), JSON.stringify(controls));
        assert.ok(controls.every(control => control.width >= 44 && control.height >= 44));
      });
    }

    await click(conditionsControl(width));
    await settle(`document.querySelectorAll('.viewer-next-condition-label').length===0`);
    await click(conditionsControl(width));
    await settle(`document.querySelectorAll('.viewer-next-condition-label').length===2`);
    await screenshot(`${name}-${width}x${height}-conditions-dimensions`);
    evidence.viewports.push({ name, width, height,
      screenshot: `${name}-${width}x${height}-conditions-dimensions.png` });
    await check(`${name}: no uncaught browser errors`, async () => {
      assert.deepEqual(browser.exceptions, []);
    });
  }
} finally {
  browser.close();
}

await writeFile(`${output}/browser-results.json`, JSON.stringify({ results, evidence }, null, 2));
const failed = results.filter(result => !result.passed);
console.log(`Viewer final fixes: ${results.length - failed.length} passed, ${failed.length} failed`);
for (const failure of failed) console.log(`FAIL ${failure.name}: ${failure.error}`);
process.exitCode = failed.length ? 1 : 0;