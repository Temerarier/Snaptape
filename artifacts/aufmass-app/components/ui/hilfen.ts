// Kleiner Helfer zum Zusammenfügen von Tailwind-Klassen ohne
// Zusatz-Abhängigkeit: falsy Werte fallen weg.
export function cn(
  ...klassen: (string | false | null | undefined)[]
): string {
  return klassen.filter(Boolean).join(" ");
}
