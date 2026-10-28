import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Model3dCheck } from "@workspace/db";

export function repoPfad(relative: string): string {
  for (const root of [process.cwd(), join(process.cwd(), "../..")]) {
    const path = join(root, relative);
    if (existsSync(path)) return path;
  }
  throw new Error(`${relative} nicht gefunden.`);
}
export function ladeBuildhousePrompt(): string {
  return readFileSync(repoPfad("docs/pipeline/buildhouse-prompt.md"), "utf8");
}
export function baueKorrekturPrompt(report: Model3dCheck, code: string): string {
  const errors = report.zeilen.filter(z => z.status === "fail")
    .map(z => `- ${z.id} ${z.pruefung}: ${z.text}`).join("\n");
  return readFileSync(repoPfad("docs/pipeline/buildhouse-correction-prompt.md"), "utf8")
    .replace(/__ERRORS__|__PREVIOUS_CODE__/g, token => token === "__ERRORS__" ? errors : code);
}
