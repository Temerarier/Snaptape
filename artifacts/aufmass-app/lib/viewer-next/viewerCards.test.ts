import { describe, expect, it } from "vitest";
import { computeDerived, mm2ToSquareFeet } from "@workspace/measurement";
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
    expect(cards.map((card) => card.id)).toEqual([
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
    const roof = cards.find((card) => card.id === "roof_area")!;
    const walls = cards.find((card) => card.id === "walls")!;
    const openings = cards.find((card) => card.id === "openings")!;
    const gutters = cards.find((card) => card.id === "gutters")!;
    const downspouts = gutters.rows.find((row) => row.id === "ds")!;

    expect([roof.hero, roof.heroUnit, roof.hero2, roof.sub]).toEqual([
      "2097",
      "sq ft",
      "21.0 SQ",
      "6 facets",
    ]);
    expect([walls.hero, walls.sub, walls.rows.length]).toEqual([
      "2779",
      "of which gables 322 sq ft",
      6,
    ]);
    for (const row of walls.rows) {
      if (!row.calcLines) continue;
      const reconciledNet = row.calcLines.reduce(
        (sum, line) => sum + Number(line.value.replace("−", "-")),
        0,
      );
      expect(reconciledNet, row.id).toBe(Number(row.value));
    }
    const rightWall = walls.rows.find((row) => row.id === "WL-4")!;
    expect(rightWall.calcLines?.map((line) => line.label)).toEqual([
      `28' 0" × 18' 0"`,
      `+ gable 28' 0" × 9' 4" / 2`,
      "− 2 openings",
    ]);
    expect(openings.hero).toBe("20");
    expect(openings.sub).toBe(
      "16 windows, 1 door, 1 patio door, 1 garage door, 1 skylight",
    );
    expect([gutters.hero, gutters.heroUnit]).toEqual([
      "118' 0\"",
      "LF gutter run",
    ]);
    const edges = cards.find((card) => card.id === "roof_edges")!;
    expect(edges.sourceBadge).toBe("from eaves + rakes");
    expect(edges.rows.find((row) => row.id === "edge-eave")?.value).toBe(
      "118' 0\"",
    );
    expect(edges.rows.find((row) => row.id === "edge-ridge")?.value).toBe(
      "70' 0\"",
    );
    expect(edges.rows.find((row) => row.id === "edge-rake")?.value).toBe(
      "109' 9\"",
    );
    expect(
      cards
        .find((card) => card.id === "penetrations")!
        .rows.find((row) => row.id === "AT-2")?.label,
    ).toBe("Pipe boots (AT-2)");
    expect(cards.find((card) => card.id === "penetrations")!.hero).toBe("7");
    expect([downspouts.value, downspouts.unit, downspouts.sub]).toEqual([
      "4",
      "EA",
      "total 63' 0\"",
    ]);
    expect(downspouts.subRows?.map((row) => row.value)).toEqual([
      "18' 0\"",
      "18' 0\"",
      "18' 0\"",
      "9' 0\"",
    ]);
  });

  it("keeps unclassified edges visible and lists every window", () => {
    const edgeRows = cards.find((card) => card.id === "roof_edges")!.rows;
    const windows = cards.find((card) => card.id === "openings")!.rows[0];
    const listedWindows = windows.subRows!.flatMap(
      (group) => group.subRows ?? [],
    );

    expect(edgeRows.find((row) => row.id === "edge-rake")?.value).toBe(
      "109' 9\"",
    );
    expect(edgeRows.find((row) => row.id === "edge-unclassified")?.value).toBe(
      "0' 0\"",
    );
    expect(listedWindows).toHaveLength(16);
    expect(listedWindows.every((row) => row.unit === "sq ft")).toBe(true);
    expect(
      cards
        .find((card) => card.id === "walls")!
        .rows.every((row) => row.value === "—" || row.unit === "sq ft"),
    ).toBe(true);
  });

  it("exposes raw typed tally metadata instead of display-string values", () => {
    const roof = cards.find((card) => card.id === "roof_area")!;
    const first = roof.rows.find((row) => row.id === "RF-1")!;
    const second = roof.rows.find((row) => row.id === "RF-2")!;
    expect(first.tally).toMatchObject({ unit: "sq ft", semanticClass: "roof" });
    expect(second.tally).toMatchObject({
      unit: "sq ft",
      semanticClass: "roof",
    });
    const expected = displayMeasurement.faces!
      .filter(face => face.id === "RF-1" || face.id === "RF-2")
      .reduce((sum, face) => sum + mm2ToSquareFeet(face.area_mm2!.value!), 0);
    expect(first.tally!.value + second.tally!.value).toBe(expected);
    expect(Math.round(expected)).toBe(1346);

    const nullMeasurement: MinimalMeasurement = {
      ...displayMeasurement,
      faces: displayMeasurement.faces?.map((face) =>
        face.id === "RF-1" ? { ...face, area_mm2: { value: null } } : face,
      ),
    };
    const nullRoof = buildCards(
      computeDerived(measurement),
      nullMeasurement,
      enUS.viewerNext,
    ).find((card) => card.id === "roof_area")!;
    expect(
      nullRoof.rows.find((row) => row.id === "RF-1")!.tally,
    ).toBeUndefined();
  });

  it("keeps an unknown trim face visible for field verification", () => {
    const displayWithNullFascia: MinimalMeasurement = {
      ...displayMeasurement,
      faces: displayMeasurement.faces?.map((face) =>
        face.face_class === "fascia"
          ? { ...face, area_mm2: { value: null } }
          : face,
      ),
    };
    const nullTrimCards = buildCards(
      computeDerived(measurement),
      displayWithNullFascia,
      enUS.viewerNext,
    );
    const fascia = nullTrimCards
      .find((card) => card.id === "trim")!
      .rows.find((row) => row.id === "FC-1")!;

    expect([fascia.value, fascia.unit]).toEqual(["—", "verify on site"]);
  });

  it("keeps a null wall visible and out of tally", () => {
    const nullWallFixture = {
      ...fixture,
      faces: fixture.faces.map((face) =>
        face.id === "WL-1"
          ? { ...face, width_mm: null, area_mm2: null }
          : face,
      ),
    };
    const nullWallInput = nullWallFixture as unknown as MeasurementInput;
    const nullWallDisplay = nullWallFixture as unknown as MinimalMeasurement;
    const wall = buildCards(
      computeDerived(nullWallInput),
      nullWallDisplay,
      enUS.viewerNext,
    )
      .find((card) => card.id === "walls")!
      .rows.find((row) => row.id === "WL-1")!;

    expect([wall.value, wall.unit, wall.sub, wall.cta, wall.tally]).toEqual([
      "—",
      "verify on site",
      "Not captured",
      "Add photo",
      undefined,
    ]);
  });

  it("does not tally a downspout count when its total is missing", () => {
    const derived = computeDerived(measurement);
    const missingTotal = {
      ...derived,
      downspouts: {
        ...derived.downspouts,
        total_mm: { ...derived.downspouts.total_mm, value: null },
      },
    };
    const downspouts = buildCards(
      missingTotal,
      displayMeasurement,
      enUS.viewerNext,
    )
      .find((card) => card.id === "gutters")!
      .rows.find((row) => row.id === "ds")!;

    expect([downspouts.value, downspouts.unit, downspouts.tally]).toEqual([
      "—",
      "verify on site",
      undefined,
    ]);
  });

  it("sums repeated skylights in the penetration hero", () => {
    const skylight = fixture.openings.find((opening) => opening.type === "skylight")!;
    const withMoreSkylights = {
      ...fixture,
      openings: [
        ...fixture.openings,
        { ...skylight, id: "SK-2" },
        { ...skylight, id: "SK-3" },
      ],
    } as unknown as MeasurementInput;
    const penetrations = buildCards(
      computeDerived(withMoreSkylights),
      displayMeasurement,
      enUS.viewerNext,
    ).find((card) => card.id === "penetrations")!;

    expect(penetrations.hero).toBe("9");
    expect(penetrations.rows.find((row) => row.id === "p-sky")).toMatchObject({
      value: "3",
      tally: { value: 3, unit: "EA", semanticClass: "roof" },
    });
  });

  it("scopes opening wall group ids by opening type", () => {
    const door = fixture.openings.find((opening) => opening.type === "door")!;
    const withMoreDoors = {
      ...fixture,
      openings: [
        ...fixture.openings,
        ...Array.from({ length: 6 }, (_, index) => ({
          ...door,
          id: `D-${index + 2}`,
        })),
      ],
    } as unknown as MeasurementInput;
    const openingRows = buildCards(
      computeDerived(withMoreDoors),
      displayMeasurement,
      enUS.viewerNext,
    ).find((card) => card.id === "openings")!.rows;
    const groupIds = openingRows.flatMap((row) =>
      (row.subRows ?? []).filter((subRow) => subRow.id.startsWith("og_")).map(
        (subRow) => subRow.id,
      ),
    );

    expect(groupIds).toEqual(
      expect.arrayContaining(["og_window_WL-1", "og_door_WL-1"]),
    );
    expect(new Set(groupIds).size).toBe(groupIds.length);
  });

  it("omits a zero-area wall deduction line", () => {
    const zeroAreaOpening = {
      ...fixture.openings.find((opening) => opening.type === "window")!,
      id: "W-zero",
      parent_face_id: "WL-6",
      width_mm: { value: 0, confidence: "high", source: "scaled" },
    };
    const withZeroAreaOpening = {
      ...fixture,
      openings: [...fixture.openings, zeroAreaOpening],
    } as unknown as MeasurementInput;
    const wall = buildCards(
      computeDerived(withZeroAreaOpening),
      displayMeasurement,
      enUS.viewerNext,
    )
      .find((card) => card.id === "walls")!
      .rows.find((row) => row.id === "WL-6")!;

    expect(wall.calcLines?.some((line) => line.label.includes("openings"))).toBe(
      false,
    );
  });

  it("does not throw when stored wall area exists without wall dimensions", () => {
    const missingWidthFixture = {
      ...fixture,
      faces: fixture.faces.map((face) =>
        face.id === "WL-1" ? { ...face, width_mm: null } : face,
      ),
    };
    const missingWidthInput =
      missingWidthFixture as unknown as MeasurementInput;
    const missingWidthDisplay =
      missingWidthFixture as unknown as MinimalMeasurement;

    expect(() =>
      buildCards(
        computeDerived(missingWidthInput),
        missingWidthDisplay,
        enUS.viewerNext,
      ),
    ).not.toThrow();

    const wall = buildCards(
      computeDerived(missingWidthInput),
      missingWidthDisplay,
      enUS.viewerNext,
    )
      .find((card) => card.id === "walls")!
      .rows.find((row) => row.id === "WL-1")!;

    expect(wall.value).toBe("618");
    expect(wall.calcLines).toEqual([
      { label: "Wall breakdown unavailable · verify on site", value: "—" },
    ]);
  });

  it("filters exactly the card sets from the spec", () => {
    expect(filterCards(cards, "roofing").map((card) => card.id)).toEqual([
      "roof_area",
      "roof_edges",
      "penetrations",
      "gutters",
      "height",
    ]);
    expect(filterCards(cards, "siding").map((card) => card.id)).toEqual([
      "height",
      "walls",
      "openings",
      "trim",
    ]);
    expect(filterCards(cards, "painting").map((card) => card.id)).toEqual([
      "walls",
      "openings",
      "trim",
      "condition_areas",
    ]);
  });
});
