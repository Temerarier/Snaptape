import assert from "node:assert/strict";
import { readFile, access, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateMeasurement } from "../../lib/measurement/src/validateMeasurement";
import { presentViewerWarnings } from "../../artifacts/aufmass-app/components/viewer-next/warningPresentation";

const json = async (p: string) => JSON.parse(await readFile(p, "utf8"));
const manifest = await json("scripts/diagnose/cases.json");
const result = await json("scripts/diagnose/results.json");
const ratings = await json("scripts/diagnose/ratings.json");
const causal = await json("scripts/diagnose/causal-results.json");
assert.equal(manifest.length, 29);
assert.equal(new Set(manifest.map((c: any) => c.slug)).size, 29);
for (const item of manifest) {
  const measurement = await json(item.measurementFile);
  const validation = validateMeasurement(measurement);
  assert.equal(validation.valid, true, `${item.slug}: ${JSON.stringify(validation.errors)}`);
}
assert.equal(result.cases.length, 38);
assert.equal(Object.keys(ratings).length, 38);
for (const item of result.cases) {
  assert.ok(["correct", "partly wrong", "broken", "crash"].includes(ratings[item.slug]?.rating));
  assert.equal(item.preparationKind, "viewer");
  assert.equal(item.rawPreparedModelEqual, true);
  assert.equal(item.harnessError, undefined);
  assert.deepEqual(item.browserExceptions, []);
  assert.equal(item.screenshots.length, 2);
  assert.equal(item.views.length, 2);
  for (const view of item.views) {
    assert.equal(view.confirmedNonemptyWebGL, true);
    assert.equal(view.glError, 0);
    assert.equal(view.contextLost, false);
  }
  assert.notDeepEqual(item.views[0].camera, item.views[1].camera);
  for (const shot of item.screenshots) await access(`docs/diagnose/2026-09-23/${shot}`);
}
for (const input of causal.results) {
  const hash = createHash("sha256").update(await readFile(input.path)).digest("hex");
  assert.equal(hash, input.inputSha256, `Source changed: ${input.path}`);
}
const report = await readFile("docs/viewer-diagnose-2026-09-23.md", "utf8");
const warningLabels = { approximatedLayout: "approximation", omittedElements: "omission", missingDimensions: "missing-dimensions", modelFailure: "failure" };
const automaticWarnings = (slug: string) => {
  const c = result.cases.find((c: any) => c.slug === slug);
  return presentViewerWarnings([], c.model.diagnostics, c.model.notes, warningLabels);
};
assert.deepEqual(automaticWarnings("roof-flat"), ["approximation"]);
const flat = result.cases.find((c: any) => c.slug === "roof-flat");
assert.deepEqual(presentViewerWarnings([], [{code:"model_note", category:"general", ids:[]}], flat.model.notes.filter((n: string) => n.startsWith("Roof type")), warningLabels), []);
assert.deepEqual(automaticWarnings("special-no-footprint"), []);
assert.deepEqual(automaticWarnings("special-missing-attachment-dimensions"), ["omission", "missing-dimensions"]);
assert.deepEqual([...report.matchAll(/^## (\d+)\. /gm)].map(m => Number(m[1])), [1,2,3,4,5,6,7,8,9]);
for (const c of result.cases) for (const shot of c.screenshots) assert.ok(report.includes(shot));
for (const match of report.matchAll(/\]\(([^)]+)\)/g)) {
  if (match[1].startsWith("diagnose/")) await access(`docs/${match[1]}`);
}
const summary = {
  schemaValidSyntheticFixtures: manifest.length,
  existingInputs: result.cases.length - manifest.length,
  confirmedWebGLScreenshots: result.cases.length * 2,
  distinctOrbitViews: result.cases.length,
  unchangedSourceHashes: causal.results.length,
  browserExceptions: 0,
  reportSections: 9,
  warningChecks: { flatRoof: automaticWarnings("roof-flat"), missingOutline: automaticWarnings("special-no-footprint"), missingAttachment: automaticWarnings("special-missing-attachment-dimensions") },
  ratings: Object.values(ratings).reduce((a: any, r: any) => ({...a, [r.rating]: (a[r.rating] ?? 0) + 1}), {}),
};
await writeFile("scripts/diagnose/validation-results.json", JSON.stringify(summary, null, 2) + "\n");
console.log(summary);