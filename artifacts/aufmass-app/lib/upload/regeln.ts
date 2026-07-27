// Reine Upload-Regeln (Etappe 1) – ohne Node- oder DB-Importe, damit
// Client (Sofort-Feedback) und Server (verbindliche Prüfung) exakt
// dieselbe Logik verwenden. Grenzen laut docs/plan.md: max. 10 Dateien
// pro Projekt, max. 25 MB pro Datei, Fotos (jpg/png/heic) und Plan-PDFs.

export const MAX_DATEIEN_PRO_PROJEKT = 10;
export const MAX_DATEI_BYTES = 25 * 1024 * 1024; // 25 MB

export type DateiArt = "photo" | "pdf";
export type AblehnungsGrund = "typ" | "zu_gross" | "zu_viele";

export interface NeueDatei {
  name: string;
  sizeBytes: number;
}

export interface GeprüfteDatei extends NeueDatei {
  art: DateiArt;
}

export interface Ablehnung {
  name: string;
  grund: AblehnungsGrund;
}

const FOTO_ENDUNGEN = new Set(["jpg", "jpeg", "png", "heic"]);

function endung(name: string): string {
  const punkt = name.lastIndexOf(".");
  if (punkt < 0) return "";
  return name.slice(punkt + 1).toLowerCase();
}

// Dateiart anhand der Endung (der Client-MIME ist nicht verlässlich –
// HEIC meldet je nach Browser einen leeren Typ).
export function dateiArt(name: string): DateiArt | null {
  const e = endung(name);
  if (e === "pdf") return "pdf";
  if (FOTO_ENDUNGEN.has(e)) return "photo";
  return null;
}

// Serverseitig abgeleiteter MIME-Typ (Client-Angabe wird nicht übernommen).
export function mimeFuerName(name: string): string {
  switch (endung(name)) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

// Prüft neue Dateien gegen Art, Größe und freie Plätze. Reihenfolge der
// Gründe pro Datei: erst Typ, dann Größe, dann Anzahl – so bekommt die
// 11. Datei nur dann "zu_viele", wenn sie ansonsten gültig wäre.
export function pruefeNeueDateien(
  vorhandeneAnzahl: number,
  dateien: NeueDatei[],
): { akzeptiert: GeprüfteDatei[]; abgelehnt: Ablehnung[] } {
  const akzeptiert: GeprüfteDatei[] = [];
  const abgelehnt: Ablehnung[] = [];
  let freiePlaetze = Math.max(0, MAX_DATEIEN_PRO_PROJEKT - vorhandeneAnzahl);

  for (const datei of dateien) {
    const art = dateiArt(datei.name);
    if (art === null) {
      abgelehnt.push({ name: datei.name, grund: "typ" });
      continue;
    }
    if (datei.sizeBytes > MAX_DATEI_BYTES) {
      abgelehnt.push({ name: datei.name, grund: "zu_gross" });
      continue;
    }
    if (freiePlaetze <= 0) {
      abgelehnt.push({ name: datei.name, grund: "zu_viele" });
      continue;
    }
    freiePlaetze -= 1;
    akzeptiert.push({ ...datei, art });
  }

  return { akzeptiert, abgelehnt };
}
