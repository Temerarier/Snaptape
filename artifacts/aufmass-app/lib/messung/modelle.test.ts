import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { stream: mocks.stream }; } }));
import { MESS_MODELL, MESS_EFFORT, ModellAntwortFehler, rufeMessModell, schaetzeKostenUsd } from "./modelle";

beforeEach(() => {
  mocks.stream.mockReset().mockReturnValue({ finalMessage: async () => ({
    id: "msg_test", model: MESS_MODELL, stop_reason: "end_turn",
    content: [{ type: "text", text: "{}" }], usage: { input_tokens: 100, output_tokens: 200 },
  }) });
});
describe("single measurement model", () => {
  it("allows step 2 model and effort without changing the parameter whitelist", async () => {
    await rufeMessModell({ system: "buildhouse", userText: "MEASUREMENT:{}", bilder: [] }, { model: "step2-model", effort: "medium" });
    const body = mocks.stream.mock.calls[0]![0];
    expect(body.model).toBe("step2-model");
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("thinking");
  });
  it("estimates $4/$20 per million including thinking output", () => {
    expect(schaetzeKostenUsd(1_000_000, 0)).toBe(4);
    expect(schaetzeKostenUsd(0, 1_000_000)).toBe(20);
    expect(schaetzeKostenUsd(100, 200)).toBe(0.0044);
  });
  it("sends only supported model parameters", async () => {
    await expect(rufeMessModell({ system: "sys", userText: "text", bilder: [] }))
      .resolves.toMatchObject({ text: "{}", inputTokens: 100, outputTokens: 200,
        diagnostic: { responseId: "msg_test", model: MESS_MODELL, stopReason: "end_turn", contentTypes: ["text"] } });
    const body = mocks.stream.mock.calls[0]![0];
    expect(body).toEqual({ model: MESS_MODELL, max_tokens: 64000, system: "sys",
      messages: [{ role: "user", content: [{ type: "text", text: "text" }] }],
      output_config: { effort: MESS_EFFORT } });
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
  });
  it.each([
    { stop: "max_tokens", content: [{ type: "thinking", thinking: "PRIVATE_THINKING", signature: "PRIVATE_SIGNATURE" }] },
    { stop: "end_turn", content: [] },
    { stop: "refusal", content: [{ type: "redacted_thinking", data: "PRIVATE_REDACTED" }] },
  ])("keeps response metadata for unusable output ($stop), without content", async ({ stop, content }) => {
    mocks.stream.mockReturnValue({ finalMessage: async () => ({
      id: "msg_no_text", model: MESS_MODELL, stop_reason: stop, content,
      usage: { input_tokens: 123, output_tokens: 64000, cache_read_input_tokens: 50, cache_creation_input_tokens: 25 },
      private_provider_payload: "PRIVATE_FULL_RESPONSE",
    }) });
    const error = await rufeMessModell({ system: "PRIVATE_PROMPT", userText: "", bilder: [] }).catch(e => e);
    expect(error).toBeInstanceOf(ModellAntwortFehler);
    expect(error.diagnostic).toEqual({
      responseId: "msg_no_text", model: MESS_MODELL, stopReason: stop,
      contentTypes: content.map(b => b.type), inputTokens: 123, outputTokens: 64000,
      cacheReadInputTokens: 50, cacheCreationInputTokens: 25,
    });
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });
  it("preserves multiple text blocks and records only their types", async () => {
    mocks.stream.mockReturnValue({ finalMessage: async () => ({
      id: "msg_multi", model: MESS_MODELL, stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "PRIVATE" }, { type: "text", text: "{" }, { type: "text", text: "}" }],
      usage: { input_tokens: 2, output_tokens: 3 },
    }) });
    const result = await rufeMessModell({ system: "", userText: "", bilder: [] });
    expect(result.text).toBe("{}");
    expect(result.diagnostic.contentTypes).toEqual(["thinking", "text", "text"]);
    expect(JSON.stringify(result.diagnostic)).not.toContain("PRIVATE");
  });
});
