import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  candidates: [] as unknown[], project: undefined as unknown, writes: vi.fn(), runs: vi.fn(), refund: vi.fn(),
}));
vi.mock("@/lib/credits/service", () => ({ erstatteMessung: m.refund }));
vi.mock("@workspace/db", () => ({
  usersTable: {}, projectsTable: {}, measureRunsTable: {},
  db: {
    select: () => ({ from: () => ({ where: async () => m.candidates }) }),
    transaction: async (fn: (tx: unknown) => unknown) => fn({
      select: () => ({ from: () => ({ where: () => ({ for: async () => m.project ? [m.project] : [] }) }) }),
      update: () => ({ set: (v: unknown) => { m.writes(v); return { where: async () => { m.project = undefined; } }; } }),
      insert: () => ({ values: (v: unknown) => { m.runs(v); return { returning: async () => [{ id: "timeout-run" }] }; } }),
    }),
  },
}));
import { raeumeHaengendeMessungenAuf } from "./aufraeumen";
beforeEach(() => { m.candidates = []; m.project = undefined; m.writes.mockReset(); m.runs.mockReset(); m.refund.mockReset(); });
describe("stale run cleanup", () => {
  it("settles an expired charged run and refunds once across two sweeps", async () => {
    m.candidates = [{ id: "project", userId: "user" }];
    m.project = { id: "project", status: "processing", processingSince: new Date(Date.now() - 7_200_000), currentCreditLedgerId: "charge" };
    await raeumeHaengendeMessungenAuf("user");
    await raeumeHaengendeMessungenAuf("user");
    expect(m.writes).toHaveBeenCalledOnce();
    expect(m.writes).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", processingSince: null, currentRunId: null, measurementErrors: ["Measurement timed out after 60 minutes"] }));
    expect(m.refund).toHaveBeenCalledOnce();
    expect(m.refund).toHaveBeenCalledWith(expect.anything(), "charge", "timeout-run", "timeout");
  });
  it("does nothing when no projects meet the age condition", async () => {
    await raeumeHaengendeMessungenAuf();
    expect(m.writes).not.toHaveBeenCalled();
    expect(m.refund).not.toHaveBeenCalled();
  });
  it("fails an old model_ready row without inventing a refund", async () => {
    m.candidates = [{ id: "legacy", userId: "user" }];
    m.project = { id: "legacy", status: "model_ready", measurement: null, currentCreditLedgerId: null };
    await raeumeHaengendeMessungenAuf();
    expect(m.writes).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", measurementErrors: ["Measurement is missing"] }));
    expect(m.refund).not.toHaveBeenCalled();
  });
});
