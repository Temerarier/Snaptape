import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({ db: {}, creditLedgerTable: {} }));
import { grantNewUserTrial, trialDailyLimit, trialDayBounds } from "./trial";
import type { CreditTx } from "./service";

afterEach(() => vi.unstubAllEnvs());

describe("trial credit policy", () => {
  it("defaults to 20 and accepts a configurable cap, including zero", () => {
    vi.stubEnv("TRIAL_DAILY_LIMIT", undefined);
    expect(trialDailyLimit()).toBe(20);
    expect(trialDailyLimit("3")).toBe(3);
    expect(trialDailyLimit("0")).toBe(0);
  });
  it.each(["", "-1", "1.5", "twenty", "9007199254740992"])("rejects invalid limit %s", (value) => {
    expect(() => trialDailyLimit(value)).toThrow("TRIAL_DAILY_LIMIT");
  });
  it("uses UTC calendar days, including a month/year boundary", () => {
    expect(trialDayBounds(new Date("2026-12-31T23:59:59.999Z"))).toEqual({
      start: new Date("2026-12-31T00:00:00Z"), end: new Date("2027-01-01T00:00:00Z"),
    });
  });
  it.each([19, 20, 21])("serializes before checking a count of %i", async (count) => {
    vi.stubEnv("TRIAL_DAILY_LIMIT", "20");
    const order: string[] = [];
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn() }));
    const tx = {
      execute: async () => { order.push("lock"); },
      select: () => ({ from: () => ({ where: async () => { order.push("count"); return [{ count }]; } }) }),
      insert: () => ({ values }),
    } as unknown as CreditTx;
    await grantNewUserTrial(tx, "new-user");
    expect(order).toEqual(["lock", "count"]);
    if (count < 20) expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "new-user", delta: 1, reason: "trial_grant", note: "free trial",
    }));
    else expect(values).not.toHaveBeenCalled();
  });
});
