import type { Dictionary } from "@/i18n";
import type { MinimalMeasurement } from "./viewerCards";

export function referenceText(
  r: NonNullable<MinimalMeasurement["references"]>[number],
  dict: Dictionary["viewerNext"],
) {
  return `${r.photo_index ? `${dict.photo} ${r.photo_index}: ` : ""}${
    r.scale_type === "own_reference" ? `${dict.referenceObject} (${r.object})` :
      r.scale_type === "transferred" ? `${dict.transferredVia} ${r.transferred_via}` : dict.noScale}`;
}
