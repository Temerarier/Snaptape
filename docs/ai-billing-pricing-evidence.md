# AI billing and pricing evidence

Accessed **2026-09-23 (UTC)**. Only public documentation was searched and fetched; no authenticated API calls were made.

## Exact model prices

All prices below are the vendors' public API list prices, not marketplace prices.

### Anthropic `claude-fable-5`

Anthropic marks this exact model ID active but legacy and recommends `claude-fable-5-1`. Prices are USD per 1,000,000 tokens:

| Meter | Standard, global | Batch, global |
| --- | ---: | ---: |
| Uncached/base input | $10.00 | $5.00 |
| Output | $50.00 | $25.00 |
| 5-minute cache write | $12.50 | $6.25 |
| 1-hour cache write | $20.00 | $10.00 |
| Cache hit/refresh | $1.00 | $0.50 |

US-only inference is 1.1x: standard input/output/5m-write/1h-write/cache-read are respectively $11.00/$55.00/$13.75/$22.00/$1.10 per MTok. The public model page also states that Batch API gives a 50% input/output discount.

Official evidence:

- [Claude Fable 5 model overview](https://platform.claude.com/docs/en/models/fable-5/overview) — exact model ID, active/legacy status, base/cache/output prices and batch discount.
- [Claude Platform pricing](https://platform.claude.com/docs/en/about-claude/pricing) — full standard and batch price tables.
- [Anthropic Fable product page](https://www.anthropic.com/claude/fable) — current successor context; the page now leads with Fable 5.1, so it must not be used to assign Fable 5.1's $0.25 cache-read price to Fable 5.

### Moonshot/Kimi `kimi-k3`

Prices are USD per 1,000,000 tokens; 1M is explicitly defined as 1,000,000:

| Meter | Price |
| --- | ---: |
| Uncached input | $3.00 |
| Output | $15.00 |
| Cached input | $0.30 |
| 5-minute cache write | $3.00 |
| 1-hour cache write | $6.00 |

Context window: 1,048,576 tokens. Cache writes default to the 5-minute tier when no TTL is specified. A cache hit refreshes the cache lifetime with no additional cache-write charge. Listed prices exclude applicable taxes.

Official evidence:

- [Kimi K3 pricing](https://platform.moonshot.ai/docs/pricing/chat-k3) — exact model row, units, cache behavior and tax qualification. The documentation currently redirects to the Kimi platform documentation.
- [Kimi model list](https://platform.moonshot.ai/docs/models) — exact `kimi-k3` model ID and current model status.

## Anthropic Cost Report API

Official references:

- [Get Cost Report API reference](https://platform.claude.com/docs/en/api/admin/cost_report/retrieve)
- [Usage and Cost API guide](https://platform.claude.com/docs/en/manage-claude/usage-cost-api)

### Request and grouping

- `GET https://api.anthropic.com/v1/organizations/cost_report`
- Requires an Admin API credential; this research did not call it.
- `starting_at` is required. `ending_at` is optional. Timestamps are RFC 3339; buckets snap to UTC day boundaries.
- Cost reports support only `bucket_width=1d`.
- The documented `group_by[]` values are `workspace_id` and `description`, in any subset.
- Grouping by `description` exposes parsed dimensions in each result, including model, token type, service tier, context window, inference geography, and cost type. These are not documented as independent cost-report `group_by[]` request values.
- Without the relevant grouping, dimension fields are `null`; non-token costs also leave token/model dimensions `null`.
- Priority Tier costs are explicitly not available in the cost endpoint. Priority usage must be observed through the usage endpoint, so the Cost Report alone is not a complete invoice estimator for organizations using Priority Tier.

### Pagination

- `limit` counts **time buckets**, not result rows: default 7, minimum 1, maximum 31.
- Returned buckets are oldest first and include zero-cost intervals with an empty `results` array.
- If `has_more` is `true`, send the opaque `next_page` value unchanged as the next request's `page`.
- Continue until `has_more` is `false`; then `next_page` is `null`.
- Preserve all original filters and time bounds on every page. Do not advance dates manually based on the last row.

### Units

- `amount` is a decimal string in the currency's **lowest unit**. For USD it is cents: `"123.45"` means **$1.2345**, not $123.45.
- `currency` is currently always `"USD"`.
- Parse `amount` with a decimal/fixed-point library. Sum in cents as arbitrary-precision decimals, then divide by 100 only for dollar display/storage where the schema expects major units.

### Freshness and finality

- Anthropic says usage and cost data **typically appears within five minutes** after request completion, but delays can be longer.
- The public documentation provides **no finality watermark, immutable-after time, invoice-close flag, or guaranteed maximum delay**.
- Therefore, a completed daily page is not evidence that the day is final. Treat recent buckets as provisional, re-fetch an overlapping trailing window, and upsert by bucket plus all returned grouping dimensions. Invoice reconciliation remains the final authority.

## Moonshot balance API

Official reference: [Check Balance](https://platform.moonshot.ai/docs/api/balance)

- `GET https://api.moonshot.ai/v1/users/me/balance`
- Bearer authentication is required; this research did not call it.
- Success envelope fields:
  - `code` (integer; `0` means success)
  - `status` (boolean)
  - `scode` (string)
  - `data` (object)
- Balance fields are JSON numbers, all documented in **USD**:
  - `data.available_balance`: spendable balance; inference is blocked at `<= 0`
  - `data.voucher_balance`: voucher balance; cannot be negative
  - `data.cash_balance`: cash balance; may be negative
- When cash is negative, the docs say `available_balance` equals `voucher_balance`; do not assume it always equals `cash_balance + voucher_balance`.
- At non-positive available balance, inference calls return `exceeded_current_quota_error`.
- Keys issued by different Kimi platform domains are independent; use the API host matching the platform that issued the key.

Implementation: validate both the HTTP status and success envelope, parse balance numbers into decimal values immediately, persist currency as USD, and store all three balances rather than deriving one from the others.

## Verification boundaries and blockers

- **No blocker for identifying either exact model:** both `claude-fable-5` and `kimi-k3` appear in current official model/pricing documentation, so their public list prices above are directly verifiable.
- Account-specific model entitlement, negotiated discounts, credits, taxes, marketplace markup, actual Cost Report payloads, and actual Moonshot balances are **not verifiable without authenticated/account records**.
- Anthropic publishes latency guidance but no documented finality guarantee; exact daily-final timing is therefore **unverifiable from the public API contract**.
- Moonshot's balance response reports current USD balances but is not a transaction ledger or daily cost report; it cannot by itself prove daily spend.

## Urgent API implementation guidance

1. Keep model rates keyed by exact model ID and meter; never alias Fable 5 to Fable 5.1 because their cache-read rates differ.
2. For Anthropic authoritative cost ingestion, query UTC daily buckets grouped by both `workspace_id` and `description`, exhaust cursor pagination, parse cent strings exactly, and re-fetch a trailing overlap before invoice reconciliation.
3. Mark Anthropic daily totals `provisional`; do not invent a finality cutoff. Separately account for Priority Tier because it is absent from the Cost Report.
4. Treat Moonshot balance as a USD account snapshot/health signal, not usage. Store vendor timestamps from the poll plus all envelope and balance fields, and never infer spend from a single snapshot.
5. Fail visibly on unknown model IDs, currencies, meter descriptions, malformed decimal values, or unsuccessful vendor envelopes rather than silently applying a nearby model's price.