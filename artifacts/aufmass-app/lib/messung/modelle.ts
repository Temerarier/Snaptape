import Anthropic from "@anthropic-ai/sdk";
import type { ModelResponseDiagnostic } from "@workspace/db";

export interface BildTeil { marker: string; jpegBase64: string; }
type AntwortDiagnose = Omit<ModelResponseDiagnostic, "phase">;
export interface ModellAntwort { text: string; inputTokens: number; outputTokens: number; diagnostic: AntwortDiagnose; }
export interface ModellAufruf { system: string; userText: string; bilder: BildTeil[]; }
export interface ModellOptionen {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export class ModellAntwortFehler extends Error {
  constructor(message: string, public readonly diagnostic: AntwortDiagnose) {
    super(message);
    this.name = "ModellAntwortFehler";
  }
}

export const MESS_MODELL = process.env.MESS_MODELL ?? "claude-opus-5-5";
export const MESS_EFFORT = (process.env.MESS_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";
// Opus 5.5 Messages API maximum; thinking and answer share this budget.
// https://platform.claude.com/docs/en/models/opus-5-5/overview (2026-10-28)
export const MESS_MAX_TOKENS = 128_000;

// Official standard pricing checked 2026-10-25: $4 input / $20 output per
// million tokens. This is an estimate, not a provider invoice. Thinking
// tokens are already included in usage.output_tokens.
export function schaetzeKostenUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 4 + outputTokens * 20) / 1_000_000;
}

async function rufeAnthropic(aufruf: ModellAufruf, optionen: ModellOptionen = {}): Promise<ModellAntwort> {
  const model = optionen.model ?? MESS_MODELL;
  const effort = optionen.effort ?? MESS_EFFORT;
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) throw new Error("Invalid model effort");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: Anthropic.ContentBlockParam[] = [];
  if (aufruf.userText) content.push({ type: "text", text: aufruf.userText });
  for (const bild of aufruf.bilder) {
    content.push({ type: "text", text: bild.marker });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: bild.jpegBase64 } });
  }
  const stream = client.messages.stream({
    model,
    max_tokens: MESS_MAX_TOKENS,
    system: aufruf.system,
    messages: [{ role: "user", content }],
    output_config: { effort },
  });
  const antwort = await stream.finalMessage();
  const diagnostic: AntwortDiagnose = {
    responseId: antwort.id,
    model: antwort.model,
    stopReason: antwort.stop_reason,
    contentTypes: antwort.content.map((block) => block.type),
    inputTokens: antwort.usage.input_tokens,
    outputTokens: antwort.usage.output_tokens,
    cacheReadInputTokens: antwort.usage.cache_read_input_tokens ?? null,
    cacheCreationInputTokens: antwort.usage.cache_creation_input_tokens ?? null,
  };
  const text = antwort.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text) throw new ModellAntwortFehler("Anthropic API returned no text content.", diagnostic);
  return { text, inputTokens: antwort.usage.input_tokens, outputTokens: antwort.usage.output_tokens, diagnostic };
}

const BACKOFF_MS = [30_000, 60_000];
function istUeberlastung(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  return /\b429\b|overloaded|error (500|502|503|529)\b|terminated|fetch failed/i.test(text);
}

export async function rufeMessModell(aufruf: ModellAufruf, optionen: ModellOptionen = {}): Promise<ModellAntwort> {
  for (const wartezeit of BACKOFF_MS) {
    try { return await rufeAnthropic(aufruf, optionen); }
    catch (fehler) {
      if (!istUeberlastung(fehler)) throw fehler;
      await new Promise((resolve) => setTimeout(resolve, wartezeit));
    }
  }
  return rufeAnthropic(aufruf, optionen);
}
