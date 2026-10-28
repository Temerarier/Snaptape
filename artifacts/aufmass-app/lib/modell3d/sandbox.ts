import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import ivm from "isolated-vm";
import type { Model3dData } from "@workspace/db";
import { repoPfad } from "./prompts";

export function leeresModell(fehler: string): Model3dData {
  return {
    flaechen: [], oeffnungen: [], anbauten: [], deko: [], kanten: [],
    fallrohre: [], schaeden: [], ergaenzt: [], konflikte: [], nicht_gebaut: [],
    fehler: [fehler], hinweise: [],
  };
}
// A copied JSON result is still untrusted. Bound host-side checker work before
// calling the fixed core, including its quadratic per-ID extent calculations.
export function validiereSandboxJson(value: unknown): Model3dData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Sandbox-Ausgabe");
  const v = value as Record<string, unknown>;
  const keys = Object.keys(leeresModell(""));
  for (const key of keys) {
    if (!Array.isArray(v[key]) || v[key].length > 2000) throw new Error("Ungültige Sandbox-Ausgabe");
  }
  for (const key of ["fehler", "hinweise"]) {
    if (!(v[key] as unknown[]).every(x => typeof x === "string")) throw new Error("Ungültige Sandbox-Ausgabe");
  }
  const counts = new Map<string, number>();
  let total = 0;
  const point = (p: unknown) => {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(x => typeof x === "number" && Number.isFinite(x))) throw new Error("Ungültige Sandbox-Geometrie");
  };
  const polygon = (p: unknown, id: string) => {
    if (!Array.isArray(p) || p.length < 3 || p.length > 512) throw new Error("Ungültige Sandbox-Geometrie");
    p.forEach(point);
    total += p.length;
    const count = (counts.get(id) ?? 0) + p.length;
    counts.set(id, count);
    if (count > 512 || total > 20000) throw new Error("Sandbox-Geometrie überschreitet Sicherheitslimit");
  };
  for (const key of keys.filter(k => !["fehler", "hinweise"].includes(k))) {
    for (const item of v[key] as unknown[]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Ungültige Sandbox-Ausgabe");
      const entry = item as Record<string, unknown>;
      if ("id_1_7" in entry && (typeof entry.id_1_7 !== "string" || ["__proto__", "constructor", "prototype", "toString"].includes(entry.id_1_7))) throw new Error("Ungültige Sandbox-ID");
      const id = String(entry.id_1_7 ?? "decoration");
      if (["flaechen", "oeffnungen", "schaeden"].includes(key)) polygon(entry.ecken, id);
      if (["anbauten", "deko"].includes(key)) {
        if (!Array.isArray(entry.flaechen) || entry.flaechen.length > 512) throw new Error("Ungültige Sandbox-Geometrie");
        entry.flaechen.forEach(p => polygon(p, id));
      }
      if (key === "kanten") { point(entry.von); point(entry.bis); }
      if (key === "fallrohre") { point(entry.oben); point(entry.unten); }
    }
  }
  // Explicit root allowlist. No code/executable objects can cross JSON.parse.
  return Object.fromEntries([...keys, "format", "version", "einheit", "laufzeit_ms"]
    .filter(k => Object.hasOwn(v, k)).map(k => [k, v[k]])) as unknown as Model3dData;
}
export async function fuehreSandboxAus(mess: Record<string, unknown>, code: string): Promise<{ result: Model3dData; sandboxMs: number }> {
  if (!ivm.Isolate) throw new Error("isolated-vm nicht verfügbar");
  const start = Date.now();
  const source = readFileSync(repoPfad("artifacts/aufmass-app/lib/modell3d/core.js"), "utf8");
  const worker = repoPfad("artifacts/aufmass-app/lib/modell3d/sandbox-worker.cjs");
  return new Promise(resolve => {
    const child = execFile(process.execPath, [worker], {
      env: { PATH: process.env.PATH, NODE_ENV: "production" }, encoding: "utf8",
      timeout: 10000, killSignal: "SIGKILL",
      maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      const sandboxMs = Date.now() - start;
      const fail = (text: string) => resolve({ result: leeresModell(text), sandboxMs });
      if (error) {
        if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return fail("Sandbox-Ausgabe überschreitet Sicherheitslimit");
        if (error.killed) return fail("Zeitlimit von 8 s überschritten");
        if (/memory|heap|allocation/i.test(stderr) || error.signal === "SIGABRT") return fail("Speicherlimit überschritten");
        return fail("Sandbox-Prozess fehlgeschlagen");
      }
      try {
        const reply = JSON.parse(stdout);
        if (reply.kind === "timeout") return fail("Zeitlimit von 8 s überschritten");
        if (reply.kind === "memory") return fail("Speicherlimit überschritten");
        if (reply.kind || typeof reply.result !== "string") return fail("Sandbox-Ausführung fehlgeschlagen");
        resolve({ result: validiereSandboxJson(JSON.parse(reply.result)), sandboxMs: reply.sandboxMs });
      } catch (e) { fail(e instanceof Error ? e.message : "Ungültige Sandbox-Ausgabe"); }
    });
    child.stdin!.on("error", () => undefined); // A timeout/OOM may close stdin.
    child.stdin!.end(JSON.stringify({ source, mess: JSON.stringify(mess), code }));
  });
}
