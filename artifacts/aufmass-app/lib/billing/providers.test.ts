import { describe, expect, it, vi } from "vitest";
import {
  fetchAnthropicCosts,
  parseAnthropicCostPage,
  parseMoonshotBalance,
  parseUsdCentDecimal,
} from "./providers";
import { assertUtcDay, completedUtcDays } from "./time";

describe("billing provider parsing", () => {
  it("uses exactly the seven completed UTC days", () => {
    expect(completedUtcDays(new Date("2026-09-23T17:00:00Z"))).toEqual([
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
    ]);
  });

  it("does not shift UTC boundaries with local time", () => {
    expect(completedUtcDays(new Date("2026-09-23T00:00:00.001Z")).at(-1)).toBe(
      "2026-09-22",
    );
    expect(completedUtcDays(new Date("2026-09-22T23:59:59.999Z")).at(-1)).toBe(
      "2026-09-21",
    );
    expect(() => assertUtcDay("2026-02-30")).toThrow("Invalid UTC day");
  });

  it("converts decimal USD cents to dollars without treating cents as dollars", () => {
    expect(parseUsdCentDecimal("123.45")).toBe(1.2345);
    expect(parseUsdCentDecimal("0.01")).toBe(0.0001);
    expect(() => parseUsdCentDecimal("NaN")).toThrow();
  });

  it("parses daily Anthropic USD model rows", () => {
    expect(
      parseAnthropicCostPage({
        data: [
          {
            starting_at: "2026-09-22T00:00:00Z",
            results: [
              { model: "claude-fable-5", currency: "USD", amount: "1015" },
            ],
          },
        ],
        has_more: false,
      }).rows[0],
    ).toMatchObject({
      utcDay: "2026-09-22",
      model: "claude-fable-5",
      amountUsd: 10.15,
    });
  });

  it("does not return until pagination is complete", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ starting_at: "2026-09-21T00:00:00Z", results: [] }],
            has_more: true,
            next_page: "next",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                starting_at: "2026-09-22T00:00:00Z",
                results: [{ model: "m", currency: "USD", amount: "125" }],
              },
            ],
            has_more: false,
          }),
        ),
      );
    const report = await fetchAnthropicCosts({
      from: "2026-09-21",
      toExclusive: "2026-09-23",
      apiKey: "test",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(report.rows).toHaveLength(1);
    expect(report.coveredDays).toEqual(["2026-09-21", "2026-09-22"]);
    const firstUrl = new URL(String(fetchImpl.mock.calls[0][0]));
    const secondUrl = new URL(String(fetchImpl.mock.calls[1][0]));
    expect(firstUrl.searchParams.getAll("group_by[]")).toEqual([
      "workspace_id",
      "description",
    ]);
    expect(secondUrl.searchParams.get("starting_at")).toBe(
      firstUrl.searchParams.get("starting_at"),
    );
    expect(secondUrl.searchParams.get("ending_at")).toBe(
      firstUrl.searchParams.get("ending_at"),
    );
    expect(secondUrl.searchParams.get("page")).toBe("next");
  });

  it("fails closed when pagination cannot be completed", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [], has_more: true, next_page: "same" }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [], has_more: true, next_page: "same" }),
        ),
      );
    await expect(
      fetchAnthropicCosts({
        from: "2026-09-21",
        toExclusive: "2026-09-23",
        apiKey: "test",
        fetchImpl,
      }),
    ).rejects.toThrow("pagination was incomplete");
  });

  it("requires explicit pagination metadata even when data is present", () => {
    expect(() =>
      parseAnthropicCostPage({
        data: [{ starting_at: "2026-09-22T00:00:00Z", results: [] }],
      }),
    ).toThrow("boolean has_more");
  });

  it("preserves non-model charges explicitly and rejects unknown currency", () => {
    expect(
      parseAnthropicCostPage({
        data: [
          {
            starting_at: "2026-09-22T00:00:00Z",
            results: [{ model: null, currency: "USD", amount: "100" }],
          },
        ],
        has_more: false,
      }).rows[0].model,
    ).toBe("__non_model__");
    expect(() =>
      parseAnthropicCostPage({
        data: [
          {
            starting_at: "2026-09-22T00:00:00Z",
            results: [{ model: "m", currency: "EUR", amount: "100" }],
          },
        ],
      }),
    ).toThrow("Unsupported Anthropic currency");
  });

  it("parses Moonshot balance without inventing model allocation", () => {
    expect(
      parseMoonshotBalance({
        code: 0,
        status: true,
        scode: "0",
        data: {
          available_balance: 42.5,
          voucher_balance: 12.5,
          cash_balance: 30,
          user_id: "acct-1",
        },
      }),
    ).toMatchObject({
      balanceUsd: 42.5,
      voucherBalanceUsd: 12.5,
      cashBalanceUsd: 30,
      accountScope: "acct-1",
      currency: "USD",
    });
  });

  it("rejects unsuccessful Moonshot envelopes and accepts negative cash", () => {
    expect(() =>
      parseMoonshotBalance({
        code: 7,
        status: false,
        scode: "denied",
        data: {},
      }),
    ).toThrow("unsuccessful");
    expect(
      parseMoonshotBalance({
        code: 0,
        status: true,
        data: {
          available_balance: 5,
          voucher_balance: 5,
          cash_balance: -2,
        },
      }).cashBalanceUsd,
    ).toBe(-2);
  });
});
