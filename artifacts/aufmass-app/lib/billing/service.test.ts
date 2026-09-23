import { afterEach, describe, expect, it, vi } from "vitest";
import { pool } from "@workspace/db";
import {
  billingTestInternals,
  calculateDifferencePercent,
  calculateSnapshotSpend,
  isBillingDifferenceFlagged,
} from "./service";

interface LoggedQuery {
  text: string;
  values?: unknown[];
}

function fakeDb(authRejected = false) {
  const queries: LoggedQuery[] = [];
  return {
    queries,
    db: {
      async query(text: string, values?: unknown[]) {
        queries.push({ text, values });
        if (text.includes("SELECT auth_rejected_at")) {
          return {
            rows: authRejected ? [{ auth_rejected_at: new Date() }] : [],
            rowCount: authRejected ? 1 : 0,
          };
        }
        return { rows: [], rowCount: text.includes("RETURNING") ? 1 : 0 };
      },
    },
  };
}

const oldAdminKey = process.env.ANTHROPIC_ADMIN_KEY;
const oldKimiKey = process.env.KIMI_API_KEY;
afterEach(() => {
  if (oldAdminKey === undefined) delete process.env.ANTHROPIC_ADMIN_KEY;
  else process.env.ANTHROPIC_ADMIN_KEY = oldAdminKey;
  if (oldKimiKey === undefined) delete process.env.KIMI_API_KEY;
  else process.env.KIMI_API_KEY = oldKimiKey;
});

describe("billing reconciliation state", () => {
  it("does not call Anthropic while the rejection circuit is open", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "test";
    const { db, queries } = fakeDb(true);
    const fetchImpl = vi.fn();
    const result = await billingTestInternals.reconcileAnthropic(
      db,
      ["2026-09-22"],
      { retryAuth: false, fetchImpl },
    );
    expect(result.status).toBe("auth_rejected_circuit_open");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      queries.some((query) =>
        query.text.includes("INSERT INTO billing_reconciliations"),
      ),
    ).toBe(true);
  });

  it("atomically invalidates all requested days after a 403", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "test";
    const { db, queries } = fakeDb();
    const result = await billingTestInternals.reconcileAnthropic(
      db,
      ["2026-09-20", "2026-09-21", "2026-09-22"],
      {
        retryAuth: false,
        fetchImpl: vi
          .fn()
          .mockResolvedValue(new Response("denied", { status: 403 })),
      },
    );
    expect(result.status).toBe("key_rejected");
    expect(queries.some((query) => query.text === "BEGIN")).toBe(true);
    expect(queries.some((query) => query.text === "COMMIT")).toBe(true);
    const invalidations = queries.filter((query) =>
      query.text.includes("INSERT INTO billing_reconciliations"),
    );
    expect(invalidations).toHaveLength(3);
    expect(
      invalidations.every(
        (query) => query.values?.[4] === "not_reconciled_key_rejected",
      ),
    ).toBe(true);
    expect(
      queries.filter((query) =>
        query.text.includes("UPDATE billing_reconciliations"),
      ),
    ).toHaveLength(3);
  });

  it("marks every day partial and publishes no amounts if a later page fails", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "test";
    const { db, queries } = fakeDb();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [], has_more: true, next_page: "p2" }),
        ),
      )
      .mockResolvedValue(new Response("upstream", { status: 500 }));
    const result = await billingTestInternals.reconcileAnthropic(
      db,
      ["2026-09-21", "2026-09-22"],
      { retryAuth: false, fetchImpl },
    );
    expect(result.status).toBe("partial");
    expect(
      queries.some((query) =>
        query.text.includes(
          "DELETE FROM billing_reconciliations WHERE provider = 'anthropic'",
        ),
      ),
    ).toBe(false);
    expect(
      queries
        .filter((query) =>
          query.text.includes("INSERT INTO billing_reconciliations"),
        )
        .every((query) => query.values?.[4] === "partial"),
    ).toBe(true);
  });

  it("does not fetch or duplicate a Moonshot snapshot already captured today", async () => {
    process.env.KIMI_API_KEY = "test";
    const fetchImpl = vi.fn();
    const db = {
      async query(text: string) {
        if (text.includes("SELECT 1 FROM billing_balance_snapshots")) {
          return { rows: [{ "?column?": 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const result = await billingTestInternals.snapshotMoonshot(
      db,
      new Date("2026-09-23T23:59:59Z"),
      fetchImpl,
    );
    expect(result).toMatchObject({
      attempted: false,
      status: "already_captured",
      inserted: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps exactly one failure row per successful model after 403 and partial transitions", async () => {
    const client = await pool.connect();
    const day = "2098-12-30";
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM billing_reconciliations WHERE provider = 'anthropic' AND utc_day = $1",
        [day],
      );
      await client.query(
        `INSERT INTO billing_reconciliations
           (provider, utc_day, model, account_scope, actual_cost_usd, status)
         VALUES
           ('anthropic', $1, 'claude-model-a', 'anthropic-organization', 1, 'provisional'),
           ('anthropic', $1, 'claude-model-b', 'anthropic-organization', 2, 'provisional'),
           ('anthropic', $1, '__account__', 'anthropic-organization', 3, 'provisional')`,
        [day],
      );

      await billingTestInternals.setDayStatuses(
        client,
        "anthropic",
        [day],
        "not_reconciled_key_rejected",
        "rejected",
      );
      let stored = await client.query(
        `SELECT model, actual_cost_usd, status
         FROM billing_reconciliations
         WHERE provider = 'anthropic' AND utc_day = $1
         ORDER BY model`,
        [day],
      );
      expect(stored.rows).toEqual([
        {
          model: "claude-model-a",
          actual_cost_usd: null,
          status: "not_reconciled_key_rejected",
        },
        {
          model: "claude-model-b",
          actual_cost_usd: null,
          status: "not_reconciled_key_rejected",
        },
      ]);
      let dashboard = await billingTestInternals.getBillingDashboardWithDb(
        client,
        { from: day, to: day, provider: "anthropic" },
      );
      expect(dashboard.map((row) => row.model)).toEqual([
        "claude-model-a",
        "claude-model-b",
      ]);

      await billingTestInternals.setDayStatuses(
        client,
        "anthropic",
        [day],
        "partial",
        "transient",
      );
      stored = await client.query(
        `SELECT model, status FROM billing_reconciliations
         WHERE provider = 'anthropic' AND utc_day = $1 ORDER BY model`,
        [day],
      );
      expect(stored.rows).toEqual([
        { model: "claude-model-a", status: "partial" },
        { model: "claude-model-b", status: "partial" },
      ]);
      dashboard = await billingTestInternals.getBillingDashboardWithDb(client, {
        from: day,
        to: day,
        provider: "anthropic",
      });
      expect(dashboard).toHaveLength(2);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

describe("billing calculations", () => {
  it("handles missing and zero estimates without infinite percentages", () => {
    expect(calculateDifferencePercent(null, 5)).toBeNull();
    expect(calculateDifferencePercent(0, 5)).toBe(-100);
    expect(calculateDifferencePercent(5, 0)).toBeNull();
    expect(calculateDifferencePercent(0, 0)).toBe(0);
    expect(calculateDifferencePercent(11, 10)).toBeCloseTo(10);
    expect(calculateDifferencePercent(9, 10)).toBeCloseTo(-10);
    expect(isBillingDifferenceFlagged(5, 0, null, 0)).toBe(true);
    expect(isBillingDifferenceFlagged(5, null, null, 0)).toBe(false);
    expect(isBillingDifferenceFlagged(5, 5, 0, 1)).toBe(true);
  });

  it("subtracts top-ups before deriving snapshot spend", () => {
    expect(calculateSnapshotSpend(20, 25, 10)).toBe(5);
    expect(calculateSnapshotSpend(20, 15, 0)).toBe(5);
  });
});
