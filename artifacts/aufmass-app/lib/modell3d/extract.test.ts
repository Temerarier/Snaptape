import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extrahiereBuildHouse } from "./extract";
import { baueKorrekturPrompt, ladeBuildhousePrompt, repoPfad } from "./prompts";

describe("buildHouse extraction and verbatim prompts", () => {
  it("takes the code, not the surrounding prose", () => {
    expect(extrahiereBuildHouse("Before\n```js\nfunction buildHouse(MESS, api) {}\n```\nAfter"))
      .toBe("function buildHouse(MESS, api) {}\n");
  });
  it("takes the largest applicable js/javascript block", () => {
    expect(extrahiereBuildHouse("```js\nconst unrelated = 1\n```\n```js\nfunction buildHouse(){}\n```\n```javascript\nfunction buildHouse(MESS,api){ api.wall('WL-1', []); }\n```"))
      .toContain("api.wall");
  });
  it("uses the plain function fallback and stops at the next fence", () => {
    expect(extrahiereBuildHouse("Here: function buildHouse(MESS,api) {}\n``` trailing"))
      .toBe("function buildHouse(MESS,api) {}\n");
  });
  it("fails explicitly when there is no function", () => {
    expect(() => extrahiereBuildHouse("No source code")).toThrow("Keine Funktion buildHouse in der Antwort");
  });
  it("loads the system prompt verbatim", () => {
    expect(ladeBuildhousePrompt()).toBe(readFileSync(repoPfad("variante-a-paket/docs/pipeline/buildhouse-prompt.md"), "utf8"));
  });
  it("fills correction placeholders with fail rows only, preserving literal replacement characters", () => {
    const code = "function buildHouse(){ /* $& $` $' */ }";
    const prompt = baueKorrekturPrompt({ stufe: "stopp", zahlen: {}, zeilen: [
      { id: "WL-1", pruefung: "Hauptmaß", status: "fail", text: "Zu breit" },
      { id: "R-1", pruefung: "Detail", status: "warn", text: "DONOTINCLUDE" },
    ] }, code);
    expect(prompt).toContain("- WL-1 Hauptmaß: Zu breit");
    expect(prompt).toContain(code);
    expect(prompt).not.toMatch(/__ERRORS__|__PREVIOUS_CODE__/);
    expect(prompt).not.toContain("DONOTINCLUDE");
    expect(readFileSync(repoPfad("docs/pipeline/buildhouse-correction-prompt.md"), "utf8"))
      .toBe(readFileSync(repoPfad("variante-a-paket/docs/pipeline/buildhouse-correction-prompt.md"), "utf8"));
  });
});
