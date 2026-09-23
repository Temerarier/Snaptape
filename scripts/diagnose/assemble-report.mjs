// Rebuilds the written diagnosis from authored analysis and captured evidence.
// Does not modify product code or input measurements.
import { readFile, writeFile } from "node:fs/promises";
const text = p => readFile(`scripts/diagnose/${p}`, "utf8");
const audit = await text("assumptions.md");
const fields = await text("field-usage.md");
const causal = await text("causal-findings.md");
const recommendations = await text("recommendations.md");
const results = JSON.parse(await text("results.json"));
const ratings = JSON.parse(await text("ratings.json"));
const cases = results.cases;
if (cases.length !== 38 || cases.some(c => c.screenshots.length !== 2 || c.harnessError || c.views.some(v => !v.confirmedNonemptyWebGL))) {
  throw new Error("Report requires two confirmed WebGL views of all 38 inputs");
}
const slice = (s, a, b) => s.slice(s.indexOf(a) + a.length, b ? s.indexOf(b) : undefined).trim();
const subordinate = s => s.replace(/^## /gm, "### ").replace(/^# /gm, "### ");
const escape = x => String(x ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const shots = c => c.screenshots.map(s => `[${s}](diagnose/2026-09-23/${s})`).join("<br>");
const row = values => `| ${values.map(escape).join(" | ")} |`;
let report = `# Why the viewer draws houses incorrectly

**Date:** 2026-09-23. **Scope:** analysis only; current workspace source and stored development measurements, not a historical reconstruction of a previous deployed viewer.

## 1. Summary

The main problem is in the **MODEL BUILDER**: it reconstructs a rectangular, fixed-direction gable template rather than the building's connected walls, roofs, and volumes.
It reduces footprint outlines to width and depth, places walls on four standard planes, and assigns roofs using area, approximate dimensions, and even identifiers instead of explicit ownership.
The **MEASUREMENT** already supplies useful information that is ignored—including roof-to-attachment links, per-side heights and grade offsets, precise pitch, and dormer style—but it still lacks enough boundary and adjacency information for reliable general reconstruction.
Leipzig's ten walls all survive the builder, yet several overlap or are placed inconsistently, so fewer visible walls does not mean fewer wall records.
Braamheide's measured gables retain their height, but the generated roof ridge runs in the wrong direction for them.
Attachments preserve usable supplied dimensions and parent positions, but generic boxes, guessed missing depth, and independent roof placement prevent coherent annexes, garages, and dormers.
The supplied 100 mm solar-panel thickness is preserved in the current data, while the awning's absent depth becomes 5 m.
The **CALCULATION** layer can retain quantities for surfaces and edges that the model does not place correctly, and it exposes only one global eave dimension.
The **RENDERING** layer adds unmeasured closure surfaces and translucent secondary-color triangles, so it can magnify geometric errors or produce misleading appearances.
The gap is architectural, not a handful of house-specific defects: a shared spatial contract, explicit uncertainty, and connected surface construction must precede further shape-specific fixes.

### Evidence and reproduction

- All four requested project IDs were found with measurements in the development database using parameterized SELECT-only queries; no production query was needed. Only ID and measurement JSON were retrieved. No measurements, paid APIs, sessions, stored records, schema, prompts, dependencies, or product code were changed.
- **29 synthetic v1.7 fixtures** cover every requested shape; **9 existing inputs** cover the four projects, every export, and the garage fixture. The manifest documents what each fixture can and cannot express.
- The isolated harness imports the actual current preparation, calculation, model builder, and ViewerViewport. Materials, lights, and tokens are unchanged. CSS is a hybrid: viewer rules are loaded from globals.css, the Tailwind import is removed, @theme is rewritten to :root, and a minimal hand-written utility subset supplies the shell layout. Next font loading is absent, so text uses a system fallback. These are viewport geometry/material captures, not exact full-product layout comparisons; warning/card visibility is not visually tested. Both initial and orbited views were captured at 1200×900 with actual software WebGL; render evidence records renderer, draw calls, triangles, pixels, and camera.
- A separate normal app-preview screenshot could not initialize WebGL. It is not used as geometry evidence. The isolated software-WebGL captures are the report figures.
- Full raw/prepared models, warnings, diagnostics, ID comparisons, and browser evidence: [results.json](../scripts/diagnose/results.json). Numerical causal tests and input hashes: [causal-results.json](../scripts/diagnose/causal-results.json). Input snapshots are under scripts/diagnose/real; canonical exports/fixture were read in place.
- Reproduce fixtures: \`pnpm exec tsx scripts/diagnose/generate-fixtures.ts\`; causal checks: \`pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json scripts/diagnose/causal-probes.ts\`; screenshots: \`node scripts/diagnose/browser-harness.mjs\`; report: \`node scripts/diagnose/assemble-report.mjs\`; validation: \`pnpm exec tsx scripts/diagnose/validate-deliverables.ts\`; scope guard: \`node scripts/diagnose/scope-check.mjs\`.
- An initial screenshot attempt timed out because analysis instrumentation incorrectly intercepted a prototype method instead of Three's per-instance renderer method. That harness defect was corrected without product edits; the failed attempts are not rated as application crashes. The final results replace those attempts and contain 38 successful inputs.
- Static claims have source citations; runtime claims have model coordinates and screenshots. Photographic ground truth, earlier deployed revisions, real-GPU/mobile rendering, and temporal flicker are not established by this run. An observed overlap establishes a z-fighting risk, not the frequency of visible flicker.

## 2. Assumptions inventory

Preparation is identified separately where it sits between MEASUREMENT and CALCULATION/MODEL BUILDER. “Other shapes” are general consequences inferred from the source; Section 4 identifies which were executed.

${slice(audit, "Paths used in citations:", "## Summary")}

${slice(audit, "## 1. Assumptions inventory", "## 2. Skip, drop, simplification and visibility ledger")}

## 3. Field usage table

The table includes all geometry/placement fields and adjacent metadata in the requested five schema roots. “Read” is not equivalent to “used correctly”; notes and copied metadata are distinguished from coordinate generation. Short file names below resolve to the full paths in Section 2 or the introductory path list.

${subordinate(fields.replace(/^# .*\n/, ""))}

## 4. Shape coverage matrix

**Rating rules:** correct = the focal shape/placement behavior encoded by this case is represented correctly; partly wrong = recognizable shape but material placement, topology, warning, or assembly defects remain; broken = the defining requested shape is not represented; crash = preparation/build/render cannot produce the case. A correct simple case does not certify every edge, label, takeoff, or unsupported feature. Schema-valid does not mean spatially complete: each synthetic case includes its expressiveness limits. Ratings are authored from runtime geometry and the captures, not inferred from “no exception”.

### Synthetic shapes

| Shape | Expected geometry | Observed geometry and rating | Screenshot filenames (initial / orbit) |
|---|---|---|---|
`;
for (const c of cases.filter(c => !/^(real-|export-|fixture-)/.test(c.slug))) {
  const r = ratings[c.slug];
  if (!r) throw new Error(`Missing rating: ${c.slug}`);
  report += row([c.title, c.expected, `**${r.rating}** — ${r.observed}`, shots(c)]) + "\n";
}
report += "\n### What the synthetic data cannot express\n\n";
for (const c of cases.filter(c => c.limitations)) report += `- **${c.title}:** ${c.limitations}\n`;
const existingExpectations = {
  "real-536235c3-131d-4279-92b0-007c9cea831b": "A 12940×10000 main hip-roof body, ten independently placed measured walls, rear annex and 2920 mm garage with RF-5's own 3.4° roof; retain per-side grade/eave relationships.",
  "real-82a4d3a3-053e-47d6-9494-49c76509ea60": "A 14000×11500 hip-roof main volume, lower 2700 mm left annex, and a detached garage-like volume whose exact site position must remain unresolved rather than invented.",
  "real-a847416a-6f1c-478f-817c-371896023124": "A 12940×10000 hip-roof body with eight measured walls, a 2920 mm garage and 5395 mm rear annex, with their openings retained on their respective surfaces.",
  "real-d165c333-6125-4294-bd79-fb1c9c185568": "Front/back gables of 6300 mm above 4400 mm wall rectangles joined by the correct ridge; separately mounted entrance/awning/dormer volumes and 100 mm solar panels. Flag missing awning depth.",
  "export-leipzig-photo": "A 12100×11200 hip-roof main body with independently placed side additions and roof obstacles; report absent wall spans or ambiguous topology rather than treat array order as location.",
  "export-leipzig-plan": "A 12940×10000 hip-roof main body with ten wall faces assigned to main/secondary volumes, consistent own roofs, openings and elevations.",
  "export-neuengamme-mixed": "A 12400×10800 compound-roof body consistent with two measured ridges, hip/valley edges and attached features; unresolved face widths/topology must be disclosed.",
  "export-neuengamme-photo": "A 14100×9500 compound-roof body with distinct connected roof patches and correctly mounted secondary features; missing dimensions should remain identified as assumptions.",
  "fixture-garage-house": "Recognizable main gable plus lower side garage, six wall faces, separate small cross-roof facets, parent-linked openings, and truthful omission/uncertainty for unsupported detail.",
};
report += "\n### Existing measurements and control fixture\n\nExpected baselines below are inferred from stored dimensions, types, and relationships—not independently remeasured photographic ground truth. Missing topology limits the exact expected reconstruction; a plausible interpretation must still preserve explicit constraints or identify uncertainty.\n\n| Input | Expected baseline | Rating and observed geometry | Screenshot filenames (initial / orbit) |\n|---|---|---|---|\n";
for (const c of cases.filter(c => /^(real-|export-|fixture-)/.test(c.slug))) {
  const r = ratings[c.slug];
  if (!r) throw new Error(`Missing rating: ${c.slug}`);
  report += row([c.sourceFile, existingExpectations[c.slug], `**${r.rating}** — ${r.observed}`, shots(c)]) + "\n";
}
const totals = Object.values(ratings).reduce((a, r) => ({ ...a, [r.rating]: (a[r.rating] ?? 0) + 1 }), {});
report += `\nAcross all 38 inputs: ${Object.entries(totals).map(([k,v]) => `${v} ${k}`).join(", ")}. Ratings concern the current renderer, not the accuracy of AI extraction. All 76 captures have positive WebGL scene/pixel evidence.\n`;
report += `\n## 5. Dropped elements per project\n\n${slice(audit, "## 2. Skip, drop, simplification and visibility ledger", "### Required runtime accounting")}\n\n### Warning visibility is a separate contract\n\nThe non-gable roof-type message is an internal model note classified as general; it does not match production warning-presentation rules. It generates no user-facing topology warning by itself. The executed flat-roof fixture does generate a generic approximation warning for a different reason: RF-1's front role was inferred from its ID. That is not detection of the missing half-roof. Other omitted faces or edges can still trigger generic omission warnings. The missing-dimensions case generates generic omission/missing-dimension categories, not an AT-1-specific explanation. The no-outline case generates no approximation category on its own. Both special fixtures contain authored source warnings: their presence must not be credited as automatic detection. These conclusions are checked by invoking the actual presentViewerWarnings function in validate-deliverables.ts; viewport screenshots do not show the product warning panel.\n\n### Actual ID accounting\n\n“Dropped” below means absent from builder output, not merely hidden from a camera. Suppressed attachment proxies are listed separately through their exact reason; suppression is not proof that the other geometry represents the attachment correctly. Soffit/fascia remain calculation records but have no model surface. Roof aliases are counted once. Downspouts have no builder collection at all.\n`;
for (const c of cases.filter(c => /^(real-|export-|fixture-)/.test(c.slug))) {
  const raw = JSON.parse(await readFile(c.sourceFile, "utf8"));
  report += `\n### ${c.slug}\n\nSource: \`${c.sourceFile}\`. Preparation: **${c.preparationKind}**. Raw versus prepared complete model identical: **${c.rawPreparedModelEqual}**.\n\n| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |\n|---|---|---|\n`;
  for (const [key,d] of Object.entries(c.dropped)) {
    const reason = id => c.model.notes.filter(n => n.startsWith(`${id}:`)).join("; ") || (d.droppedDuringPreparation.includes(id) ? "Preparation removed malformed/duplicate identity; see preparation warnings." : "Not represented by this model collection.");
    report += row([key, `${d.inputIds.length} / ${d.preparedIds.length} / ${d.modelIds.length}`, d.droppedFromModel.length ? d.droppedFromModel.map(id => `**${id}**: ${reason(id)}`).join("<br>") : "None"]) + "\n";
  }
  const downspouts = Array.isArray(raw.downspouts) ? raw.downspouts : [];
  report += row(["downspouts", `${downspouts.length} / retained by preparation / 0`, downspouts.length ? downspouts.map(d => `**${d.id}**: no builder input/model collection or placement path (I:85–103; B:1242–1636).`).join("<br>") : "None supplied"]) + "\n";
  const removed = Object.values(c.dropped).flatMap(d => d.droppedDuringPreparation);
  report += `\nPreparation removed IDs: ${removed.length ? removed.join(", ") : "**none**"}. Complete per-element notes, retained IDs, and bounds are in results.json; views: ${shots(c)}.\n`;
}
report += `\n### Retained-but-wrong geometry and causal experiments\n\n${subordinate(causal.replace(/^# .*\n/, ""))}\n\n## 6. Symptom-to-cause map\n\n`;
report += await text("symptom-map.md");
report += `\n${recommendations}\n`;
await writeFile("docs/viewer-diagnose-2026-09-23.md", report);
console.log(`Wrote ${report.length} characters; ${cases.length} cases / ${cases.length*2} screenshots.`);