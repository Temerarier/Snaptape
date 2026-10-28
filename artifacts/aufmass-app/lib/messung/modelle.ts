import Anthropic from "@anthropic-ai/sdk";

export interface BildTeil { marker: string; jpegBase64: string; }
export interface ModellAntwort { text: string; inputTokens: number; outputTokens: number; }
export interface ModellAufruf { system: string; userText: string; bilder: BildTeil[]; }

export const MESS_MODELL = process.env.MESS_MODELL ?? "claude-opus-5-5";
export const MESS_EFFORT = (process.env.MESS_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";

// Official standard pricing checked 2026-10-25: $4 input / $20 output per
// million tokens. This is an estimate, not a provider invoice. Thinking
// tokens are already included in usage.output_tokens.
export function schaetzeKostenUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 4 + outputTokens * 20) / 1_000_000;
}

async function rufeAnthropic(aufruf: ModellAufruf): Promise<ModellAntwort> {
  if (!["low", "medium", "high", "xhigh", "max"].includes(MESS_EFFORT)) throw new Error("Invalid MESS_EFFORT");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: Anthropic.ContentBlockParam[] = [];
  if (aufruf.userText) content.push({ type: "text", text: aufruf.userText });
  for (const bild of aufruf.bilder) {
    content.push({ type: "text", text: bild.marker });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: bild.jpegBase64 } });
  }
  const stream = client.messages.stream({
    model: MESS_MODELL,
    max_tokens: 64_000,
    system: aufruf.system,
    messages: [{ role: "user", content }],
    output_config: { effort: MESS_EFFORT },
  });
  const antwort = await stream.finalMessage();
  const text = antwort.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text) throw new Error("Anthropic API returned no text content.");
  return { text, inputTokens: antwort.usage.input_tokens, outputTokens: antwort.usage.output_tokens };
}

const BACKOFF_MS = [30_000, 60_000];
function istUeberlastung(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  return /\b429\b|overloaded|error (500|502|503|529)\b|terminated|fetch failed/i.test(text);
}

export async function rufeMessModell(aufruf: ModellAufruf): Promise<ModellAntwort> {
  for (const wartezeit of BACKOFF_MS) {
    try { return await rufeAnthropic(aufruf); }
    catch (fehler) {
      if (!istUeberlastung(fehler)) throw fehler;
      await new Promise((resolve) => setTimeout(resolve, wartezeit));
    }
  }
  return rufeAnthropic(aufruf);
}
