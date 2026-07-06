// Anzeige-Formatierung (Eiserne Regel 1): intern bleiben alle Werte
// ungerundete mm/mm² – gerundet wird ausschließlich hier für die Anzeige.
const ganzzahl = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

const zweiNachkommastellen = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const rohZahl = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 6,
});

// Auf ganze Zentimeter gerundet (nur Anzeige).
export function formatCm(mm: number): string {
  return `${ganzzahl.format(Math.round(mm / 10))} cm`;
}

// B × H auf cm gerundet, z. B. "120 × 140 cm".
export function formatBreiteHoeheCm(breiteMm: number, hoeheMm: number): string {
  return `${ganzzahl.format(Math.round(breiteMm / 10))} × ${ganzzahl.format(
    Math.round(hoeheMm / 10),
  )} cm`;
}

// Länge in Metern, cm-genau, z. B. "4,72 m".
export function formatMeter(mm: number): string {
  return `${zweiNachkommastellen.format(mm / 1000)} m`;
}

// Fläche in m², z. B. "47,17 m²".
export function formatQuadratmeter(mm2: number): string {
  return `${zweiNachkommastellen.format(mm2 / 1_000_000)} m²`;
}

// Roh-Wert in mm für Tooltips (ungerundete interne Zahl).
export function formatMmRoh(mm: number): string {
  return `${rohZahl.format(mm)} mm`;
}

// Roh-Wert in mm² für Tooltips.
export function formatMm2Roh(mm2: number): string {
  return `${rohZahl.format(mm2)} mm²`;
}
