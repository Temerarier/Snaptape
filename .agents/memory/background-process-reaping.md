---
name: Background processes die with the shell
description: How to run long-running dev jobs (multi-minute LLM test runs) in this workspace.
---

- Processes launched from shell commands (even with `nohup`, `setsid`, `disown`, `</dev/null`) are reaped shortly after the shell command returns — long background test runs silently disappear.
- **Why:** repeated attempts to run 5-30 min extraction test runs in the background all died; only work hosted inside a long-lived managed process survives.
- **How to apply:** for long dev jobs, add a dev-only Next route (NOT under `/api/*` — proxy trap) that kicks off the work fire-and-forget inside the dev-server process, and poll results via the database. Example: `app/dev/extraktion-test/route.ts` in the aufmass-app.
