## Overview

Claude Opus 5.5 is built for long-running agentic coding and knowledge work, priced at $4 / $20 USD per million input / output tokens. Four breaking changes affect code already running on Claude Opus 5: [thinking can't be disabled](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#thinking-cant-be-disabled), [forced tool use returns an error](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#forced-tool-use-is-not-supported), [thinking blocks are tied to the model and the conversation](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#thinking-blocks-are-tied-to-the-model-that-produced-them), and, on the Claude API and Claude Models on Google Cloud (Google managed), [the earlier `computer_20251124` computer use tool is not accepted](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#computer-20251124-is-not-supported). The first three also apply on Claude Fable 5.1. A further change alters the response shape without failing any request: [text between tool calls comes back in `thinking` blocks](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#text-between-tool-calls) whose text is empty at the default `display` setting. An application that streams that text to its users as progress updates goes quiet between tool calls until it sets a `display` value that returns the text.

[What's new in Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5)

## How it compares

| Model | Context | Max output | Price / MTok | Latency | Thinking | Default effort | Knowledge cutoff |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Claude Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview) | 1M | 128K | $10 / $50 | Slower | Adaptive (always on) | `high` | Jun 2026 |
| Claude Opus 5.5This model | 1M | 128K | $4 / $20 | Moderate | Adaptive (always on) | `medium` | Jun 2026 |
| [Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) | 1M | 128K | $2 / $10 | Fast | Adaptive | `high` | Jun 2026 |
| [Claude Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview) | 1M | 128K | From $0.10 / $0.50 | Fastest | Adaptive | `medium` | Jun 2026 |

## Specifications

### Model IDs

Claude APIclaude-opus-5-5

[Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock)anthropic.claude-opus-5-5

[Claude Models on Google Cloud (Google managed)](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed)claude-opus-5-5

[Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)claude-opus-5-5

[Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)claude-opus-5-5

[Claude Models on Google Cloud (Anthropic managed)](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/anthropic-managed)claude-opus-5-5

### Pricing

Input$4 / MTok

Output$20 / MTok

[5m cache write](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)$5 / MTok

[1h cache write](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)$8 / MTok

[Cache read](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)$0.20 / MTok

[Batch API](https://platform.claude.com/docs/en/build-with-claude/batch-processing)50% discount on input and output

[Full price list](https://platform.claude.com/docs/en/about-claude/pricing)

### Capabilities

[Context window](https://platform.claude.com/docs/en/build-with-claude/context-windows)1M tokens

Max output128K tokens

[Max output (Batch API, beta)](https://platform.claude.com/docs/en/build-with-claude/batch-processing#extended-output-beta)300K tokens

[Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)Adaptive (always on)

[Default effort](https://platform.claude.com/docs/en/build-with-claude/effort)`medium`

Comparative latencyModerate

Input → outputText and images → text

Reliable knowledge cutoffJun 2026

Training data cutoffJun 2026

### Availability

[Status](https://platform.claude.com/docs/en/about-claude/model-deprecations)Active (latest)

ReleasedSeptember 22, 2026

RetirementNot sooner than September 22, 2027

PlatformsClaude API [Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) [Claude Models on Google Cloud (Google managed)](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed) [Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry) [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws) [Claude Models on Google Cloud (Anthropic managed)](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/anthropic-managed)

## Good to know

- Adaptive thinking is always on and can't be turned off. Control thinking depth with the [effort parameter](https://platform.claude.com/docs/en/build-with-claude/effort).
- On the [Message Batches API](https://platform.claude.com/docs/en/build-with-claude/batch-processing#extended-output-beta), Claude Opus 5.5 supports up to 300k output tokens with the `output-300k-2026-03-24` beta header.
- The minimum cacheable prompt length is 512 tokens. See [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#cache-limitations).
- Query limits and capabilities programmatically with the [Models API](https://platform.claude.com/docs/en/api/models/list).

## Resources



[Prompting Claude Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)

Behavioral differences and prompting patterns specific to Claude Opus 5.5.



[Effort](https://platform.claude.com/docs/en/build-with-claude/effort)

The control for thinking depth, latency, and cost. Choose a level for each workload.



[Adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)

How adaptive thinking works and how thinking blocks are preserved.



[Fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode)

Lower-latency Claude Opus 5.5 on the Claude API, priced separately.

## Reference



[System prompt](https://platform.claude.com/docs/en/release-notes/system-prompts/claude-opus-5-5)

The system prompt Claude Opus 5.5 uses on claude.ai and the Claude apps.



[System card](https://www.anthropic.com/claude-opus-5-5-system-card) 

Safety evaluations and deployment decisions for Claude Opus 5.5.

[Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

Full price list, including batch discounts and prompt caching rates.

[Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)

How model IDs, aliases, and pinned snapshots work.



[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

Lifecycle status and retirement commitments for every Claude model.

Was this page helpful?



Ask Docs