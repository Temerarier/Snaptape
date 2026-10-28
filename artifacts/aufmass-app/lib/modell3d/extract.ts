export function extrahiereBuildHouse(text: string): string {
  const blocks = [...text.matchAll(/```(?:js|javascript)\s*\n([\s\S]*?)```/gi)]
    .map(match => match[1]!).filter(block => /\bbuildHouse\b/.test(block))
    .sort((a, b) => b.length - a.length);
  if (blocks[0]) return blocks[0];
  const start = text.search(/\bfunction\s+buildHouse\s*\(/);
  if (start < 0) throw new Error("Keine Funktion buildHouse in der Antwort");
  return text.slice(start).split("```", 1)[0]!;
}
