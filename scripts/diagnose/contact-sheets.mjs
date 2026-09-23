// Labelled review sheets from actual captures; no substitute geometry.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const cases = JSON.parse(await readFile("scripts/diagnose/results.json", "utf8")).cases;
const directory = "docs/diagnose/2026-09-23";
for (let offset = 0; offset < cases.length; offset += 8) {
  const args = cases.slice(offset, offset + 8).flatMap(c => [
    "-label", c.slug, `${directory}/${c.screenshots[1]}`,
  ]);
  execFileSync("montage", [...args, "-font", "DejaVu-Sans", "-pointsize", "14",
    "-geometry", "590x443+5+5", "-tile", "2x4", "-background", "white",
    `${directory}/contact-sheet-${offset / 8 + 1}.jpg`]);
}