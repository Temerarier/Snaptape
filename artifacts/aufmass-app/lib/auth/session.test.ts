import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ existing: [] as unknown[], attached: [] as unknown[], updates: vi.fn(), inserts: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@workspace/db", () => ({
  usersTable: {},
  db: { transaction: async (fn: (tx: unknown) => unknown) => fn({
    execute: vi.fn(),
    select: () => ({ from: () => ({ where: async () => m.existing }) }),
    update: () => ({ set: (v: unknown) => { m.updates(v); return { where: () => ({ returning: async () => m.attached }) }; } }),
    insert: () => ({ values: (v: unknown) => { m.inserts(v); return { returning: async () => [{ id: "new", ...v as object }] }; } }),
  }) },
}));
import { upsertAuthUser } from "./session";
import { grantNewUserTrial } from "../credits/trial";
vi.mock("../credits/trial", () => ({ grantNewUserTrial: vi.fn() }));
const profile = { id: "user_clerk", email: "TRIAL@EXAMPLE.COM", firstName: "Trial", lastName: null, sessionId: "session" };
beforeEach(() => { m.existing = []; m.attached = []; m.updates.mockReset(); m.inserts.mockReset(); vi.mocked(grantNewUserTrial).mockReset(); });
describe("Clerk to local user bridge", () => {
  it("maps external ID and login time on first signup", async () => {
    await upsertAuthUser(profile);
    expect(m.inserts).toHaveBeenCalledWith(expect.objectContaining({
      email: "trial@example.com", replitUserId: "user_clerk", lastLoginAt: expect.any(Date), lastAuthSessionId: "session",
    }));
    expect(grantNewUserTrial).toHaveBeenCalledOnce();
    expect(grantNewUserTrial).toHaveBeenCalledWith(expect.anything(), "new");
  });
  it("attaches the verified old email row without a duplicate", async () => {
    m.attached = [{ id: "old" }];
    expect(await upsertAuthUser(profile)).toEqual({ id: "old" });
    expect(m.inserts).not.toHaveBeenCalled();
    expect(grantNewUserTrial).not.toHaveBeenCalled();
    expect(m.updates).toHaveBeenCalledWith(expect.objectContaining({ replitUserId: "user_clerk", lastLoginAt: expect.any(Date) }));
  });
  it("updates login time for a new session", async () => {
    m.existing = [{ id: "old", lastAuthSessionId: "previous" }]; m.attached = [{ id: "old" }];
    await upsertAuthUser(profile);
    expect(m.updates).toHaveBeenCalledWith(expect.objectContaining({ lastLoginAt: expect.any(Date) }));
    expect(grantNewUserTrial).not.toHaveBeenCalled();
  });
});
