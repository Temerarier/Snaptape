import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectClassification, ProjectFile } from "@workspace/db";

const mocks = vi.hoisted(() => ({
  call: vi.fn(), compute: vi.fn(), assemble: vi.fn(),
}));
vi.mock("./modelle", async (original) => ({
  ...await original<typeof import("./modelle")>(), rufeMessModell: mocks.call,
}));
vi.mock("@/lib/storage/objectStorage", () => ({ ladeObjekt: async () => Buffer.from("PRIVATE_IMAGE") }));
vi.mock("@/lib/upload/verarbeitung", () => ({ verkleinereFuerKI: async () => Buffer.from("PRIVATE_IMAGE") }));
vi.mock("./prompts", () => ({
  baueSystemText: () => "PRIVATE_PROMPT", baueRepairSystemText: () => "PRIVATE_REPAIR",
  REPAIR_VORTEXT: "Repair: ", REPAIR_AUSGABE_MARKER: "OUTPUT:", REPAIR_MAX_ZEICHEN: 150000,
}));
vi.mock("./berechnung", () => ({
  berechneKonsolidierung: mocks.compute, validiereUndAssembliere: mocks.assemble,
}));

import { extrahiereEcht, ExtraktionsFehler } from "./echterExtraktor";
import { ModellAntwortFehler, MESS_MODELL, MESS_EFFORT, schaetzeKostenUsd } from "./modelle";

const files = [{
  kind: "photo", sortOrder: 0, originalName: "fixture.jpg", storagePath: "unused",
  classification: [{ selectedForMeasurement: true, page: 1 }],
}] as ProjectFile[];
const classification = { projectType: "photo" } as ProjectClassification;
const options = { quality: "premium" as const, referenz: null };
const validText = JSON.stringify({ faces: [{ id: "WL-1" }], edges: [], openings: [] });
function diagnostic(id = "msg_test", input = 100, output = 200) {
  return {
    responseId: id, model: MESS_MODELL, stopReason: "end_turn", contentTypes: ["text"],
    inputTokens: input, outputTokens: output, cacheReadInputTokens: null, cacheCreationInputTokens: null,
  };
}
function response(text = validText, id = "msg_test") {
  return { text, inputTokens: 100, outputTokens: 200, diagnostic: diagnostic(id) };
}
function noText() {
  return new ModellAntwortFehler("Anthropic API returned no text content.", {
    ...diagnostic("msg_thinking", 30, 64000), stopReason: "max_tokens", contentTypes: ["thinking"],
  });
}
const run = () => extrahiereEcht(files, classification, options);

beforeEach(() => {
  mocks.call.mockReset();
  mocks.compute.mockReset().mockImplementation((p) => p);
  mocks.assemble.mockReset().mockImplementation((p) => ({ result: p.result, summary: "ok" }));
});

describe("response metadata across extraction stages, without paid calls", () => {
  it("retains success diagnostics without including images or prompts", async () => {
    mocks.call.mockResolvedValue(response());
    const result = await run();
    expect(result.modelDiagnostics).toEqual({
      effort: MESS_EFFORT, usageComplete: true, responses: [{ ...diagnostic(), phase: "extract" }],
    });
    expect(JSON.stringify(result.modelDiagnostics)).not.toContain("PRIVATE");
    expect(result.costUsd).toBe(schaetzeKostenUsd(100, 200));
  });
  it("preserves known usage when the first response has no text", async () => {
    mocks.call.mockRejectedValue(noText());
    const error = await run().catch(e => e);
    expect(error).toBeInstanceOf(ExtraktionsFehler);
    expect(error.meta).toMatchObject({
      inputTokens: 30, outputTokens: 64000, costUsd: schaetzeKostenUsd(30, 64000),
      retryUsed: false, repairUsed: false,
      modelDiagnostics: { usageComplete: true, responses: [{ phase: "extract", stopReason: "max_tokens" }] },
    });
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.meta)).not.toContain("PRIVATE");
  });
  it.each(["retry", "repair"] as const)("keeps the first response and a failed %s response", async (phase) => {
    mocks.call.mockResolvedValueOnce(response(phase === "retry" ? "{}" : "not JSON", "msg_first"))
      .mockRejectedValueOnce(noText());
    const error = await run().catch(e => e);
    expect(error).toBeInstanceOf(ExtraktionsFehler);
    expect(error.meta.inputTokens).toBe(130);
    expect(error.meta.outputTokens).toBe(64200);
    expect(error.meta.costUsd).toBe(schaetzeKostenUsd(130, 64200));
    expect(error.meta.modelDiagnostics.responses.map((r: { phase: string }) => r.phase)).toEqual(["extract", phase]);
    expect(error.meta.retryUsed).toBe(phase === "retry");
    expect(error.meta.repairUsed).toBe(phase === "repair");
    expect(mocks.call).toHaveBeenCalledTimes(2);
  });
  it("keeps exactly the existing extract/retry/repair sequence", async () => {
    mocks.call.mockResolvedValueOnce(response("{}"))
      .mockResolvedValueOnce(response("not JSON"))
      .mockResolvedValueOnce(response());
    const result = await run();
    expect(result.modelDiagnostics?.responses.map(r => r.phase)).toEqual(["extract", "retry", "repair"]);
    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(600);
    expect(result.retryUsed).toBe(true);
    expect(result.repairUsed).toBe(true);
    expect(mocks.call).toHaveBeenCalledTimes(3);
  });
  it("does not invent zero usage when no final response was received", async () => {
    mocks.call.mockRejectedValue(new Error("Connection interrupted"));
    const error = await run().catch(e => e);
    expect(error.meta).toMatchObject({
      inputTokens: null, outputTokens: null, costUsd: null,
      modelDiagnostics: { usageComplete: false, responses: [] },
    });
  });
  it("keeps earlier usage separately when a subsequent call is interrupted", async () => {
    mocks.call.mockResolvedValueOnce(response("{}")).mockRejectedValueOnce(new Error("Connection interrupted"));
    const error = await run().catch(e => e);
    expect(error.meta).toMatchObject({ inputTokens: null, outputTokens: null, costUsd: null });
    expect(error.meta.modelDiagnostics).toMatchObject({
      usageComplete: false, responses: [{ inputTokens: 100, outputTokens: 200, phase: "extract" }],
    });
  });
  it("retains response metadata on a final parse failure", async () => {
    mocks.call.mockResolvedValue(response("not JSON"));
    const error = await run().catch(e => e);
    expect(error.meta.modelDiagnostics.responses).toHaveLength(2);
    expect(error.meta.inputTokens).toBe(200);
    expect(error.meta.repairUsed).toBe(true);
  });
  it("retains usage if post-response computation throws", async () => {
    mocks.call.mockResolvedValue(response());
    mocks.compute.mockImplementation(() => { throw new Error("Computation failed"); });
    const error = await run().catch(e => e);
    expect(error.meta.modelDiagnostics.responses).toHaveLength(1);
    expect(error.meta.inputTokens).toBe(100);
    expect(error.meta.outputTokens).toBe(200);
  });
});
