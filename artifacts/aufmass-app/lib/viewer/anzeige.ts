// Anzeige-Formatierung (Eiserne Regel 1): intern bleiben alle Werte
// ungerundete mm/mm² – gerundet wird ausschließlich hier für die Anzeige.
// US-Markt (Schema v1.2): Anzeige imperial (ft-in, ft², Pitch x/12);
// Tooltips zeigen weiterhin die ungerundeten internen mm-Werte.
const ganzzahl = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

const rohZahl = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 6,
});

const MM_PRO_INCH = 25.4;
const MM2_PRO_QUADRATFUSS = 92903.04; // (12 × 25,4 mm)²

// Länge in Fuß und Zoll, auf ganze Zoll gerundet, z. B. „14' 11"".
// Unter einem Fuß nur Zoll, z. B. „11"".
export function formatFtIn(mm: number): string {
  const zollGesamt = Math.round(mm / MM_PRO_INCH);
  const fuss = Math.floor(zollGesamt / 12);
  const zoll = zollGesamt - fuss * 12;
  return fuss > 0 ? `${fuss}' ${zoll}"` : `${zoll}"`;
}

// B × H in Fuß/Zoll, z. B. „3' 11" × 4' 7"".
export function formatBreiteHoeheFtIn(
  breiteMm: number,
  hoeheMm: number,
): string {
  return `${formatFtIn(breiteMm)} × ${formatFtIn(hoeheMm)}`;
}

// Fläche in ganzen Quadratfuß, z. B. „508 ft²".
export function formatQuadratfuss(mm2: number): string {
  return `${ganzzahl.format(Math.round(mm2 / MM2_PRO_QUADRATFUSS))} ft²`;
}

// Dachneigung als US-Pitch, z. B. „7.5/12" (rise over 12 run).
// US-Fachnotation – bewusst mit Punkt statt Komma.
export function formatPitch(riseOver12: number): string {
  return `${riseOver12}/12`;
}

// Exakter Gradwert für Tooltips, z. B. „32,005383°".
export function formatGrad(grad: number): string {
  return `${rohZahl.format(grad)}°`;
}

// Roh-Wert in mm für Tooltips (ungerundete interne Zahl).
export function formatMmRoh(mm: number): string {
  return `${rohZahl.format(mm)} mm`;
}

// Roh-Wert in mm² für Tooltips.
export function formatMm2Roh(mm2: number): string {
  return `${rohZahl.format(mm2)} mm²`;
}
