// Dedicated real-WebGL orbit verification for viewer-five-final-fixes.
// Prerequisite: realChromium9223 is already running with the app loaded.
// Run: pnpm exec tsx artifacts/aufmass-app/scripts/viewer-final-orbit-browser.mjs
//
// Test-only bridge disclosure: ViewerViewport's live React painter ref is read
// from its existing useRef hook. It is used only to set exact camera radius and
// 15-degree azimuth increments, inspect camera/renderer metadata, and trigger
// the same OrbitControls change rendering used by pointer orbit. This makes
// three repeatable 360-degree, 24-step orbits without adding a production hook.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { connectBrowser, pause, waitUntil } from "./viewer-browser-cdp.mjs";

const execFileAsync = promisify(execFile);
const output = "attached_assets/viewer-final-fixes/orbit";
const base = process.env.VIEWER_TEST_URL ??
  `https://${process.env.REPLIT_DEV_DOMAIN}/viewer-next`;
const browser = await connectBrowser();
const results = [];
const evidence = {
  browser: "realChromium9223 (Chromium CDP localhost:9223)",
  bridge: "live ViewerViewport painter useRef; no production test hook",
  limits: null,
  orbits: [],
  screenshots: [],
  browserExceptions: [],
  physicalGpuOrSafariVerified: false,
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
const settle = async (expression = "true") => {
  await waitUntil(browser, expression);
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  await pause(250);
};
const navigate = async (width, height) => {
  await browser.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await browser.send("Emulation.setTouchEmulationEnabled", {
    enabled: width < 768, maxTouchPoints: 5,
  });
  browser.exceptions.length = 0;
  await browser.send("Page.navigate", { url: base });
  await settle(`document.querySelector('[data-testid="viewer-viewport"]')?.dataset.webglState==="ready" &&
    document.querySelectorAll('[data-overlay-label="length"],[data-overlay-label="depth"],[data-overlay-label="eave"]').length===3`);
};
const click = async selector => {
  await evaluate(`(() => {
    const node=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>{
      const r=n.getBoundingClientRect(); return r.width>0&&r.height>0;
    });
    if(!node) throw new Error("Missing visible control: "+${JSON.stringify(selector)});
    node.click();
  })()`);
  await settle();
};
const shot = async name => {
  const image = await browser.send("Page.captureScreenshot", { format: "png" });
  const path = `${output}/${name}.png`;
  await writeFile(path, Buffer.from(image.data, "base64"));
  evidence.screenshots.push(path);
  return path;
};
const painterExpression = body => `(() => {
  const host=document.querySelector('[data-testid="viewer-viewport"]');
  let fiber=host?.[Object.keys(host).find(key=>key.startsWith('__reactFiber'))];
  while(fiber && typeof fiber.type!=="function" && typeof fiber.type?.render!=="function") fiber=fiber.return;
  let hook=fiber?.memoizedState, painter=null;
  while(hook) {
    const candidate=hook.memoizedState?.current;
    if(candidate?.camera?.isPerspectiveCamera && candidate?.controls && candidate?.renderer) {
      painter=candidate; break;
    }
    hook=hook.next;
  }
  if(!painter) throw new Error("Live ViewerViewport painter ref not found");
  ${body}
})()`;
const cameraMetadata = () => evaluate(painterExpression(`
  const p=painter.camera.position,t=painter.controls.target;
  return {
    near:painter.camera.near,far:painter.camera.far,
    distance:p.distanceTo(t),minDistance:painter.controls.minDistance,
    maxDistance:painter.controls.maxDistance,
    azimuth:Math.atan2(p.y-t.y,p.x-t.x),
    elevation:p.z-t.z,
    renderFrame:painter.renderer.info.render.frame,
    selectionChildren:painter.selectionGroup.children.length,
    conditionsVisible:painter.conditionsGroup.visible,
    conditionChildren:painter.conditionsGroup.children.length,
    meshes:painter.interactiveMeshes.map(mesh=>({
      id:mesh.userData.elementId,kind:mesh.userData.elementKind,
      renderOrder:mesh.renderOrder,
      depthTest:Array.isArray(mesh.material)?mesh.material.every(m=>m.depthTest):mesh.material?.depthTest,
      polygonOffset:Array.isArray(mesh.material)?mesh.material.every(m=>m.polygonOffset):mesh.material?.polygonOffset
    }))
  };
`));
const setDistance = distance => evaluate(painterExpression(`
  const target=painter.controls.target;
  const direction=painter.camera.position.clone().sub(target).normalize();
  painter.camera.position.copy(target).addScaledVector(direction,${JSON.stringify(distance)});
  painter.controls.update();
  painter.controls.dispatchEvent({type:"change"});
  return painter.camera.position.distanceTo(target);
`));
const setAzimuth = angle => evaluate(painterExpression(`
  const target=painter.controls.target;
  const offset=painter.camera.position.clone().sub(target);
  const horizontal=Math.hypot(offset.x,offset.y);
  offset.x=Math.cos(${JSON.stringify(angle)})*horizontal;
  offset.y=Math.sin(${JSON.stringify(angle)})*horizontal;
  painter.camera.position.copy(target).add(offset);
  painter.controls.update();
  painter.controls.dispatchEvent({type:"change"});
  return {
    azimuth:Math.atan2(painter.camera.position.y-target.y,painter.camera.position.x-target.x),
    renderFrame:painter.renderer.info.render.frame
  };
`));
const selectCondition = async () => {
  const control = (await evaluate(`innerWidth<768`))
    ? '[data-control="conditions-mobile"]' : '[data-control="conditions"]';
  if (await evaluate(`document.querySelector(${JSON.stringify(control)}).getAttribute("aria-pressed")!=="true"`))
    await click(control);
  await waitUntil(browser, `document.querySelectorAll('.viewer-next-condition-label').length===2`);
  await click('[data-viewer-row-id="CA-1"] > button');
  await settle(`document.querySelector('[data-viewer-row-id="CA-1"]').classList.contains('viewer-next-selected-row')`);
};
const orbit = async ({ name, distance, capture = true }) => {
  const actualDistance = await setDistance(distance);
  await pause(500);
  const before = await cameraMetadata();
  const start = before.azimuth;
  const frames = [];
  for (let step = 1; step <= 24; step++) {
    const target = start + step * Math.PI * 2 / 24;
    const state = await setAzimuth(target);
    await pause(100);
    if (step % 6 === 0) {
      const quarter = step / 6;
      const path = capture ? await shot(`${name}-quarter-${quarter}`) : null;
      frames.push({ step, azimuth: state.azimuth, renderFrame: state.renderFrame, path });
    }
  }
  await pause(500);
  const after = await cameraMetadata();
  const record = {
    name, steps: 24, delayMsPerStep: 100,
    requestedDistance: distance, actualDistance,
    startAzimuth: start, endAzimuth: after.azimuth,
    commandedRotationRadians: Math.PI * 2,
    renderFramesBefore: before.renderFrame,
    renderFramesAfter: after.renderFrame,
    renderedFrameDelta: after.renderFrame - before.renderFrame,
    quarters: frames,
  };
  evidence.orbits.push(record);
  assert.ok(Math.abs(actualDistance - distance) < 1, JSON.stringify(record));
  assert.ok(record.renderedFrameDelta >= 24, JSON.stringify(record));
  assert.equal(frames.length, 4);
  return record;
};

try {
  await mkdir(output, { recursive: true });

  await navigate(1440, 1000);
  await selectCondition();
  await check("camera clipping limits remain unchanged", async () => {
    const metadata = await cameraMetadata();
    evidence.limits = {
      near: metadata.near, far: metadata.far,
      minDistance: metadata.minDistance, maxDistance: metadata.maxDistance,
      initialDistance: metadata.distance,
    };
    assert.equal(metadata.near, 1);
    assert.equal(metadata.far, 1000000);
  });
  await check("surface meshes, condition patches, and selected fill are live", async () => {
    const metadata = await cameraMetadata();
    const ids = new Map(metadata.meshes.map(mesh => [mesh.id, mesh]));
    for (const id of ["W-1", "D-1", "D-2", "G-1", "CA-1", "CA-2"])
      assert.ok(ids.has(id), `Missing interactive surface ${id}`);
    assert.equal(ids.get("W-1").kind, "opening");
    assert.equal(ids.get("D-1").kind, "opening");
    assert.equal(ids.get("D-2").kind, "opening");
    assert.equal(ids.get("G-1").kind, "opening");
    assert.equal(ids.get("CA-1").kind, "condition");
    assert.equal(ids.get("CA-2").kind, "condition");
    assert.equal(metadata.conditionsVisible, true);
    assert.equal(metadata.conditionChildren, 2);
    assert.ok(metadata.selectionChildren > 0);
    for (const id of ["W-1", "D-1", "D-2", "G-1", "CA-1", "CA-2"]) {
      assert.equal(ids.get(id).depthTest, true, `${id} depth testing`);
      assert.equal(ids.get(id).polygonOffset, true, `${id} polygon offset`);
    }
  });

  const initial = await cameraMetadata();
  const close = Math.max(initial.minDistance * 1.25, initial.distance * 0.70);
  const middle = initial.distance;
  const far = Math.min(initial.maxDistance * 0.9, initial.distance * 1.70);
  await check("slow close full-house 360 orbit", async () => {
    await orbit({ name: "desktop-close", distance: close });
  });
  await check("slow middle full-house 360 orbit", async () => {
    await orbit({ name: "desktop-middle", distance: middle });
  });
  await check("slow far full-house 360 orbit", async () => {
    await orbit({ name: "desktop-far", distance: far });
  });

  // Model coordinates use x=left/right and y=front/back, so 135 degrees is
  // the rear-left oblique (negative x, positive y) independent of focus state.
  await setDistance(middle);
  await setAzimuth(3 * Math.PI / 4);
  await pause(600);
  await check("desktop rear-left keeps both condition patches and callouts", async () => {
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-condition-label').length`), 2);
    assert.equal((await cameraMetadata()).conditionChildren, 2);
    await shot("rear-left-oblique-1440-conditions");
  });

  await navigate(390, 844);
  await selectCondition();
  const phoneInitial = await cameraMetadata();
  await check("phone full 360 orbit renders all 24 commanded steps", async () => {
    await orbit({ name: "phone-middle", distance: phoneInitial.distance });
  });
  await setAzimuth(3 * Math.PI / 4);
  await pause(600);
  await check("phone rear-left keeps both condition patches, labels, and exact dimensions", async () => {
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-condition-label').length`), 2);
    assert.equal(await evaluate(`document.querySelectorAll('[data-overlay-label="length"],[data-overlay-label="depth"],[data-overlay-label="eave"]').length`), 3);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`), 0);
    await shot("rear-left-oblique-390-conditions");
  });

  await navigate(390, 844);
  await check("clean default phone shows four controls and exactly three dimensions", async () => {
    const controls = await evaluate(`document.querySelectorAll('.viewer-next-mobile-controls > button').length`);
    const dimensions = await evaluate(`document.querySelectorAll('[data-overlay-label="length"],[data-overlay-label="depth"],[data-overlay-label="eave"]').length`);
    assert.equal(controls, 4);
    assert.equal(dimensions, 3);
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`), 0);
    await shot("clean-default-front-390-four-controls");
  });

  await navigate(1440, 1000);
  await click('[data-viewer-row-id="op_window"] > button');
  await check("clean desktop opening group is expanded", async () => {
    assert.equal(await evaluate(`document.querySelector('[data-viewer-row-id="op_window"] > button').getAttribute('aria-expanded')`), "true");
    assert.ok(await evaluate(`document.querySelectorAll('[data-viewer-row-id^="og_window_"]').length>0`));
    assert.equal(await evaluate(`document.querySelectorAll('.viewer-next-measure-label').length`), 0);
    await evaluate(`(() => {
      const row=document.querySelector('[data-viewer-row-id="op_window"]');
      const scroller=row.closest('[data-viewer-panel-scroll]');
      const item=row.getBoundingClientRect(), bounds=scroller.getBoundingClientRect();
      scroller.scrollTop += item.top-bounds.top-80;
    })()`);
    await pause(300);
    await shot("clean-desktop-window-groups-open");
  });

  await check("orbit run has no browser exceptions or WebGL failure", async () => {
    evidence.browserExceptions = browser.exceptions;
    assert.deepEqual(browser.exceptions, []);
    assert.equal(await evaluate(`document.querySelector('[data-testid="viewer-viewport"]').dataset.webglState`), "ready");
  });
} finally {
  browser.close();
}

const desktopFrames = evidence.orbits
  .filter(orbit => orbit.name.startsWith("desktop-"))
  .flatMap(orbit => orbit.quarters.map(quarter => quarter.path))
  .filter(Boolean);
const phoneFrames = evidence.orbits
  .filter(orbit => orbit.name.startsWith("phone-"))
  .flatMap(orbit => orbit.quarters.map(quarter => quarter.path))
  .filter(Boolean);
if (desktopFrames.length) {
  const path = `${output}/desktop-orbit-contact-sheet.png`;
  await execFileAsync("montage", [
    "-font", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ...desktopFrames, "-thumbnail", "360x250", "-tile", "4x3",
    "-geometry", "+4+4", "-background", "#111827", path,
  ]);
  evidence.screenshots.push(path);
}
if (phoneFrames.length) {
  const path = `${output}/phone-orbit-contact-sheet.png`;
  await execFileAsync("montage", [
    "-font", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ...phoneFrames, "-thumbnail", "195x422", "-tile", "4x1",
    "-geometry", "+4+4", "-background", "#111827", path,
  ]);
  evidence.screenshots.push(path);
}

await writeFile(`${output}/orbit-results.json`, JSON.stringify({ results, evidence }, null, 2));
const failed = results.filter(result => !result.passed);
console.log(`Viewer orbit checks: ${results.length - failed.length} passed, ${failed.length} failed`);
for (const failure of failed) console.log(`FAIL ${failure.name}: ${failure.error}`);
process.exitCode = failed.length ? 1 : 0;