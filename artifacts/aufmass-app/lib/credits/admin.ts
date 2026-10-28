import { desc, eq, sql } from "drizzle-orm";
import { creditLedgerTable, db, measureRunsTable, modelRunsTable, projectsTable, usersTable } from "@workspace/db";
import { nutzerName } from "@/lib/auth/display";

export async function ladeNutzerUebersicht() {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const totals = await db.select({
    userId: projectsTable.userId,
    readyCount: sql<number>`count(*) filter (where ${measureRunsTable.outcome} = 'model_ready')::int`,
    failedCount: sql<number>`count(*) filter (where ${measureRunsTable.outcome} = 'failed')::int`,
    costUsd: sql<number>`coalesce(sum(${measureRunsTable.costUsd}), 0)::float8`,
    unknownCosts: sql<number>`count(*) filter (where ${measureRunsTable.costUsd} is null)::int`,
    lastMeasurementAt: sql<Date | null>`max(${measureRunsTable.createdAt})`,
  }).from(measureRunsTable).innerJoin(projectsTable, eq(projectsTable.id, measureRunsTable.projectId))
    .groupBy(projectsTable.userId);
  // Aggregate independently: joining both run tables would multiply costs.
  const modelTotals = await db.select({
    userId: projectsTable.userId,
    costUsd: sql<number>`coalesce(sum(${modelRunsTable.costUsd}), 0)::float8`,
    unknownCosts: sql<number>`count(*) filter (where ${modelRunsTable.costUsd} is null)::int`,
  }).from(modelRunsTable).innerJoin(projectsTable, eq(projectsTable.id, modelRunsTable.projectId))
    .groupBy(projectsTable.userId);
  const ledger = await db.select().from(creditLedgerTable).orderBy(desc(creditLedgerTable.createdAt));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const totalMap = new Map(totals.map((row) => [row.userId, row]));
  const modelTotalMap = new Map(modelTotals.map(row => [row.userId, row]));
  return users.map((user) => {
    const entries = ledger.filter((row) => row.userId === user.id);
    const stats = totalMap.get(user.id);
    const modelStats = modelTotalMap.get(user.id);
    return { id: user.id, label: nutzerName(user), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
      balance: entries.reduce((sum, row) => sum + row.delta, 0),
      readyCount: stats?.readyCount ?? 0, failedCount: stats?.failedCount ?? 0,
      costUsd: stats?.costUsd ?? 0,
      costTotalUsd: (stats?.costUsd ?? 0) + (modelStats?.costUsd ?? 0),
      unknownCosts: (stats?.unknownCosts ?? 0) + (modelStats?.unknownCosts ?? 0),
      lastMeasurementAt: stats?.lastMeasurementAt ? new Date(stats.lastMeasurementAt) : null,
      ledger: entries.map((row) => ({ ...row,
        staffLabel: row.staffUserId && userMap.has(row.staffUserId) ? nutzerName(userMap.get(row.staffUserId)!) : null })),
    };
  });
}
