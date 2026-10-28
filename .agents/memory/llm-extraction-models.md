---
name: LLM extraction model quirks
description: Provider transport constraints and evidence-based interpretation of reasoning-only token exhaustion.
---

- kimi-k3 (Moonshot, OpenAI-compatible `api.moonshot.ai/v1/chat/completions`): reasoning model — thinking tokens count against `max_tokens`; ONLY `temperature: 1` is accepted; responses with images can take 10-30+ min, so streaming SSE is mandatory (Node fetch kills non-streaming responses at the 300 s undici header timeout with a bare "fetch failed"); token usage only arrives when `stream_options: { include_usage: true }` is set.
- claude-fable-5 (Anthropic): rejects the `temperature` parameter entirely ("deprecated for this model"); SDK forces streaming for large `max_tokens` (>10-min potential runs).
- Both accept `max_tokens` ≥ 64k; 32k caused truncated measurement JSON → avoid tight output caps for schema-v1.5 output.
- **Why:** each of these caused a failed extraction run during rollout; symptoms (400s, "fetch failed" at exactly ~300 s, repair-degraded output) look like model quality issues but are transport/params issues.
- **How to apply:** when touching `lib/messung/modelle.ts` or adding models, keep streaming + include_usage + generous output caps, and test a tiny ping per model first.

For claude-opus-5-5, an image measurement at medium effort exhausted a 64k
output budget with only thinking blocks and no text; the response explicitly
reported `max_tokens`. A generous cap does not guarantee a usable response.

**Why:** Earlier empty-text failures lacked saved response metadata and could
not establish their cause. A later authorized run preserved complete usage,
content types and stop reason, proving reasoning-only exhaustion for that run.

**How to apply:** Diagnose each response from saved metadata, not elapsed time.
Do not attribute historical failures without evidence. Lower effort or more
output budget are possible experiments, not proven fixes; extra paid attempts
need authorization and increased budget can increase cost.
