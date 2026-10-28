---
name: Live measurement verification
description: Isolate paid measurement acceptance from builds and preserve interrupted-run evidence.
---

Complete builds before starting a paid acceptance measurement. While it runs,
avoid resource-heavy verification jobs and workflow restarts; monitor database
state read-only instead.

**Why:** A workspace restart during concurrent build verification destroyed a
live model stream and temporary logs. The restart's cause was not established.
Tokens and provider cost could not be recovered, even though the committed
credit debit could be safely refunded.

**How to apply:** Preserve the interrupted-run record with unknown usage rather
than inventing zero cost or overwriting it with a retry. A fresh paid run beyond
the authorized count needs explicit user permission. Treat preflight
classification as asynchronous: a few seconds in files_uploaded does not prove
that Start is stuck.

Do not infer an empty model response's cause from elapsed time or the absence of
text alone, and do not tune effort/token limits without response evidence.

**Why:** A completed request produced no usable text, but its discarded metadata
made the actual stop reason unknowable. This did not establish zero provider cost,
token exhaustion or a prompt/schema defect.

**How to apply:** Distinguish complete response usage from unknown totals after
transport interruption. Keep earlier known response usage as partial evidence,
not as a complete bill. Simulated failure tests establish observability, not that
a real measurement now succeeds.
