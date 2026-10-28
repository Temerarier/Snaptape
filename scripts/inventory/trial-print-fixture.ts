// Generates acceptance artifacts from the production renderer; no database writes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { enUS } from "../../artifacts/aufmass-app/i18n/en-US";
import { renderPrintSheet, panelValueStrings } from "../../artifacts/aufmass-app/lib/viewer-next/printSheet";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
const measurement = JSON.parse(readFileSync("fixtures/garage-house.json", "utf8"));
const prepared = prepareProjectMeasurement(measurement, enUS.viewerNext);
if (prepared.kind !== "viewer") throw new Error("Garage-house fixture unreadable");
const dir = "generated-artifacts/trial-readiness";
mkdirSync(dir, { recursive: true });
const base = { measurement, name: "Garage house — acceptance fixture", address: null,
  date: "October 28, 2026", fileCount: 0, locale: "en-US" as const, dict: enUS.viewerNext, nonce: "fixture-check" };
for (const preview of [true, false]) writeFileSync(`${dir}/garage-house${preview ? "" : "-autoprint"}.html`,
  renderPrintSheet({ ...base, preview })!);
writeFileSync(`${dir}/garage-house-values.json`, JSON.stringify({
  source: "fixtures/garage-house.json", renderer: "production renderPrintSheet / prepareProjectMeasurement",
  values: panelValueStrings(prepared.cards), cards: prepared.cards,
}, null, 2));
console.log("Fixture sheet and viewer card values generated without database writes.");
