import { and, eq, sql } from "drizzle-orm";
import { creditLedgerTable, db, usersTable, type CreditReason } from "@workspace/db";

export type CreditTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class KeineCreditsFehler extends Error {
  constructor() { super("No measurement credits available"); this.name = "KeineCreditsFehler"; }
}

export async function holeGuthaben(userId: string, tx: CreditTx | typeof db = db): Promise<number> {
  const [row] = await tx.select({ balance: sql<number>`coalesce(sum(${creditLedgerTable.delta}), 0)::int` })
    .from(creditLedgerTable).where(eq(creditLedgerTable.userId, userId));
  return Number(row?.balance ?? 0);
}

export async function bucheCredits(args: {
  userId: string; delta: number; reason: CreditReason; projectId?: string | null;
  measureRunId?: string | null; staffUserId?: string | null; note?: string | null; refundOf?: string | null;
}, tx?: CreditTx) {
  if (!Number.isInteger(args.delta) || args.delta === 0) throw new Error("Credit delta must be a nonzero integer");
  const write = async (conn: CreditTx) => {
    await conn.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, args.userId)).for("update");
    const [row] = await conn.insert(creditLedgerTable).values(args).returning();
    return row!;
  };
  return tx ? write(tx) : db.transaction(write);
}

export async function verbucheMessung(userId: string, projectId: string, tx?: CreditTx): Promise<string> {
  const charge = async (conn: CreditTx) => {
    await conn.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).for("update");
    if (await holeGuthaben(userId, conn) < 1) throw new KeineCreditsFehler();
    return (await bucheCredits({ userId, projectId, delta: -1, reason: "measurement" }, conn)).id;
  };
  return tx ? charge(tx) : db.transaction(charge);
}

// Lock the charge itself as well as the user. This makes refunds idempotent
// without rewriting the human-readable reason/note or linking to deleted projects.
export async function erstatteMessung(tx: CreditTx, chargeId: string, runId: string, note: string): Promise<void> {
  const [charge] = await tx.select().from(creditLedgerTable)
    .where(and(eq(creditLedgerTable.id, chargeId), eq(creditLedgerTable.reason, "measurement"))).for("update");
  if (!charge) return; // Historical uncharged run: never fabricate a credit.
  const [already] = await tx.select({ id: creditLedgerTable.id }).from(creditLedgerTable)
    .where(and(eq(creditLedgerTable.refundOf, chargeId), eq(creditLedgerTable.reason, "refund")));
  if (already) return;
  await bucheCredits({ userId: charge.userId, projectId: charge.projectId,
    delta: 1, reason: "refund", measureRunId: runId, note, refundOf: chargeId }, tx);
}
