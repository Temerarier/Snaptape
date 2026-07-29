// Modell-Clients der Extraktion: "standard" → kimi-k3 (Moonshot API,
// OpenAI-kompatibel), "premium" → claude-fable-5 (Anthropic API).
// Beide bekommen Bilder als base64-JPEGs mit Text-Marker davor.
// Fehler werfen explizit – kein stiller Fallback aufs andere Modell.
import Anthropic from "@anthropic-ai/sdk";

export interface BildTeil {
  marker: string; // z. B. "photo 3" / "grundriss.pdf, page 2/5"
  jpegBase64: string;
}

export interface ModellAntwort {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModellAufruf {
  system: string;
  // Text-Blöcke (z. B. TRIAGE FACTS, Repair-Nachricht) vor den Bildern.
  userText: string;
  bilder: BildTeil[];
  temperature: number;
}

export const MODELL_IDS = {
  standard: "kimi-k3",
  premium: "claude-fable-5",
} as const;

export type Qualitaet = keyof typeof MODELL_IDS;

// Grobe Preisliste in USD pro 1M Tokens für die Kostenschätzung im
// Admin-Protokoll (Schätzwert, keine Abrechnungsgrundlage).
const PREISE_USD_PRO_MTOK: Record<
  Qualitaet,
  { input: number; output: number }
> = {
  standard: { input: 0.6, output: 2.5 },
  premium: { input: 3, output: 15 },
};

export function schaetzeKostenUsd(
  quality: Qualitaet,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PREISE_USD_PRO_MTOK[quality];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

const MAX_AUSGABE_TOKENS = 16_384;
const MOONSHOT_URL = "https://api.moonshot.ai/v1/chat/completions";

async function rufeKimi(aufruf: ModellAufruf): Promise<ModellAntwort> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("KIMI_API_KEY ist nicht gesetzt.");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  if (aufruf.userText) content.push({ type: "text", text: aufruf.userText });
  for (const bild of aufruf.bilder) {
    content.push({ type: "text", text: bild.marker });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${bild.jpegBase64}` },
    });
  }

  const antwort = await fetch(MOONSHOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELL_IDS.standard,
      max_tokens: MAX_AUSGABE_TOKENS,
      temperature: aufruf.temperature,
      messages: [
        { role: "system", content: aufruf.system },
        { role: "user", content },
      ],
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!antwort.ok) {
    const koerper = await antwort.text().catch(() => "");
    throw new Error(
      `Moonshot API error ${antwort.status}: ${koerper.slice(0, 500)}`,
    );
  }
  const json = (await antwort.json()) as {
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Moonshot API returned no text content.");
  }
  return {
    text,
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

async function rufeFable(aufruf: ModellAufruf): Promise<ModellAntwort> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: Anthropic.ContentBlockParam[] = [];
  if (aufruf.userText) content.push({ type: "text", text: aufruf.userText });
  for (const bild of aufruf.bilder) {
    content.push({ type: "text", text: bild.marker });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: bild.jpegBase64,
      },
    });
  }
  const antwort = await client.messages.create({
    model: MODELL_IDS.premium,
    max_tokens: MAX_AUSGABE_TOKENS,
    temperature: aufruf.temperature,
    system: aufruf.system,
    messages: [{ role: "user", content }],
  });
  const textBlock = antwort.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text" || textBlock.text.length === 0) {
    throw new Error("Anthropic API returned no text content.");
  }
  return {
    text: textBlock.text,
    inputTokens: antwort.usage.input_tokens,
    outputTokens: antwort.usage.output_tokens,
  };
}

export async function rufeExtraktionsModell(
  quality: Qualitaet,
  aufruf: ModellAufruf,
): Promise<ModellAntwort> {
  return quality === "standard" ? rufeKimi(aufruf) : rufeFable(aufruf);
}
