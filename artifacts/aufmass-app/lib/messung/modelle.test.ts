import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { stream: mocks.stream }; } }));
import { MESS_MODELL, MESS_EFFORT, rufeMessModell, schaetzeKostenUsd } from "./modelle";

beforeEach(() => {
  mocks.stream.mockReset().mockReturnValue({ finalMessage: async () => ({
    content: [{ type: "text", text: "{}" }], usage: { input_tokens: 100, output_tokens: 200 },
  }) });
});
describe("single measurement model", () => {
  it("estimates $4/$20 per million including thinking output", () => {
    expect(schaetzeKostenUsd(1_000_000, 0)).toBe(4);
    expect(schaetzeKostenUsd(0, 1_000_000)).toBe(20);
    expect(schaetzeKostenUsd(100, 200)).toBe(0.0044);
  });
  it("sends only supported model parameters", async () => {
    await expect(rufeMessModell({ system: "sys", userText: "text", bilder: [] }))
      .resolves.toEqual({ text: "{}", inputTokens: 100, outputTokens: 200 });
    const body = mocks.stream.mock.calls[0]![0];
    expect(body).toEqual({ model: MESS_MODELL, max_tokens: 64000, system: "sys",
      messages: [{ role: "user", content: [{ type: "text", text: "text" }] }],
      output_config: { effort: MESS_EFFORT } });
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
  });
});
