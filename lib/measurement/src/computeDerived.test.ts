import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as measurementApi from "./index";
import type {
  MeasurementEdge,
  MeasurementFace,
  MeasurementInput,
  MeasurementOpening,
  MeasurementValue,
} from "./index";

const {
  computeDerived,
  formatSquareFeet,
  formatSquares,
  mm2ToSquareFeet,
  mm2ToSquares,
} = measurementApi;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturePath = join(repoRoot, "fixtures", "garage-house.json");

function loadFixture(): MeasurementInput {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as MeasurementInput;
}

function measured(value: number | null, confidence = "high"): MeasurementValue {
  return { value, confidence };
}

function unconfident(value: number | null): MeasurementValue {
  return { value };
}

function face(
  id: string,
  faceClass: string,
  fields: Partial<MeasurementFace> = {},
  storedFields: Record<string, unknown> = {},
): MeasurementFace {
  return { id, face_class: faceClass, ...fields, ...storedFields } as MeasurementFace;
}

function wall(
  id: string,
  fields: Partial<MeasurementFace> = {},
  storedFields: Record<string, unknown> = {},
): MeasurementFace {
  return face(
    id,
    "wall",
    {
      width_mm: measured(100),
      height_mm: measured(50),
      ...fields,
    },
    storedFields,
  );
}

function opening(
  id: string,
  type = "window",
  fields: Partial<MeasurementOpening> = {},
  storedFields: Record<string, unknown> = {},
): MeasurementOpening {
  return {
    id,
    type,
    width_mm: measured(100),
    height_mm: measured(50),
    ...fields,
    ...storedFields,
  } as MeasurementOpening;
}

function edge(
  id: string,
  edgeClass: string,
  length: number | null,
  confidence = "high",
): MeasurementEdge {
  return {
    id,
    edge_class: edgeClass,
    length_mm: measured(length, confidence),
  };
}

function measurement(
  fields: Partial<MeasurementInput> = {},
): MeasurementInput {
  return { faces: [], openings: [], edges: [], ...fields };
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeDeep(child);
    }
  }
  return value;
}

describe("computeDerived public API and canonical fixture", () => {
  it("is available through the package entry point and keeps formatter units explicit", () => {
    expect(typeof measurementApi.computeDerived).toBe("function");
    expect(formatSquareFeet(mm2ToSquareFeet(92903.04))).toBe("1 sq ft");
    expect(formatSquares(mm2ToSquares(92903.04 * 100))).toBe("1.0 SQ");
  });

  it("matches the canonical roof and corrected net-wall golden values", () => {
    const derived = computeDerived(loadFixture());
    const roofArea = derived.roof.area_mm2.value;
    const netWallArea = derived.walls.net_area_mm2.value;

    expect(roofArea).toBe(194817674.8);
    expect(netWallArea).not.toBeNull();
    expect(mm2ToSquareFeet(netWallArea!)).toBeCloseTo(2778.7532799787823, 10);
    expect(formatSquareFeet(mm2ToSquareFeet(netWallArea!))).toBe("2779 sq ft");
    expect(formatSquareFeet(mm2ToSquareFeet(roofArea!))).toBe("2097 sq ft");
    expect(formatSquares(derived.roof.squares.value)).toBe("21.0 SQ");
  });

  it("counts six roof facets in the canonical fixture", () => {
    expect(computeDerived(loadFixture()).roof.facet_count.value).toBe(6);
  });

  it("derives canonical permanent dimensions from the measured footprint and height", () => {
    const footprint = computeDerived(loadFixture()).footprint;

    expect(footprint.length_mm.value).toBe(12192);
    expect(footprint.depth_mm.value).toBe(8534.4);
    expect(footprint.eave_height_mm.value).toBe(5486.4);
  });

  it("keeps an unknown footprint depth null instead of using wall dimensions", () => {
    const input = loadFixture();
    const unknownDepth = {
      ...input,
      building: {
        ...input.building,
        footprint: {
          ...input.building?.footprint,
          points: undefined,
          depth_mm: null,
        },
      },
    };

    expect(computeDerived(unknownDepth).footprint.depth_mm.value).toBeNull();
  });

  it("totals 322 square feet of gables in the canonical fixture", () => {
    const area = computeDerived(loadFixture()).walls.gable_area_mm2.value;
    expect(area).not.toBeNull();
    expect(formatSquareFeet(mm2ToSquareFeet(area!))).toBe("322 sq ft");
  });

  it("exposes genuine per-wall components and aggregate trim areas", () => {
    const derived = computeDerived(loadFixture());
    const rightWall = derived.walls.faces.find(wall => wall.id === "WL-4")!;

    expect(formatSquareFeet(mm2ToSquareFeet(rightWall.rectangle_area_mm2.value!)))
      .toBe("504 sq ft");
    expect(formatSquareFeet(mm2ToSquareFeet(rightWall.gable_area_mm2.value!)))
      .toBe("131 sq ft");
    expect(formatSquareFeet(mm2ToSquareFeet(derived.trim.fascia_area_mm2.value!)))
      .toBe("107 sq ft");
    expect(formatSquareFeet(mm2ToSquareFeet(derived.trim.soffit_area_mm2.value!)))
      .toBe("157 sq ft");
  });

  it("keeps fixture opening groups, drainage, drip edge, and garage assignments exact", () => {
    const derived = computeDerived(loadFixture());
    const windowGroups = derived.openings.identicalGroups.filter(
      (group) => group.type === "window",
    );

    expect(derived.openings.total.value).toBe(20);
    expect(windowGroups).toHaveLength(2);
    expect(windowGroups.map((group) => group.count.value)).toEqual([10, 6]);
    expect(windowGroups.map((group) => group.width_mm.value)).toEqual([914.4, 812.9]);
    expect(windowGroups.map((group) => group.height_mm.value)).toEqual([1524, 1219.2]);

    expect(derived.downspouts.count.value).toBe(4);
    expect(derived.downspouts.drops.map((drop) => drop.id)).toEqual([
      "DS-1",
      "DS-2",
      "DS-3",
      "DS-4",
    ]);
    expect(derived.downspouts.total_mm.value).toBeCloseTo(19202.4, 8);

    expect(derived.edges.byClass.eave.value).toBeCloseTo(35966.4, 8);
    expect(derived.edges.byClass.rake.value).toBeCloseTo(33442.6, 8);
    expect(derived.edges.drip_edge_mm.value).toBeCloseTo(69409, 8);

    const wallFive = derived.walls.faces.find((wallFace) => wallFace.id === "WL-5");
    const wallSix = derived.walls.faces.find((wallFace) => wallFace.id === "WL-6");
    expect(wallFive?.deductedOpenings.map((item) => item.id)).toEqual(["G-1"]);
    expect(wallSix?.deductedOpenings).toEqual([]);
    expect(derived.openings.byWall["WL-5"].total.value).toBe(1);
    expect(derived.openings.byWall["WL-6"].total.value).toBe(0);
  });

  it("reconciles canonical parent-group opening sums with their type totals", () => {
    const derived = computeDerived(loadFixture());
    const windowTotal = derived.openings.byTypeAggregate.window;
    const windowGroups = derived.openings.parentGroups.filter(
      group => group.type === "window",
    );

    expect(windowGroups.map(group => [
      group.parent_face_id,
      group.count.value,
      group.area_mm2.value,
      group.perimeter.total_mm.value,
    ])).toEqual([
      ["WL-1", 6, 7556357.759999999, 27635.600000000002],
      ["WL-2", 5, 6565270.079999999, 23571.4],
      ["WL-3", 3, 3778178.88, 13817.8],
      ["WL-4", 2, 1982175.36, 8128.4],
    ]);
    expect(windowGroups.reduce((total, group) => total + group.count.value!, 0))
      .toBe(windowTotal.count.value);
    expect(windowGroups.reduce((total, group) => total + group.area_mm2.value!, 0))
      .toBeCloseTo(windowTotal.area_mm2.value!, 8);
    expect(windowGroups.reduce(
      (total, group) => total + group.perimeter.total_mm.value!,
      0,
    )).toBeCloseTo(windowTotal.perimeter.total_mm.value!, 8);
  });
});

describe("wall and opening geometry", () => {
  it("assigns deductions by parent face, never by elevation or non-wall parent", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W-left", {
            elevation: "back",
            area_mm2: measured(10000),
          }),
          wall("W-front", {
            elevation: "front",
            area_mm2: measured(10000),
          }),
          face("RF-front", "roof_face", {
            elevation: "front",
            area_mm2: measured(10000),
          }),
        ],
        openings: [
          opening("O-parent", "window", {
            elevation: "front",
            parent_face_id: "W-left",
            width_mm: measured(10),
            height_mm: measured(10),
          }),
          opening("O-roof", "skylight", {
            elevation: "front",
            parent_face_id: "RF-front",
          }),
          opening("O-no-parent", "door", {
            elevation: "back",
            parent_face_id: null,
          }),
          opening("O-dangling", "window", {
            elevation: "front",
            parent_face_id: "not-a-face",
          }),
        ],
      }),
    );

    const leftWall = derived.walls.faces.find((wallFace) => wallFace.id === "W-left");
    const frontWall = derived.walls.faces.find((wallFace) => wallFace.id === "W-front");
    expect(leftWall?.deductedOpenings.map((item) => item.id)).toEqual(["O-parent"]);
    expect(leftWall?.deducted_area_mm2.value).toBe(100);
    expect(frontWall?.deductedOpenings).toEqual([]);
    expect(derived.openings.nonWall.map((item) => item.id)).toEqual(["O-roof"]);
    expect(derived.openings.unassigned.map((item) => item.id)).toEqual([
      "O-no-parent",
      "O-dangling",
    ]);
    expect(derived.openings.items.find((item) => item.id === "O-roof")?.assignment).toBe(
      "non_wall",
    );
    expect(
      derived.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "missing_parent" && diagnostic.sourceId === "O-dangling",
      ),
    ).toBe(true);
  });

  it("recomputes opening area and perimeter from dimensions, ignoring stored opening fields", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall(
            "W",
            {
              width_mm: measured(100),
              height_mm: measured(50),
              gable_height_mm: null,
              area_mm2: measured(5000),
            },
            { net_area_mm2: measured(1) },
          ),
        ],
        openings: [
          opening(
            "O",
            "window",
            {
              parent_face_id: "W",
              width_mm: measured(10),
              height_mm: measured(20),
            },
            {
              area_mm2: measured(999999),
              perimeter_mm: measured(999999),
            },
          ),
        ],
      }),
    );
    const item = derived.openings.items[0];

    expect(item.area_mm2.value).toBe(200);
    expect(item.perimeter.tops_mm.value).toBe(10);
    expect(item.perimeter.sills_mm.value).toBe(10);
    expect(item.perimeter.sides_mm.value).toBe(40);
    expect(item.perimeter.total_mm.value).toBe(60);
    expect(derived.walls.faces[0].net_area_mm2.value).toBe(4800);
  });

  it("uses dimensional reconstruction when a stored gross area is absent, and diagnoses disagreement", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W-fallback", {
            width_mm: measured(100),
            height_mm: measured(20),
            gable_height_mm: null,
            area_mm2: null,
          }),
          wall("W-stored", {
            width_mm: measured(100),
            height_mm: measured(20),
            gable_height_mm: null,
            area_mm2: measured(5000),
          }),
        ],
      }),
    );
    const fallback = derived.walls.faces[0];
    const stored = derived.walls.faces[1];

    expect(fallback.reconstructed_area_mm2.value).toBe(2000);
    expect(fallback.gross_area_mm2.value).toBe(2000);
    expect(fallback.grossAreaBasis).toBe("dimensions");
    expect(stored.reconstructed_area_mm2.value).toBe(2000);
    expect(stored.gross_area_mm2.value).toBe(5000);
    expect(stored.grossAreaBasis).toBe("stored");
    expect(
      derived.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "gross_area_mismatch" &&
          diagnostic.sourceId === "W-stored",
      ),
    ).toBe(true);
  });

  it("distinguishes explicit rectangular gables from omitted unknown gable geometry", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W-rectangular", {
            width_mm: measured(100),
            height_mm: measured(50),
            gable_height_mm: null,
          }),
          wall("W-unknown", {
            width_mm: measured(100),
            height_mm: measured(50),
          }),
        ],
      }),
    );
    const rectangular = derived.walls.faces[0];
    const unknown = derived.walls.faces[1];

    expect(rectangular.gable_height_mm).toBeNull();
    expect(rectangular.reconstructed_area_mm2.value).toBe(5000);
    expect(rectangular.reconstructed_area_mm2.complete).toBe(true);
    expect(unknown.gable_height_mm?.value).toBeNull();
    expect(unknown.gable_height_mm?.complete).toBe(false);
    expect(unknown.reconstructed_area_mm2.value).toBeNull();
    expect(unknown.reconstructed_area_mm2.complete).toBe(false);
  });

  it("reports negative net area rather than returning a negative quantity", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W", {
            width_mm: measured(10),
            height_mm: measured(10),
            gable_height_mm: null,
            area_mm2: measured(100),
          }),
        ],
        openings: [
          opening("too-large", "window", {
            parent_face_id: "W",
            width_mm: measured(20),
            height_mm: measured(20),
          }),
        ],
      }),
    );
    const wallResult = derived.walls.faces[0];

    expect(wallResult.deducted_area_mm2.value).toBe(400);
    expect(wallResult.net_area_mm2.value).toBeNull();
    expect(wallResult.net_area_mm2.missingInputs).toContain("W.negative_net_area");
    expect(derived.walls.net_area_mm2.value).toBeNull();
    expect(
      derived.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "negative_net_area" && diagnostic.sourceId === "W",
      ),
    ).toBe(true);
  });
});

describe("unknown values and confidence", () => {
  it("propagates missing dimensions to null totals while retaining explicit counts", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W", {
            width_mm: null,
            height_mm: measured(100),
            gable_height_mm: null,
          }),
          face("RF", "roof_face", { area_mm2: null }),
        ],
        openings: [
          opening("incomplete", "window", {
            parent_face_id: "W",
            width_mm: null,
            height_mm: measured(100),
          }),
        ],
        edges: [edge("unknown-eave", "eave", null)],
      }),
    );
    const openingResult = derived.openings.items[0];
    const wallResult = derived.walls.faces[0];

    expect(derived.openings.total.value).toBe(1);
    expect(derived.openings.total.confidence).toBe("high");
    expect(derived.openings.byType.window.value).toBe(1);
    expect(openingResult.area_mm2.value).toBeNull();
    expect(openingResult.perimeter.total_mm.value).toBeNull();
    expect(derived.openings.perimeter.total_mm.value).toBeNull();
    expect(derived.openings.united_mm.value).toBeNull();
    expect(derived.openings.aggregate.count.value).toBe(1);
    expect(derived.openings.aggregate.area_mm2.value).toBeNull();
    expect(derived.openings.byTypeAggregate.window.area_mm2.value).toBeNull();
    expect(derived.openings.parentGroups[0].count.value).toBe(1);
    expect(derived.openings.parentGroups[0].area_mm2.value).toBeNull();
    expect(derived.openings.parentGroups[0].perimeter.total_mm.value).toBeNull();

    expect(wallResult.reconstructed_area_mm2.value).toBeNull();
    expect(wallResult.gross_area_mm2.value).toBeNull();
    expect(wallResult.net_area_mm2.value).toBeNull();
    expect(derived.walls.gross_area_mm2.value).toBeNull();
    expect(derived.walls.net_area_mm2.value).toBeNull();
    expect(derived.edges.byClass.eave.value).toBeNull();
    expect(derived.edges.drip_edge_mm.value).toBeNull();
    expect(derived.gutters.total_mm.value).toBeNull();
    expect(derived.roof.area_mm2.value).toBeNull();
    expect(derived.roof.squares.value).toBeNull();
  });

  it("uses the weakest confidence for dimensions and grouped counts", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W-medium", {
            width_mm: measured(100, "high"),
            height_mm: measured(50, "medium"),
            gable_height_mm: null,
          }),
        ],
        openings: [
          opening("medium-1", "window", {
            width_mm: measured(100, "high"),
            height_mm: measured(50, "high"),
          }),
          opening("medium-2", "window", {
            width_mm: measured(100, "medium"),
            height_mm: measured(50, "medium"),
          }),
          opening("low", "window", {
            width_mm: unconfident(200),
            height_mm: measured(50, "high"),
          }),
        ],
      }),
    );
    const grouped = derived.openings.identicalGroups;
    const mediumGroup = grouped.find((group) => group.width_mm.value === 100);
    const lowGroup = grouped.find((group) => group.width_mm.value === 200);

    expect(derived.walls.faces[0].reconstructed_area_mm2.confidence).toBe("medium");
    expect(mediumGroup?.width_mm.confidence).toBe("medium");
    expect(mediumGroup?.height_mm.confidence).toBe("medium");
    expect(mediumGroup?.count.confidence).toBe("medium");
    expect(lowGroup?.width_mm.complete).toBe(true);
    expect(lowGroup?.width_mm.confidence).toBe("low");
    expect(lowGroup?.height_mm.confidence).toBe("high");
    expect(lowGroup?.count.confidence).toBe("low");
    expect(derived.openings.items.find((item) => item.id === "low")?.width_mm.confidence).toBe(
      "low",
    );
  });

  it("ignores group_id, separates types, and leaves unknown dimensions ungrouped", () => {
    const derived = computeDerived(
      measurement({
        openings: [
          opening(
            "window-a",
            "window",
            { width_mm: measured(100), height_mm: measured(50) },
            { group_id: "first" },
          ),
          opening(
            "window-b",
            "window",
            { width_mm: measured(100), height_mm: measured(50) },
            { group_id: "different" },
          ),
          opening(
            "door-same-dimensions",
            "door",
            { width_mm: measured(100), height_mm: measured(50) },
            { group_id: "first" },
          ),
          opening("unknown-size", "window", {
            width_mm: null,
            height_mm: measured(50),
          }),
        ],
      }),
    );
    const groups = derived.openings.identicalGroups;
    const windowGroup = groups.find((group) => group.type === "window");
    const doorGroup = groups.find((group) => group.type === "door");

    expect(groups).toHaveLength(2);
    expect(windowGroup?.count.value).toBe(2);
    expect(windowGroup?.openingIds).toEqual(["window-a", "window-b"]);
    expect(doorGroup?.count.value).toBe(1);
    expect(doorGroup?.openingIds).toEqual(["door-same-dimensions"]);
    expect(derived.openings.ungroupedIds).toEqual(["unknown-size"]);
  });

  it("keeps same-elevation openings separated by parent identity", () => {
    const derived = computeDerived(measurement({
      faces: [
        wall("front-main", { elevation: "front" }),
        wall("front-garage", { elevation: "front" }),
      ],
      openings: [
        opening("main-window", "window", {
          elevation: "front",
          parent_face_id: "front-main",
        }),
        opening("garage-window", "window", {
          elevation: "front",
          parent_face_id: "front-garage",
        }),
      ],
    }));

    expect(derived.openings.parentGroups.map(group => ({
      parent: group.parent_face_id,
      elevation: group.elevation,
      ids: group.openingIds,
    }))).toEqual([
      { parent: "front-main", elevation: "front", ids: ["main-window"] },
      { parent: "front-garage", elevation: "front", ids: ["garage-window"] },
    ]);
  });
});

describe("perimeters, trim, edges, and drainage", () => {
  it("computes four-sided window trim and three-sided door trim separately", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("W", {
            width_mm: measured(1000),
            height_mm: measured(1000),
            gable_height_mm: null,
          }),
        ],
        openings: [
          opening("window", "window", {
            parent_face_id: "W",
            width_mm: measured(100),
            height_mm: measured(50),
          }),
          opening("door", "door", {
            parent_face_id: "W",
            width_mm: measured(200),
            height_mm: measured(80),
          }),
        ],
      }),
    );
    const windowResult = derived.openings.items[0];
    const doorResult = derived.openings.items[1];

    expect(windowResult.perimeter.tops_mm.value).toBe(100);
    expect(windowResult.perimeter.sills_mm.value).toBe(100);
    expect(windowResult.perimeter.sides_mm.value).toBe(100);
    expect(windowResult.perimeter.total_mm.value).toBe(300);
    expect(doorResult.perimeter.tops_mm.value).toBe(200);
    expect(doorResult.perimeter.sills_mm.value).toBe(200);
    expect(doorResult.perimeter.sides_mm.value).toBe(160);
    expect(doorResult.perimeter.total_mm.value).toBe(560);
    expect(derived.j_channel_estimate_mm.value).toBe(660);
    expect(derived.j_channel_estimate_mm.confidence).toBe("medium");
  });

  it.each([null, "missing-wall"])(
    "includes unassigned window and door trim for parent %s without wall deductions",
    (parent_face_id) => {
      const derived = computeDerived(measurement({
        faces: [wall("W")],
        openings: [
          opening("unassigned-window", "window", {
            parent_face_id, width_mm: measured(100), height_mm: measured(50),
          }),
          opening("unassigned-door", "door", {
            parent_face_id, width_mm: measured(200), height_mm: measured(80, "low"),
          }),
        ],
      }));
      expect(derived.j_channel_estimate_mm.value).toBe(660);
      expect(derived.j_channel_estimate_mm.complete).toBe(true);
      expect(derived.j_channel_estimate_mm.confidence).toBe("low");
      expect(derived.j_channel_estimate_mm.sourceIds).toEqual([
        "unassigned-window", "unassigned-door",
      ]);
      expect(derived.openings.unassigned).toHaveLength(2);
      expect(derived.walls.faces[0].deductedOpenings).toEqual([]);
      expect(derived.walls.deducted_area_mm2.value).toBe(0);
    },
  );

  it("does not present partial trim when an unassigned window has unknown dimensions", () => {
    const derived = computeDerived(measurement({
      openings: [
        opening("unknown-window", "window", {
          parent_face_id: null, width_mm: null, height_mm: measured(50),
        }),
        opening("known-door", "garage_door", {
          parent_face_id: "missing-wall", width_mm: measured(200), height_mm: measured(80),
        }),
      ],
    }));
    expect(derived.j_channel_estimate_mm.value).toBeNull();
    expect(derived.j_channel_estimate_mm.complete).toBe(false);
    expect(derived.j_channel_estimate_mm.missingInputs).toContain("unknown-window.width_mm");
  });

  it("returns unknown trim when an assigned opening type has no trim rule", () => {
    const derived = computeDerived(
      measurement({
        faces: [wall("W")],
        openings: [
          opening("skylight-on-wall", "skylight", {
            parent_face_id: "W",
          }),
        ],
      }),
    );

    expect(derived.j_channel_estimate_mm.value).toBeNull();
    expect(derived.j_channel_estimate_mm.complete).toBe(false);
    expect(derived.j_channel_estimate_mm.missingInputs).toContain(
      "skylight-on-wall.unsupported_trim_type",
    );
  });

  it("keeps edge classes, corners, starter, drip edge, and gutters independent", () => {
    const derived = computeDerived(
      measurement({
        edges: [
          edge("eave-1", "eave", 100),
          edge("eave-2", "eave", 50, "medium"),
          edge("rake", "rake", 25),
          edge("inside", "inside_corner", 10),
          edge("outside", "outside_corner", 20),
          edge("base", "base", 30),
          edge("flashing", "flashing", 40),
        ],
      }),
    );

    expect(derived.edges.byClass.eave.value).toBe(150);
    expect(derived.edges.byClass.rake.value).toBe(25);
    expect(derived.edges.byClass.flashing.value).toBe(40);
    expect(derived.edges.drip_edge_mm.value).toBe(175);
    expect(derived.corners.inside_mm.value).toBe(10);
    expect(derived.corners.outside_mm.value).toBe(20);
    expect(derived.corners.total_mm.value).toBe(30);
    expect(derived.starter_base_mm.value).toBe(30);
    expect(derived.gutters.runs.map((run) => run.id)).toEqual(["eave-1", "eave-2"]);
    expect(derived.gutters.total_mm.value).toBe(150);
  });

  it("distinguishes omitted, null, and explicitly empty downspout collections", () => {
    const omitted = computeDerived(measurement());
    const explicitlyEmpty = computeDerived(measurement({ downspouts: [] }));
    const explicitlyNull = computeDerived(
      measurement({ downspouts: null } as unknown as Partial<MeasurementInput>),
    );

    for (const derived of [omitted, explicitlyNull]) {
      expect(derived.downspouts.drops).toEqual([]);
      expect(derived.downspouts.count.value).toBeNull();
      expect(derived.downspouts.total_mm.value).toBeNull();
      expect(derived.downspouts.count.missingInputs).toEqual(["downspouts"]);
      expect(derived.downspouts.total_mm.missingInputs).toEqual(["downspouts"]);
    }
    expect(explicitlyEmpty.downspouts.drops).toEqual([]);
    expect(explicitlyEmpty.downspouts.count.value).toBe(0);
    expect(explicitlyEmpty.downspouts.count.confidence).toBe("high");
    expect(explicitlyEmpty.downspouts.total_mm.value).toBe(0);
    expect(explicitlyEmpty.downspouts.total_mm.confidence).toBe("high");
  });

  it("suggests simple, complex, or unavailable roof waste without changing raw roof totals", () => {
    const simple = computeDerived(
      measurement({
        faces: [face("RF-simple", "roof_face", { area_mm2: measured(1000) })],
      }),
    );
    const complex = computeDerived(
      measurement({
        building: { roof_type: "hip" },
        faces: [face("RF-complex", "roof_face", { area_mm2: measured(1000) })],
        edges: [edge("hip", "hip", 100)],
      }),
    );
    const absent = computeDerived(measurement());

    expect(simple.roof.area_mm2.value).toBe(1000);
    expect(simple.roof.suggestedWasteFactor.value).toBe(0.1);
    expect(simple.roof.suggestedWasteFactor.confidence).toBe("low");
    expect(complex.roof.area_mm2.value).toBe(1000);
    expect(complex.roof.suggestedWasteFactor.value).toBe(0.15);
    expect(complex.roof.suggestedWasteFactor.sourceIds).toEqual(["RF-complex", "hip"]);
    expect(absent.roof.suggestedWasteFactor.value).toBeNull();
    expect(absent.roof.suggestedWasteFactor.missingInputs).toEqual(["roof faces"]);
  });
});

describe("empty, zero, overflow, and immutability behavior", () => {
  it("returns exact high-confidence zeros for explicit empty collections", () => {
    const derived = computeDerived(measurement({ downspouts: [] }));

    expect(derived.roof.area_mm2.value).toBe(0);
    expect(derived.roof.area_mm2.confidence).toBe("high");
    expect(derived.roof.squares.value).toBe(0);
    expect(derived.walls.gross_area_mm2.value).toBe(0);
    expect(derived.walls.deducted_area_mm2.value).toBe(0);
    expect(derived.walls.net_area_mm2.value).toBe(0);
    expect(derived.openings.total.value).toBe(0);
    expect(derived.openings.perimeter.total_mm.value).toBe(0);
    expect(derived.edges.byClass.ridge.value).toBe(0);
    expect(derived.gutters.total_mm.value).toBe(0);
    expect(derived.downspouts.count.value).toBe(0);
    expect(derived.downspouts.total_mm.value).toBe(0);
  });

  it("preserves zero dimensions as known zero rather than missing", () => {
    const derived = computeDerived(
      measurement({
        faces: [
          wall("zero-wall", {
            width_mm: measured(0),
            height_mm: measured(0),
            gable_height_mm: null,
            area_mm2: measured(0),
          }),
        ],
        openings: [
          opening("zero-opening", "window", {
            parent_face_id: "zero-wall",
            width_mm: measured(0),
            height_mm: measured(0),
          }),
        ],
      }),
    );

    expect(derived.walls.faces[0].reconstructed_area_mm2.value).toBe(0);
    expect(derived.walls.faces[0].reconstructed_area_mm2.complete).toBe(true);
    expect(derived.walls.faces[0].net_area_mm2.value).toBe(0);
    expect(derived.openings.items[0].area_mm2.value).toBe(0);
    expect(derived.openings.items[0].perimeter.total_mm.value).toBe(0);
    expect(derived.j_channel_estimate_mm.value).toBe(0);
  });

  it("turns non-finite arithmetic into null with an overflow diagnostic", () => {
    const derived = computeDerived(
      measurement({
        openings: [
          opening("huge-opening", "window", {
            width_mm: measured(Number.MAX_VALUE),
            height_mm: measured(2),
          }),
        ],
        edges: [
          edge("huge-eave-a", "eave", Number.MAX_VALUE),
          edge("huge-eave-b", "eave", Number.MAX_VALUE),
        ],
      }),
    );
    const hugeOpening = derived.openings.items[0];

    expect(hugeOpening.area_mm2.value).toBeNull();
    expect(hugeOpening.area_mm2.missingInputs).toContain("arithmetic overflow");
    expect(hugeOpening.perimeter.sides_mm.value).toBe(4);
    expect(hugeOpening.perimeter.total_mm.value).toBeNull();
    expect(derived.edges.byClass.eave.value).toBeNull();
    expect(derived.edges.byClass.eave.missingInputs).toContain("arithmetic overflow");
    expect(derived.openings.total.value).toBe(1);
  });

  it("does not mutate frozen input and produces deterministic output", () => {
    const input = freezeDeep(
      measurement({
        faces: [
          wall("W", {
            elevation: "front",
            gable_height_mm: null,
            area_mm2: measured(5000),
          }),
        ],
        openings: [
          opening("O", "window", {
            parent_face_id: "W",
            width_mm: measured(10),
            height_mm: measured(20),
          }),
        ],
        edges: [edge("E", "eave", 100)],
        downspouts: [{ id: "DS", length_mm: measured(50) }],
      }),
    );
    const before = JSON.stringify(input);
    const first = computeDerived(input);
    const second = computeDerived(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
  });
});