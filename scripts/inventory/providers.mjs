// Credential values are consumed in-process and never logged or written.
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../artifacts/aufmass-app/package.json", import.meta.url));
const clean = value => {
  let s = String(value);
  for (const key of ["ANTHROPIC_API_KEY","KIMI_API_KEY","ANTHROPIC_ADMIN_KEY","DATABASE_URL","SESSION_SECRET"])
    if (process.env[key]) s = s.replaceAll(process.env[key], "[REDACTED]");
  return s.slice(0, 3000);
};
const evidence = { checkedAt: new Date().toISOString(), env: {}, anthropic: {}, moonshot: {}, storage: {} };
for (const key of ["DATABASE_URL","ANTHROPIC_API_KEY","KIMI_API_KEY","ANTHROPIC_ADMIN_KEY","DEFAULT_OBJECT_STORAGE_BUCKET_ID","PRIVATE_OBJECT_DIR","STAFF_EMAILS","SESSION_SECRET","EXTRAKTOR_STUB","EXTRAKTOR_STUB_KAPUTT","REPLIT_DEPLOYMENT"])
  evidence.env[key] = process.env[key] ? "SET" : "MISSING";
try {
  const ids = [];
  let after = "";
  for (let page = 0; page < 8; page++) {
    const r = await fetch(`https://api.anthropic.com/v1/models?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ""}`, {
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version":"2023-06-01" },
      signal: AbortSignal.timeout(45000)
    });
    evidence.anthropic.httpStatus = r.status;
    const data = await r.json();
    if (!r.ok) { evidence.anthropic.error = clean(JSON.stringify(data)); break; }
    ids.push(...(data.data ?? []).map(m => m.id));
    if (!data.has_more) break;
    after = data.last_id;
  }
  evidence.anthropic.modelIds = ids;
  evidence.anthropic.requested = Object.fromEntries(["claude-fable-5","claude-opus-5-5","claude-sonnet-5-5","claude-haiku-5-5"].map(id => [id, ids.includes(id) ? "LISTED" : "NOT_LISTED"]));
  evidence.anthropic.balance = "No balance assertion possible from models listing alone; no paid Anthropic message sent.";
} catch (e) { evidence.anthropic.error = clean(e.message); }
try {
  const r = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method:"POST",
    headers:{Authorization:`Bearer ${process.env.KIMI_API_KEY ?? ""}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"kimi-k3",max_tokens:5,temperature:1,stream:true,stream_options:{include_usage:true},messages:[{role:"user",content:"Reply OK."}]}),
    signal:AbortSignal.timeout(120000)
  });
  evidence.moonshot.httpStatus = r.status;
  if (!r.ok) evidence.moonshot.error = clean(await r.text());
  else {
    const stream = await r.text();
    const events = stream.split("\n").filter(s=>s.startsWith("data: ") && s!=="data: [DONE]").flatMap(s=>{try{return [JSON.parse(s.slice(6))];}catch{return [];}});
    evidence.moonshot.usage = events.findLast(e=>e.usage)?.usage ?? null;
    evidence.moonshot.finishReasons = [...new Set(events.flatMap(e=>(e.choices ?? []).map(c=>c.finish_reason).filter(Boolean)))];
    evidence.moonshot.result = "HTTP success; five-token cap may be consumed by reasoning, not visible text.";
  }
} catch (e) { evidence.moonshot.error = clean(e.message); }
try {
  const { Storage } = require("@google-cloud/storage");
  // Same workload-identity endpoint and credential shape as product objectStorage.ts.
  const objectStorage = new Storage({
    credentials:{subject_token_type:"access_token",type:"external_account",audience:"replit",token_url:"http://127.0.0.1:1106/token",credential_source:{url:"http://127.0.0.1:1106/credential",format:{type:"json",subject_token_field_name:"access_token"}},universe_domain:"googleapis.com"},
    projectId:""
  });
  const path = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\/+/, "");
  const slash = path.indexOf("/");
  if (slash < 1) throw Error("PRIVATE_OBJECT_DIR missing or not bucket/prefix");
  const [files] = await objectStorage.bucket(path.slice(0,slash)).getFiles({prefix:path.slice(slash+1)+"/",maxResults:5,autoPaginate:false});
  evidence.storage = { result:"PRIVATE_PREFIX_LIST_OK", sampledObjects:files.length, objectNames:"Not recorded" };
} catch (e) { evidence.storage = {result:"ERROR",error:clean(e.message)}; }
await writeFile("scripts/inventory/providers.json", JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
