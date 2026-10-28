import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rows: [] as unknown[][], values: vi.fn(), forUpdate: vi.fn() }));
vi.mock("@workspace/db", () => {
  const tx = {
    select: () => {
      const result = Promise.resolve(m.rows.shift() ?? []);
      const q = Object.assign(result, { from: () => q, where: () => q, for: () => { m.forUpdate(); return q; } });
      return q;
    },
    insert: () => ({ values: (v: unknown) => { m.values(v); return { returning: async () => [{ id: "ledger" }] }; } }),
  };
  return { db: { ...tx, transaction: async (fn: (tx: unknown) => unknown) => fn(tx) }, creditLedgerTable: {}, usersTable: {} };
});
import { bucheCredits, erstatteMessung, holeGuthaben, KeineCreditsFehler, verbucheMessung } from "./service";
beforeEach(() => { m.rows = []; m.values.mockReset(); m.forUpdate.mockReset(); });
describe("credits ledger", () => {
  it("reads the aggregate balance (no balance column)", async () => {
    m.rows = [[{ balance: "7" }]];
    expect(await holeGuthaben("user")).toBe(7);
  });
  it("rejects balance zero under the row lock", async () => {
    m.rows = [[{ id: "user" }], [{ balance: 0 }]];
    await expect(verbucheMessung("user", "project")).rejects.toBeInstanceOf(KeineCreditsFehler);
    expect(m.forUpdate).toHaveBeenCalledOnce();
    expect(m.values).not.toHaveBeenCalled();
  });
  it("debits exactly one credit", async () => {
    m.rows = [[{ id: "user" }], [{ balance: 1 }], [{ id: "user" }]];
    expect(await verbucheMessung("user", "project")).toBe("ledger");
    expect(m.values).toHaveBeenCalledWith({ userId: "user", projectId: "project", delta: -1, reason: "measurement" });
  });
  it("rejects zero or fractional entries", async () => {
    await expect(bucheCredits({ userId: "u", delta: 0, reason: "adjustment" })).rejects.toThrow();
    await expect(bucheCredits({ userId: "u", delta: .5, reason: "adjustment" })).rejects.toThrow();
  });
  it("never refunds the same charge twice", async () => {
    const { db } = await import("@workspace/db");
    m.rows = [[{ id: "charge", userId: "u", projectId: "p" }], [{ id: "existing-refund" }]];
    await db.transaction((tx) => erstatteMessung(tx, "charge", "run", "timeout"));
    expect(m.values).not.toHaveBeenCalled();
  });
});
