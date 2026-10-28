import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), write: vi.fn(), call: vi.fn(), images: vi.fn(),
  check: vi.fn(), sandbox: vi.fn(),
}));
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.select }) }) }),
    insert: (table: string) => ({ values: (v: unknown) => m.insert(table, v) }),
    update: () => ({ set: (v: unknown) => ({ where: () => m.write(v) }) }),
  },
  projectsTable: { id: "id", status: "status", currentRunId: "current", model3dStatus: "3d-status", model3dReport: "3d-report", measurement: "measurement" },
  modelRunsTable: "model_runs",
}));
vi.mock("./coreHost", () => ({ measurementToMess: () => ({}), pruefen: m.check }));
vi.mock("./sandbox", async original => ({
  ...await original<typeof import("./sandbox")>(), fuehreSandboxAus: m.sandbox,
}));
import { fuehreModellLaufAus, SCHRITT2_MODELL, SCHRITT2_EFFORT } from "./schritt2";
import { leeresModell } from "./sandbox";
import { ModellAntwortFehler } from "@/lib/messung/modelle";
const measurement = { meta: { schema_version: "1.8" }, faces: [{ id: "WL-1" }] };
const args = { projektId: "project", measureRunId: "measure", dateien: [] };
const diagnostic = { responseId: "msg_mock", model: SCHRITT2_MODELL, stopReason: "end_turn",
  contentTypes: ["text"], inputTokens: 100, outputTokens: 200, cacheReadInputTokens: null, cacheCreationInputTokens: null };
const response = { text: "```js\nfunction buildHouse(MESS,api) {}\n```", inputTokens: 100, outputTokens: 200, diagnostic };
const stopped = { stufe: "stopp", zahlen: {}, zeilen: [{ id: "WL-1", pruefung: "Hauptmaß", status: "fail", text: "Falsch" }] };
const run = () => fuehreModellLaufAus(args, { modelCall: m.call, loadImages: m.images });
beforeEach(() => {
  m.select.mockReset().mockResolvedValue([{ id: "project", measurement }]);
  m.insert.mockReset().mockResolvedValue(undefined);
  m.write.mockReset().mockResolvedValue(undefined);
  m.call.mockReset().mockResolvedValue(response);
  m.images.mockReset().mockResolvedValue([{ marker: "photo 1", jpegBase64: "PRIVATE_IMAGE" }]);
  m.check.mockReset().mockReturnValue({ stufe: "merken", zahlen: {}, zeilen: [] });
  m.sandbox.mockReset().mockResolvedValue({ result: leeresModell("fixture"), sandboxMs: 12 });
});
describe("step 2 lifecycle without real model calls or credit writes", () => {
  it("uses stored measurement and same images, writes only 3D fields and model_runs", async () => {
    const before = JSON.stringify(measurement);
    await run();
    expect(m.call).toHaveBeenCalledWith(expect.objectContaining({
      userText: "MEASUREMENT:\n" + before, bilder: await m.images.mock.results[0]!.value,
    }), { model: SCHRITT2_MODELL, effort: SCHRITT2_EFFORT });
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ model3dStatus: "ready" }));
    expect(m.write.mock.calls[0]![0].model3dReport.duration_ms).toBeGreaterThanOrEqual(0);
    expect(Object.keys(m.write.mock.calls[0]![0]).sort()).toEqual(["model3d", "model3dReport", "model3dStatus"]);
    expect(m.insert).toHaveBeenCalledWith("model_runs", expect.objectContaining({
      inputTokens: 100, outputTokens: 200, costUsd: 0.0044, sandboxMs: 12, korrekturGenutzt: false,
    }));
    expect(JSON.stringify(measurement)).toBe(before);
  });
  it("corrects STOP once with exactly the same images and records two calls", async () => {
    m.check.mockReturnValueOnce(stopped).mockReturnValueOnce({ stufe: "ok", zahlen: {}, zeilen: [] });
    await run();
    expect(m.call).toHaveBeenCalledTimes(2);
    expect(m.insert).toHaveBeenCalledTimes(2);
    expect(m.call.mock.calls[1]![0].userText).toContain("- WL-1 Hauptmaß: Falsch");
    expect(m.call.mock.calls[1]![0].userText).not.toMatch(/__ERRORS__|__PREVIOUS_CODE__/);
    expect(m.call.mock.calls[0]![0].bilder).toBe(m.call.mock.calls[1]![0].bilder);
    expect(m.write.mock.calls[0]![0].model3dReport.korrektur_genutzt).toBe(true);
  });
  it("stores unavailable after two STOPs, never a third paid call", async () => {
    m.check.mockReturnValue(stopped);
    await run();
    expect(m.call).toHaveBeenCalledTimes(2);
    expect(m.insert).toHaveBeenCalledTimes(2);
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ model3d: null, model3dStatus: "unavailable" }));
    expect(m.insert.mock.calls.every(([table]) => table === "model_runs")).toBe(true);
  });
  it("treats missing code as STOP and attempts one correction", async () => {
    m.call.mockResolvedValue({ ...response, text: "No function" });
    await run();
    expect(m.call).toHaveBeenCalledTimes(2);
    expect(m.sandbox).not.toHaveBeenCalled();
    expect(m.insert.mock.calls[0]![1].report.zeilen[0].text).toBe("Keine Funktion buildHouse in der Antwort");
  });
  it("keeps usage when a no-text model exception terminates step 2", async () => {
    m.call.mockRejectedValue(new ModellAntwortFehler("No text", { ...diagnostic, contentTypes: ["thinking"], stopReason: "max_tokens" }));
    await run();
    expect(m.call).toHaveBeenCalledTimes(1);
    expect(m.insert).toHaveBeenCalledWith("model_runs", expect.objectContaining({ inputTokens: 100, outputTokens: 200, costUsd: 0.0044, aiCode: null }));
    expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ model3dStatus: "unavailable" }));
  });
  it("keeps transport usage unknown and writes no credit row", async () => {
    m.call.mockRejectedValue(new Error("Network interrupted"));
    await run();
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.insert).toHaveBeenCalledWith("model_runs", expect.objectContaining({ inputTokens: null, outputTokens: null, costUsd: null }));
    expect(m.write.mock.calls[0]![0].model3dReport.error).toBe("Network interrupted");
  });
  it("does nothing for an already superseded job", async () => {
    m.select.mockResolvedValue([]);
    await run();
    expect(m.call).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.write).not.toHaveBeenCalled();
  });
  it("does not pay for a correction or overwrite a replacement measurement", async () => {
    m.select.mockResolvedValueOnce([{ id: "project", measurement }]).mockResolvedValueOnce([{ id: "project" }]).mockResolvedValueOnce([]);
    m.check.mockReturnValue(stopped);
    await run();
    expect(m.call).toHaveBeenCalledTimes(1);
    expect(m.insert).toHaveBeenCalledTimes(1);
    expect(m.write).not.toHaveBeenCalled();
  });
});
