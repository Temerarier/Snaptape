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
