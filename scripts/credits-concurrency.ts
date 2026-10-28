// One real PostgreSQL concurrency check; the isolated test user is removed
// in finally (cascades only this script's projects and ledger).
import { randomUUID } from "node:crypto";
import { db, pool, usersTable, projectsTable, creditLedgerTable } from "../lib/db/src/index";
import { bucheCredits, holeGuthaben, verbucheMessung, KeineCreditsFehler } from "../artifacts/aufmass-app/lib/credits/service";
const id = randomUUID();
try {
  await db.insert(usersTable).values({ id, replitUserId: `concurrency-${id}` });
  const projects = await db.insert(projectsTable).values([
    { userId: id, name: "Credit concurrency A" }, { userId: id, name: "Credit concurrency B" },
  ]).returning();
  await bucheCredits({ userId: id, delta: 1, reason: "staff_grant", note: "isolated concurrency test" });
  const result = await Promise.allSettled(projects.map((p) => verbucheMessung(id, p.id)));
  const { rows: charges } = await pool.query("select id from credit_ledger where user_id = $1 and reason = 'measurement'", [id]);
  const ok = result.filter((r) => r.status === "fulfilled").length;
  const rejected = result.filter((r) => r.status === "rejected" && r.reason instanceof KeineCreditsFehler).length;
  const balance = await holeGuthaben(id);
  const evidence = { successfulStarts: ok, insufficientCreditErrors: rejected, measurementLedgerRows: charges.length, finalBalance: balance };
  console.log(JSON.stringify(evidence));
  if (ok !== 1 || rejected !== 1 || charges.length !== 1 || balance !== 0) throw new Error("Concurrency invariant failed");
} finally {
  await pool.query("delete from users where id = $1", [id]);
  await pool.end();
}
