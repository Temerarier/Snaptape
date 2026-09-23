// Read-only workspace guard for this analysis task. Ignores allowed deliverables.
import { execFileSync } from "node:child_process";
const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" });
const lines = status.trimEnd().split("\n").filter(Boolean);
const allowed = /^(scripts\/diagnose\/|docs\/diagnose\/2026-09-23\/|docs\/viewer-diagnose-2026-09-23\.md$)/;
const outside = lines.filter(line => !allowed.test(line.slice(3)));
console.log(JSON.stringify({ changedFiles: lines.length, outsideAllowedPaths: outside }, null, 2));
if (outside.length) process.exitCode = 1;