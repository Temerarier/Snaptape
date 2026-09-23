import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { connectBrowser, pause, waitUntil } from "../../artifacts/aufmass-app/scripts/viewer-browser-cdp.mjs";

const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const appRequire = createRequire(path.resolve("artifacts/aufmass-app/package.json"));
const threeModule = path.join(path.dirname(appRequire.resolve("three")), "three.module.js");
const { build } = vitestRequire("esbuild");
const base = process.cwd();
const directory = path.join(base, "scripts/diagnose");
const screenshots = path.join(base, "docs/diagnose/2026-09-23");
await mkdir(screenshots, { recursive: true });
const bundle = await build({
  entryPoints: [path.join(directory, "browser-entry.tsx")], bundle: true, write: false,
  format: "iife", platform: "browser", jsx: "automatic",
  alias: { "@": path.join(base, "artifacts/aufmass-app"), "@workspace/measurement": path.join(directory, "measurement-browser.ts") },
  nodePaths: [path.join(base, "artifacts/aufmass-app/node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "observe-actual-three-renderer",
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({ path: "observed-three", namespace: "diagnose" }));
      build.onLoad({ filter: /.*/, namespace: "diagnose" }, () => ({
        contents: `export * from ${JSON.stringify(threeModule)};
import { WebGLRenderer as ActualRenderer } from ${JSON.stringify(threeModule)};
export class WebGLRenderer extends ActualRenderer {
 constructor(...args) { super(...args); const actualRender = this.render.bind(this);
 this.render = (scene, camera) => { actualRender(scene, camera); window.observeRender?.call(this, scene, camera); };
 }
}`,
        loader: "js", resolveDir: base,
      }));
    },
  }],
});
const productionCss = (await readFile(path.join(base, "artifacts/aufmass-app/app/globals.css"), "utf8")).replace('@import "tailwindcss";', "").replace("@theme {", ":root {");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${productionCss}
html,body{margin:0;width:100%;height:100%;font-family:Arial;background:#f8fafc;color:#253040}
#root{position:absolute;inset:55px 0 0}#root>div{position:relative;width:100%;height:100%}
.absolute{position:absolute}.relative{position:relative}.inset-0{inset:0}.h-full{height:100%}.w-full{width:100%}
.pointer-events-none{pointer-events:none}.overflow-hidden{overflow:hidden}
header{position:absolute;top:0;left:0;right:0;padding:13px 20px;font-size:18px;border-bottom:1px solid #ddd}
</style></head><body><header id="title">Analysis: actual ViewerViewport</header><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader("Content-Type", "text/html"); res.end(html); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chromium = spawn("/repl/tools/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader",
  "--use-gl=angle", "--use-angle=swiftshader", "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=9223", `--user-data-dir=${directory}/chromium-profile`,
  "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });
let browser;
const results = [];
try {
  for (let i = 0; i < 50; i++) {
    try { browser = await connectBrowser(); break; } catch { await pause(200); }
  }
  if (!browser) throw new Error("Loopback Chromium connection failed");
  await browser.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.send("Page.navigate", { url: origin });
  await waitUntil(browser, "typeof window.mountCase === 'function'");
  const cases = JSON.parse(await readFile(path.join(directory, "cases.json"), "utf8"));
  for (const folder of ["scripts/diagnose/real", "export-messungen"]) {
    for (const file of (await readdir(folder)).filter(x => x.endsWith(".json"))) {
      cases.push({ slug: `${folder.endsWith("real") ? "real" : "export"}-${file.replace(/\.json$/, "")}`, title: file, measurementFile: `${folder}/${file}`, expected: "Real measurement; inspect against source" });
    }
  }
  cases.push({ slug: "fixture-garage-house", title: "Existing garage-house fixture", measurementFile: "fixtures/garage-house.json" });
  for (const item of cases) {
    browser.exceptions.length = 0; browser.consoleMessages.length = 0;
    const record = { ...item, screenshots: [], views: [] };
    try {
      let file = path.resolve(item.measurementFile);
      try { await readFile(file); } catch { file = path.resolve(directory, item.measurementFile); }
      const raw = JSON.parse(await readFile(file, "utf8"));
      record.sourceFile = path.relative(base, file);
      await browser.evaluate(`document.getElementById('title').textContent=${JSON.stringify(`${item.title} · actual ViewerViewport · prepared pipeline`)}`);
      Object.assign(record, await browser.evaluate(`window.mountCase(${JSON.stringify(raw)})`));
      await waitUntil(browser, "!!window.renderEvidence && window.renderEvidence.frames > 1", 15000);
      for (const view of ["initial", "orbit"]) {
        if (view === "orbit") {
          await browser.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 620, y: 420, button: "left", buttons: 1, clickCount: 1 });
          for (let i = 1; i <= 15; i++) await browser.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 620 + i * 21, y: 420 + i * 2, button: "left", buttons: 1 });
          await browser.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 935, y: 450, button: "left", buttons: 0, clickCount: 1 });
        }
        await pause(800);
        const evidence = await browser.evaluate("window.renderEvidence");
        const filename = `${item.slug}-${view}.png`;
        const shot = await browser.send("Page.captureScreenshot", { format: "png" });
        await writeFile(path.join(screenshots, filename), Buffer.from(shot.data, "base64"));
        record.screenshots.push(filename);
        record.views.push({ view, ...evidence, confirmedNonemptyWebGL: !!evidence.webgl && !evidence.contextLost && evidence.triangles > 0 && evidence.sampledDistinctColors > 10 });
      }
    } catch (error) { record.harnessError = String(error); }
    record.browserExceptions = [...browser.exceptions];
    record.browserConsole = [...browser.consoleMessages];
    results.push(record);
    await writeFile(path.join(directory, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), method: "Actual source imports; current prepareProjectMeasurement / computeDerived / buildModel / ViewerViewport; per-instance actual WebGLRenderer observed after render via subclass; loopback isolated browser; no sessions or API calls. Actual globals.css viewer rules and viewerTokenStyles loaded; Tailwind import removed and theme block emitted as root CSS variables, basic layout utility classes supplied by harness. Actual materials/lights/overlay placement; system font fallback (Next font loader absent), isolated viewport rather than full product layout.", harnessHistory: "An earlier prototype-only render observer never fired because Three assigns render per instance. Those timeouts were harness failures, not app crashes; replaced by instance observer and reran all 38 inputs successfully.", cases: results }, null, 2));
    console.log(item.slug, record.screenshots.length, record.harnessError ?? "OK");
    if (record.harnessError) throw new Error(`Fail-fast harness failure: ${item.slug}: ${record.harnessError}`);
  }
} finally {
  browser?.close(); chromium.kill("SIGTERM"); server.close();
  await pause(500);
  await rm(path.join(directory, "chromium-profile"), { recursive: true, force: true });
}