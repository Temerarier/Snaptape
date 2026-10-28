// Read-only provider capability check. Never logs request headers or credentials.
import { mkdir, writeFile } from "node:fs/promises";
const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
const headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
let after, models = [], pages = 0;
do {
  const url = new URL("https://api.anthropic.com/v1/models");
  url.searchParams.set("limit", "100");
  if (after) url.searchParams.set("after_id", after);
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Anthropic models endpoint HTTP ${response.status}`);
  const data = await response.json();
  models.push(...data.data.map(model => model.id));
  after = data.has_more ? data.last_id : null;
  if (++pages > 10) throw new Error("Model listing exceeded 10 pages");
} while (after);
let resolvedId = null;
if (!models.includes("claude-sonnet-4-5")) {
  const response = await fetch("https://api.anthropic.com/v1/models/claude-sonnet-4-5", {
    headers, signal: AbortSignal.timeout(30000),
  });
  if (response.ok) resolvedId = (await response.json()).id;
  else if (response.status !== 404) throw new Error(`Model alias check HTTP ${response.status}`);
}
const result = {
  checkedAt: new Date().toISOString(), method: "GET /v1/models, optional GET exact configured alias",
  configuredModel: "claude-sonnet-4-5", listedExact: models.includes("claude-sonnet-4-5"),
  resolvedId, resolvedIdListed: resolvedId !== null && models.includes(resolvedId),
  available: models.includes("claude-sonnet-4-5") || (resolvedId !== null && models.includes(resolvedId)),
  generationCalls: 0, listedSonnetModels: models.filter(id => id.includes("sonnet")),
};
await mkdir("generated-artifacts/trial-readiness", { recursive: true });
await writeFile("generated-artifacts/trial-readiness/classification-model.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
