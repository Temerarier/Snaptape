import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { measurementToMess, pruefen } from "./coreHost";
import { fuehreSandboxAus, validiereSandboxJson } from "./sandbox";
import { repoPfad } from "./prompts";

const load = (relative: string) => readFileSync(repoPfad(relative), "utf8");
const expected = JSON.parse(load("test-fixtures/variante-a/erwartet.json")) as Record<string, {
  stufe: string; ids_fehlen: number; flaechen: number; oeffnungen: number; kanten: number;
}>;
const mess = measurementToMess(JSON.parse(load("test-fixtures/variante-a/farmhouse-140040rk/messung.json")));
describe("unchanged core, real isolated-vm sandbox and host checks", () => {
  it("preserves the canonical core bytes", () => {
    expect(createHash("sha256").update(load("artifacts/aufmass-app/lib/modell3d/core.js")).digest("hex"))
      .toBe("fa762fb3942ff78fe166a341a0b1d81ff9a47ba7c57ee7ad57c33f28b041239c");
  });
  it.each(Object.entries(expected))("fixture %s matches its canonical expectations", async (house, values) => {
    const measurement = JSON.parse(load(`test-fixtures/variante-a/${house}/messung.json`));
    const m = measurementToMess(measurement);
    const { result } = await fuehreSandboxAus(m, load(`test-fixtures/variante-a/${house}/buildhouse.js`));
    const report = pruefen(m, result);
    expect({ stufe: report.stufe, ids_fehlen: report.zahlen.ids_fehlen,
      flaechen: result.flaechen.length, oeffnungen: result.oeffnungen.length, kanten: result.kanten.length })
      .toEqual({ stufe: values.stufe, ids_fehlen: values.ids_fehlen, flaechen: values.flaechen, oeffnungen: values.oeffnungen, kanten: values.kanten });
  }, 15000);
  it.each([
    ["throw", "throw new Error('x')"],
    ["timeout", "while (true) {}"],
    ["require", "require('fs')"],
    ["fetch", "fetch('https://example.com')"],
    ["process", "process.exit(1)"],
    ["memory", "var a=[]; while(true) a.push(new Array(1000000).fill(7));"],
    ["output", "api.ergaenzt('oversize', 'x'.repeat(10*1024*1024), 'probe', 'test');"],
  ])("probe %s stops without crashing the host", async (name, body) => {
    const { result } = await fuehreSandboxAus(mess, `function buildHouse(MESS, api) { ${body} }`);
    expect(pruefen(mess, result).stufe).toBe("stopp");
    expect(result.fehler.length).toBeGreaterThan(0);
    if (name === "timeout") expect(result.fehler).toEqual(["Zeitlimit von 8 s überschritten"]);
    if (name === "memory") expect(result.fehler).toEqual(["Speicherlimit überschritten"]);
    if (name === "output") expect(result.fehler).toEqual(["Sandbox-Ausgabe überschreitet Sicherheitslimit"]);
  }, 15000);
  it("rejects manipulated or oversized geometry before host checking", () => {
    expect(() => validiereSandboxJson({})).toThrow();
    expect(() => validiereSandboxJson({
      flaechen: new Array(2001).fill({}), oeffnungen: [], anbauten: [], deko: [], kanten: [],
      fallrohre: [], schaeden: [], ergaenzt: [], konflikte: [], nicht_gebaut: [], fehler: [], hinweise: [],
    })).toThrow();
  });
});
