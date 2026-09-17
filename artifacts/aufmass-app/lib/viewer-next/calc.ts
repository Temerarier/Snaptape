import type { TallyValue } from "./viewerCards";
// The package barrel also exports Node-only validation; import the existing
// pure formatter directly so this client-side helper cannot bundle node:fs.
import { formatFeetInches } from "../../../../lib/measurement/src/formatMeasurement";

export interface TallyItem extends TallyValue {
  id: string;
  label: string;
}

export interface TallyGroup {
  semanticClass: string;
  unit: TallyValue["unit"];
  value: number;
}

export function toggleTallyItem(
  items: readonly TallyItem[],
  item: TallyItem,
): TallyItem[] {
  const existing = items.findIndex((candidate) => candidate.id === item.id);
  if (existing < 0) return [...items, item];
  return items.filter((_, index) => index !== existing);
}

export function groupTally(items: readonly TallyItem[]): TallyGroup[] {
  const groups = new Map<string, TallyGroup>();
  for (const item of items) {
    const key = `${item.semanticClass}\u0000${item.unit}`;
    const current = groups.get(key);
    if (current) current.value += item.value;
    else
      groups.set(key, {
        semanticClass: item.semanticClass,
        unit: item.unit,
        value: item.value,
      });
  }
  return [...groups.values()];
}

export function formatTallyValue(
  value: number,
  unit: TallyValue["unit"],
): string {
  if (unit === "LF") {
    return formatFeetInches(value * 12);
  }
  if (unit === "sq ft") {
    return Math.round(value).toLocaleString("en-US");
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatTallyCopy(
  groups: readonly TallyGroup[],
  classLabels: Readonly<Record<string, string>>,
): string {
  return groups
    .map(
      (group) =>
        `${classLabels[group.semanticClass] ?? group.semanticClass}: ${formatTallyValue(group.value, group.unit)} ${group.unit}`,
    )
    .join(" · ");
}
