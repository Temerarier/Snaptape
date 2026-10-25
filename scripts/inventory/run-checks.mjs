import { spawn } from "node:child_process";
import { open, writeFile } from "node:fs/promises";
const results = [];
for (const [slug, command] of [
  ["install","CI=true pnpm install --frozen-lockfile"],
  ["typecheck","pnpm typecheck"],
  ["test","pnpm test"],
  ["build","pnpm --filter @workspace/aufmass-app build"],
  ["drizzle-check","pnpm --filter @workspace/db exec drizzle-kit check --config ./drizzle.config.ts"],
]) {
  console.log(`START ${slug}`);
  const started = Date.now();
  const path = `scripts/inventory/${slug}.log`;
  const file = await open(path, "w");
  await file.write(`$ ${command}\n`);
  const child = spawn("bash", ["-c", command], {stdio:["ignore",file.fd,file.fd],env:process.env});
  const code = await new Promise(resolve=>child.on("close",resolve));
  await file.close();
  results.push({slug,command,code,durationMs:Date.now()-started,path});
  await writeFile("scripts/inventory/commands.json", JSON.stringify(results,null,2)+"\n");
  console.log(`END ${slug} exit=${code} durationMs=${Date.now()-started}`);
}
