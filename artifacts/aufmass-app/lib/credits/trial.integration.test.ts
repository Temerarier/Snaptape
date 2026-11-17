// Opt-in real development PostgreSQL test. Deletes only uniquely named test users.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, usersTable, creditLedgerTable, projectsTable } from "@workspace/db";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { upsertAuthUser } from "../auth/session";
import { holeGuthaben, verbucheMessung } from "./service";
import { trialStatus } from "./trial";

const enabled = process.env.RUN_TRIAL_DB_TESTS === "1";
const identities: string[] = [];
function profile() {
  const id = `trial-test-${randomUUID()}`;
  identities.push(id);
  return { id, email: `${id}@example.invalid`, firstName: "Trial test", lastName: null, sessionId: id };
}
afterAll(async () => {
  if (enabled) {
    if (identities.length) await db.delete(usersTable).where(inArray(usersTable.replitUserId, identities));
    vi.unstubAllEnvs();
    await pool.end();
  }
});

describe.skipIf(!enabled)("trial grants against real PostgreSQL", () => {
  it("grants once under concurrent login, excludes old users, caps concurrent new accounts, and spends normally", async () => {
    const baseline = (await trialStatus()).granted;
    vi.stubEnv("TRIAL_DAILY_LIMIT", String(baseline + 20));
    const first = profile();
    const results = await Promise.all(Array.from({ length: 8 }, () => upsertAuthUser(first)));
    expect(new Set(results.map(r => r.id)).size).toBe(1);
    const user = results[0]!;
    expect(await holeGuthaben(user.id)).toBe(1);
    await upsertAuthUser({ ...first, sessionId: `${first.sessionId}-next-login` });
    const grants = await db.select().from(creditLedgerTable).where(eq(creditLedgerTable.userId, user.id));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ reason: "trial_grant", delta: 1, note: "free trial" });

    const old = profile();
    await db.insert(usersTable).values({ email: old.email, replitUserId: old.id });
    const existing = await upsertAuthUser(old);
    expect(await holeGuthaben(existing.id)).toBe(0);
    const attach = profile();
    await db.insert(usersTable).values({ email: attach.email });
    const attached = await upsertAuthUser(attach);
    expect(await holeGuthaben(attached.id)).toBe(0);

    const newProfiles = Array.from({ length: 24 }, profile);
    const created = await Promise.all(newProfiles.map(upsertAuthUser));
    expect((await trialStatus()).granted).toBe(baseline + 20);
    const balances = await Promise.all(created.map(u => holeGuthaben(u.id)));
    expect(balances.filter(b => b === 1)).toHaveLength(19);
    expect(balances.filter(b => b === 0)).toHaveLength(5);
    // Raising the cap (also representing a later day's fresh allowance) cannot
    // turn a capped existing account into an eligible new account.
    vi.stubEnv("TRIAL_DAILY_LIMIT", String(baseline + 30));
    const deniedIndex = balances.findIndex(b => b === 0);
    const denied = await upsertAuthUser(newProfiles[deniedIndex]!);
    expect(await holeGuthaben(denied.id)).toBe(0);

    const [project] = await db.insert(projectsTable).values({ userId: user.id, name: "Trial credit integration" }).returning();
    await verbucheMessung(user.id, project!.id);
    expect(await holeGuthaben(user.id)).toBe(0);
    await expect(verbucheMessung(user.id, project!.id)).rejects.toThrow("No measurement credits");
    console.log("Verified: concurrent login 1 grant; 24 concurrent signups capped; existing/attached/capped users 0; measurement debit 1→0.");
  }, 60_000);
});
