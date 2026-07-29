// Prompt-Baukasten für die echte Extraktion: liest die Prompt-Texte
// VERBATIM aus docs/pipeline (keine Kopien, keine Umformulierungen),
// injiziert Referenzkatalog + Schema v1.5 und hängt (falls vorhanden)
// das Nutzer-Referenzmaß an. Prompt-Texte werden hier NIE editiert.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type MessRoute = "photo" | "plan" | "mixed";

// Next läuft je nach Start-Art mit cwd=artifacts/aufmass-app oder
// Repo-Root – beide Kandidaten prüfen (wie beim Klassifizierer).
function ladeRepoDatei(relativ: string): string {
  const kandidaten = [
    join(process.cwd(), relativ),
    join(process.cwd(), "..", "..", relativ),
  ];
  for (const pfad of kandidaten) {
    if (existsSync(pfad)) return readFileSync(pfad, "utf8");
  }
  throw new Error(`${relativ} nicht gefunden.`);
}

const PROMPT_DATEI: Record<MessRoute, string> = {
  photo: "docs/pipeline/extract-photo-prompt.md",
  plan: "docs/pipeline/extract-plan-prompt.md",
  mixed: "docs/pipeline/extract-mixed-prompt.md",
};

export interface NutzerReferenz {
  objekt: string;
  wert: number;
  einheit: "mm" | "cm" | "m" | "inch" | "feet";
}

// Referenzmaß in mm umrechnen – erst bei Verwendung (Eingabe bleibt
// unverändert gespeichert).
const MM_PRO_EINHEIT: Record<NutzerReferenz["einheit"], number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
  feet: 304.8,
};

export function referenzInMm(referenz: NutzerReferenz): number {
  return referenz.wert * MM_PRO_EINHEIT[referenz.einheit];
}

// System-Text: Prompt (verbatim) + Referenzkatalog + Schema v1.5 +
// optionales Nutzer-Referenzmaß. Der Katalog ersetzt den Platzhalter
// __REFERENCE_CATALOG__ wo vorhanden, sonst wird er angehängt (der
// Plan-Prompt trägt keinen Platzhalter, braucht den Katalog aber als
// NO-CHAIN-FALLBACK-Tabelle).
export function baueSystemText(
  route: MessRoute,
  referenz: NutzerReferenz | null,
): string {
  const prompt = ladeRepoDatei(PROMPT_DATEI[route]);
  const katalog = ladeRepoDatei("docs/pipeline/reference-catalog.md");
  const schema = ladeRepoDatei("shared/schema/measurement-v1.5.json");

  let system = prompt.includes("__REFERENCE_CATALOG__")
    ? prompt.replace("__REFERENCE_CATALOG__", katalog)
    : `${prompt}\n\nREFERENCE CATALOG (for the scale-fallback rules):\n${katalog}`;

  system += `\n\nSCHEMA (fill exactly this JSON schema):\n${schema}`;

  if (referenz) {
    const mm = Math.round(referenzInMm(referenz) * 10) / 10;
    system +=
      `\n\nUSER REFERENCE: ${referenz.objekt} = ${referenz.wert} ${referenz.einheit}` +
      ` (${mm} mm). Apply the USER REFERENCE RULE: this is the primary scale;` +
      ` emit a references[] entry with scale_type "user_provided" and anchor` +
      ` chains on it with reference_object 'user_provided: ${referenz.objekt}'.`;
  }
  return system;
}

// Repair-Prompt: __SCHEMA_V1_5__ wird laut Laufzeit-Hinweis in der
// Datei durch das Schema ersetzt; der Hinweis-Absatz selbst ist nicht
// Teil des Prompts und wird entfernt.
export function baueRepairSystemText(): string {
  const prompt = ladeRepoDatei("docs/pipeline/repair-prompt.md");
  const schema = ladeRepoDatei("shared/schema/measurement-v1.5.json");
  return prompt
    .replace(/\n\(Runtime note[\s\S]*$/, "\n")
    .replace("__SCHEMA_V1_5__", schema);
}

export const REPAIR_VORTEXT = "Your previous response could not be used. Problem: ";
export const REPAIR_AUSGABE_MARKER = "PREVIOUS OUTPUT:";
export const REPAIR_MAX_ZEICHEN = 150_000;
