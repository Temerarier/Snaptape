import { describe, expect, it, vi } from "vitest";
import { recoverStaleAction } from "./recoverStaleAction";

describe("outdated auth action recovery", () => {
  it.each([
    Object.assign(new Error("obsolete action"), { name: "UnrecognizedActionError" }),
    new Error('Server Action "old-id" was not found on the server.'),
  ])("shows a reload prompt without replaying the submission", async (error) => {
    const action = vi.fn().mockRejectedValue(error);
    expect(await recoverStaleAction(action, {}, new FormData(), "Reload this page"))
      .toEqual({ error: "Reload this page", refreshRequired: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("preserves ordinary validation results", async () => {
    const state = { error: "Invalid credentials" };
    expect(await recoverStaleAction(async () => state, {}, new FormData(), "Reload"))
      .toBe(state);
  });

  it.each([new Error("Database unavailable"), new Error("NEXT_REDIRECT")])(
    "does not swallow other failures or redirects",
    async (error) => {
      await expect(recoverStaleAction(async () => { throw error; }, {}, new FormData(), "Reload"))
        .rejects.toBe(error);
    },
  );
});