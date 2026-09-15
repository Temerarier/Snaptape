import { describe, expect, it } from "vitest";
import { computeDerived } from "@workspace/measurement";
import type { MeasurementInput } from "@workspace/measurement";
import fixture from "../../../../fixtures/garage-house.json";
import { enUS } from "@/i18n/en-US";
import { filterCards } from "@/components/viewer-next/ViewerNextClient";
import { buildCards } from "./viewerCards";
import type { MinimalMeasurement } from "./viewerCards";

const measurement = fixture as unknown as MeasurementInput;
const displayMeasurement = fixture as unknown as MinimalMeasurement;
const cards = buildCards(
  computeDerived(measurement),
  displayMeasurement,
  enUS.viewerNext,
);

describe("viewer-next fixture presentation", () => {
  it("builds the nine cards in their binding order", () => {
    expect(cards.map(card => card.id)).toEqual([
      "roof_area",
      "roof_edges",
      "penetrations",
      "gutters",
      "height",
      "walls",
      "openings",
      "trim",
      "condition_areas",
    ]);
  });

  it("uses canonical roof, wall, opening, and drainage values", () => {
    const roof = cards.find(card => card.id === "roof_area")!;
    const walls = cards.find(card => card.id === "walls")!;
    const openings = cards.find(card => card.id === "openings")!;
    const gutters = cards.find(card => card.id === "gutters")!;
    const downspouts = gutters.rows.find(row => row.id === "ds")!;

    expect([roof.hero, roof.heroUnit, roof.hero2, roof.sub]).toEqual([
      "2097", "sq ft", "21.0 SQ", "6 facets",
    ]);
    expect([walls.hero, walls.sub, walls.rows.length]).toEqual([
      "2779", "of which gables 322 sq ft", 6,
    ]);
    expect(walls.rows.every(row => row.calcLines?.[0]?.value === row.sub?.split(" ")[0]))
      .toBe(true);
    expect(openings.hero).toBe("20");
    expect(openings.sub).toBe(
      "16 windows, 1 door, 1 patio door, 1 garage door, 1 skylight",
    );
    expect([gutters.hero, gutters.heroUnit]).toEqual(["118' 0\"", "LF gutter run"]);
    expect([downspouts.value, downspouts.unit, downspouts.sub]).toEqual([
      "4", "EA", "total 63' 0\"",
    ]);
    expect(downspouts.subRows?.map(row => row.value)).toEqual([
      "18' 0\"", "18' 0\"", "18' 0\"", "9' 0\"",
    ]);
  });

  it("keeps unclassified edges visible and lists every window", () => {
    const edgeRows = cards.find(card => card.id === "roof_edges")!.rows;
    const windows = cards.find(card => card.id === "openings")!.rows[0];
    const listedWindows = windows.subRows!.flatMap(group => group.subRows ?? []);

    expect(edgeRows.find(row => row.id === "edge-unclassified")?.value).toBe("0' 0\"");
    expect(listedWindows).toHaveLength(16);
  });

  it("filters exactly the card sets from the spec", () => {
    expect(filterCards(cards, "roofing").map(card => card.id)).toEqual([
      "roof_area", "roof_edges", "penetrations", "gutters", "height",
    ]);
    expect(filterCards(cards, "siding").map(card => card.id)).toEqual([
      "height", "walls", "openings", "trim",
    ]);
    expect(filterCards(cards, "painting").map(card => card.id)).toEqual([
      "walls", "openings", "trim", "condition_areas",
    ]);
  });
});