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

// kimi-k3 ist ein Reasoning-Modell (Denk-Tokens zählen zur Ausgabe) und
// das Measurement-JSON kann groß werden. 32k hat in Tests zu
// abgeschnittenem JSON geführt, 64k bei der Foto-Route zu komplett
// leerer Antwort (alles im Denken verbraucht) – deshalb für Kimi das
// API-Maximum, für Claude großzügige 64k.
const MAX_AUSGABE_TOKENS_KIMI = 131_072;
const MAX_AUSGABE_TOKENS = 64_000;
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

  // Streaming ist Pflicht: kimi-k3 "denkt" oft länger als 5 Minuten,
  // und Nodes fetch bricht nicht-streamende Antworten nach 300 s
  // Header-Timeout mit "fetch failed" ab.
  const antwort = await fetch(MOONSHOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELL_IDS.standard,
      max_tokens: MAX_AUSGABE_TOKENS_KIMI,
      // kimi-k3 erlaubt AUSSCHLIESSLICH temperature 1 (API-Vorgabe);
      // der Retry setzt daher allein auf frisches stochastisches Sampling.
      temperature: 1,
      stream: true,
      // Ohne include_usage liefert der Stream keine Token-Zahlen.
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: aufruf.system },
        { role: "user", content },
      ],
    }),
    // kimi-k3 kann bei mehreren Fotos sehr lange "denken" – in Tests
    // reichten 30 Minuten nicht immer. Harte Obergrenze: 60 Minuten.
    signal: AbortSignal.timeout(3_600_000),
  });
  if (!antwort.ok || !antwort.body) {
    const koerper = await antwort.text().catch(() => "");
    throw new Error(
      `Moonshot API error ${antwort.status}: ${koerper.slice(0, 500)}`,
    );
  }

  // SSE-Chunks einsammeln: content-Deltas anhängen, usage kommt im
  // letzten Chunk mit.
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let puffer = "";
  const dekodierer = new TextDecoder();
  const leser = antwort.body.getReader();
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    puffer += dekodierer.decode(value, { stream: true });
    const zeilen = puffer.split("\n");
    puffer = zeilen.pop() ?? "";
    for (const zeile of zeilen) {
      const daten = zeile.trim();
      if (!daten.startsWith("data:")) continue;
      const nutzlast = daten.slice(5).trim();
      if (nutzlast === "" || nutzlast === "[DONE]") continue;
      let chunk: {
        choices?: { delta?: { content?: unknown } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        chunk = JSON.parse(nutzlast);
      } catch {
        continue; // unvollständige Zeile – nächster Chunk ergänzt sie
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === "string") text += delta;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }
    }
  }
  if (text.length === 0) {
    throw new Error("Moonshot API returned no text content.");
  }
  return { text, inputTokens, outputTokens };
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
  // Streaming ist bei großen max_tokens Pflicht (SDK erzwingt es für
  // Aufrufe, die länger als 10 Minuten laufen könnten).
  const stream = client.messages.stream({
    model: MODELL_IDS.premium,
    max_tokens: MAX_AUSGABE_TOKENS,
    // claude-fable-5 lehnt den temperature-Parameter ab ("deprecated
    // for this model") – Retry setzt auf frisches Sampling.
    system: aufruf.system,
    messages: [{ role: "user", content }],
  });
  const antwort = await stream.finalMessage();
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

// Transport-Backoff: 429/Overload/5xx heißt "Anfrage kam nie beim
// Modell an" – kurzes Warten und neu senden ist KEIN zusätzlicher
// Extraktions-/Retry-/Repair-Aufruf im Sinne der Pipeline-Regeln.
const BACKOFF_MS = [30_000, 60_000];

function istUeberlastung(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  return (
    /\b429\b/.test(text) ||
    /overloaded/i.test(text) ||
    /error (500|502|503|529)\b/.test(text) ||
    // Verbindungsabbrüche mitten im Stream ("terminated") bzw. vor der
    // Antwort ("fetch failed") – beobachtet bei Moonshot unter Last.
    /terminated/i.test(text) ||
    /fetch failed/i.test(text)
  );
}

export async function rufeExtraktionsModell(
  quality: Qualitaet,
  aufruf: ModellAufruf,
): Promise<ModellAntwort> {
  const rufe = () =>
    quality === "standard" ? rufeKimi(aufruf) : rufeFable(aufruf);
  for (const wartezeit of BACKOFF_MS) {
    try {
      return await rufe();
    } catch (fehler) {
      if (!istUeberlastung(fehler)) throw fehler;
      await new Promise((aufloesen) => setTimeout(aufloesen, wartezeit));
    }
  }
  return rufe();
}
