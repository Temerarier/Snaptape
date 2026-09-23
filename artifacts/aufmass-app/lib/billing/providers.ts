import { nextUtcDay } from "./time";

export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: "anthropic" | "moonshot",
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AnthropicCost {
  utcDay: string;
  model: string;
  amountUsd: number;
  payload: unknown;
}

export interface AnthropicCostReport {
  rows: AnthropicCost[];
  coveredDays: string[];
}

type FetchLike = typeof fetch;
const RETRY_DELAYS_MS =
  process.env.NODE_ENV === "test" ? [0, 0] : [1_000, 3_000];

function finiteAmount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${label} amount from provider.`);
  }
  return value;
}

function finiteSignedAmount(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label} amount from provider.`);
  }
  return value;
}

// Anthropic reports decimal lowest-units (USD cents), not dollars. Parse the
// decimal as integer digits first so "123.45" is exactly 123.45 cents before
// conversion to the schema's USD-major-unit number.
export function parseUsdCentDecimal(value: unknown): number {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Invalid Anthropic cost amount.");
  }
  const [whole, fraction = ""] = value.split(".");
  const digits = BigInt(`${whole}${fraction}`);
  const fractionScale = 10 ** fraction.length;
  return Number(digits) / fractionScale / 100;
}

export function parseAnthropicCostPage(payload: unknown): {
  rows: AnthropicCost[];
  coveredDays: string[];
  hasMore: boolean;
  nextPage: string | null;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Anthropic cost report returned an invalid payload.");
  }
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.data)) {
    throw new Error("Anthropic cost report did not contain data.");
  }
  const rows: AnthropicCost[] = [];
  const coveredDays: string[] = [];
  for (const bucketValue of body.data) {
    const bucket = bucketValue as Record<string, unknown>;
    const startingAt = String(bucket.starting_at ?? "");
    const utcDay = startingAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDay) || !Array.isArray(bucket.results)) {
      throw new Error("Anthropic cost report contained a malformed bucket.");
    }
    coveredDays.push(utcDay);
    for (const resultValue of bucket.results) {
      const result = resultValue as Record<string, unknown>;
      if (result.currency !== "USD") {
        throw new Error(
          `Unsupported Anthropic currency: ${String(result.currency)}`,
        );
      }
      // Non-token costs legitimately have no parsed model dimension. Preserve
      // them as an explicit account-level cost rather than silently dropping
      // money or attributing it to a nearby model.
      const model =
        typeof result.model === "string" && result.model !== ""
          ? result.model
          : "__non_model__";
      rows.push({
        utcDay,
        model,
        amountUsd: parseUsdCentDecimal(result.amount),
        payload: resultValue,
      });
    }
  }
  if (typeof body.has_more !== "boolean") {
    throw new Error("Anthropic cost report omitted boolean has_more.");
  }
  return {
    rows,
    coveredDays,
    hasMore: body.has_more,
    nextPage: typeof body.next_page === "string" ? body.next_page : null,
  };
}

export async function fetchAnthropicCosts(args: {
  from: string;
  toExclusive: string;
  apiKey: string;
  fetchImpl?: FetchLike;
}): Promise<AnthropicCostReport> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const rows: AnthropicCost[] = [];
  const coveredDays = new Set<string>();
  let page: string | null = null;
  const seen = new Set<string>();
  do {
    const url = new URL(
      "https://api.anthropic.com/v1/organizations/cost_report",
    );
    url.searchParams.set("starting_at", `${args.from}T00:00:00Z`);
    url.searchParams.set("ending_at", `${args.toExclusive}T00:00:00Z`);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by[]", "workspace_id");
    url.searchParams.append("group_by[]", "description");
    if (page) url.searchParams.set("page", page);
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetchImpl(url, {
        headers: {
          "anthropic-version": "2023-06-01",
          "x-api-key": args.apiKey,
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok || (response.status !== 429 && response.status < 500))
        break;
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
      }
    }
    if (!response)
      throw new Error("Anthropic cost report returned no response.");
    if (!response.ok) {
      throw new ProviderHttpError(
        "anthropic",
        response.status,
        `Anthropic cost report HTTP ${response.status}.`,
      );
    }
    const parsed = parseAnthropicCostPage(await response.json());
    rows.push(...parsed.rows);
    parsed.coveredDays.forEach((day) => coveredDays.add(day));
    if (!parsed.hasMore) return { rows, coveredDays: [...coveredDays] };
    if (!parsed.nextPage || seen.has(parsed.nextPage)) {
      throw new Error("Anthropic pagination was incomplete.");
    }
    seen.add(parsed.nextPage);
    page = parsed.nextPage;
  } while (page);
  throw new Error("Anthropic pagination ended unexpectedly.");
}

export interface MoonshotBalance {
  balanceUsd: number;
  voucherBalanceUsd: number;
  cashBalanceUsd: number;
  currency: "USD";
  accountScope: string;
  payload: unknown;
}

export function parseMoonshotBalance(payload: unknown): MoonshotBalance {
  if (!payload || typeof payload !== "object") {
    throw new Error("Moonshot balance returned an invalid payload.");
  }
  const body = payload as Record<string, unknown>;
  if (body.code !== 0 || body.status !== true) {
    throw new Error(
      `Moonshot balance envelope was unsuccessful (${String(body.scode ?? body.code)}).`,
    );
  }
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;
  const balance = data.available_balance;
  const voucherBalance = data.voucher_balance;
  const cashBalance = data.cash_balance;
  const accountScope = String(data.user_id ?? data.id ?? "moonshot-account");
  return {
    balanceUsd: finiteSignedAmount(balance, "Moonshot balance"),
    voucherBalanceUsd: finiteAmount(voucherBalance, "Moonshot voucher balance"),
    cashBalanceUsd: finiteSignedAmount(cashBalance, "Moonshot cash balance"),
    currency: "USD",
    accountScope,
    payload,
  };
}

export async function fetchMoonshotBalance(
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<MoonshotBalance> {
  const response = await fetchImpl(
    "https://api.moonshot.ai/v1/users/me/balance",
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new ProviderHttpError(
      "moonshot",
      response.status,
      `Moonshot balance HTTP ${response.status}.`,
    );
  }
  return parseMoonshotBalance(await response.json());
}

export function anthropicRange(days: string[]): {
  from: string;
  toExclusive: string;
} {
  if (days.length === 0) throw new Error("No completed UTC days requested.");
  return { from: days[0], toExclusive: nextUtcDay(days.at(-1)!) };
}
