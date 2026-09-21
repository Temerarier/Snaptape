import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { enUS } from "@/i18n/en-US";
import { deDE } from "@/i18n/de-DE";
import { ProjectViewer } from "@/components/viewer-next/ProjectViewer";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { prepareProjectMeasurement } from "./projectMeasurement";

describe("prepareProjectMeasurement", () => {
  const completeEmptyV16 = {
    meta: { schema_version: "1.6" },
    faces: [],
    openings: [],
    edges: [],
    attachments: [],
    condition_areas: [],
    downspouts: [],
  };

  const prepareViewer = (measurement: unknown) => {
    const result = prepareProjectMeasurement(measurement, enUS.viewerNext);
    expect(result.kind).toBe("viewer");
    if (result.kind !== "viewer") throw new Error("Expected viewer result");
    return result;
  };

  const card = (
    result: ReturnType<typeof prepareViewer>,
    id: string,
  ) => result.cards.find((candidate) => candidate.id === id)!;

  it("keeps older measurements out of viewer preprocessing", () => {
    const result = prepareProjectMeasurement(
      {
        meta: { schema_version: "1.5" },
        get faces() {
          throw new Error("legacy data must not be read");
        },
      },
      enUS.viewerNext,
    );

    expect(result).toEqual({ kind: "older-version" });
  });

  it.each([null, undefined, "bad", 42])(
    "reports unreadable payloads without throwing",
    (measurement) => {
      expect(
        prepareProjectMeasurement(measurement, enUS.viewerNext),
      ).toEqual({ kind: "unreadable" });
    },
  );

  it("treats a readable payload without metadata or a v1.6 marker as older", () => {
    expect(
      prepareProjectMeasurement({ meta: {} }, enUS.viewerNext),
    ).toEqual({ kind: "older-version" });
    expect(
      prepareProjectMeasurement({ faces: [], openings: [], edges: [] }, enUS.viewerNext),
    ).toEqual({ kind: "older-version" });
  });

  it("renders partial v1.6 data and omits malformed parts", () => {
    const result = prepareProjectMeasurement(
      {
        meta: { schema_version: "1.6" },
        building: {},
        faces: [
          { id: "wall-1", face_class: "wall", elevation: "front" },
          { id: "wall-1", face_class: "wall", elevation: "back" },
          null,
        ],
        openings: [{ id: "window-1", type: "window" }, { type: "door" }],
        edges: "missing",
        quality: { warnings: ["Existing source warning"] },
      },
      enUS.viewerNext,
    );

    expect(result.kind).toBe("viewer");
    if (result.kind !== "viewer") return;
    expect(result.measurement.faces).toHaveLength(1);
    expect(result.measurement.edges).toEqual([]);
    expect(card(result, "roof_edges").hero).toBe("—");
    expect(card(result, "openings").hero).toBe("—");
    expect(result.measurement.quality?.warnings).toEqual([
      "Existing source warning",
      enUS.viewerNext.labels.omittedElements,
    ]);
    expect(result.derived.walls.faces[0]?.net_area_mm2.value).toBeNull();
    expect(result.cards.some((card) => card.hero === "—")).toBe(true);
  });

  it.each([
    ["faces", "roof_area"],
    ["openings", "openings"],
    ["edges", "roof_edges"],
    ["attachments", "penetrations"],
    ["condition_areas", "condition_areas"],
    ["downspouts", "gutters"],
  ] as const)(
    "shows unknown %s totals for omitted, null, and malformed collections, but zero for an explicit empty collection",
    (collection, cardId) => {
      for (const source of ["omitted", "null", "malformed"] as const) {
        const measurement: Record<string, unknown> = {
          ...completeEmptyV16,
        };
        if (source === "omitted") delete measurement[collection];
        else measurement[collection] = source === "null" ? null : [null];

        const result = prepareViewer(measurement);
        const target = card(result, cardId);
        if (collection === "downspouts") {
          expect(target.rows.find((row) => row.id === "ds")?.value).toBe("—");
        } else {
          expect(target.hero).toBe("—");
        }
      }

      const explicitEmpty = prepareViewer(completeEmptyV16);
      const target = card(explicitEmpty, cardId);
      if (collection === "downspouts") {
        expect(target.rows.find((row) => row.id === "ds")?.value).toBe("0");
      } else {
        expect(target.hero).not.toBe("—");
      }
    },
  );

  it("keeps every collection-backed total unknown for a metadata-only v1.6 payload", () => {
    const result = prepareViewer({
      meta: { schema_version: "1.6" },
    });

    for (const id of [
      "roof_area",
      "roof_edges",
      "penetrations",
      "gutters",
      "walls",
      "openings",
      "trim",
      "condition_areas",
    ]) {
      expect(card(result, id).hero, id).toBe("—");
    }
    expect(
      card(result, "gutters").rows.find((row) => row.id === "ds")?.value,
    ).toBe("—");
    expect(
      card(result, "trim").rows.find((row) => row.id === "t_out_c")?.value,
    ).toBe("—");
    expect(
      card(result, "trim").rows.find((row) => row.id === "t_in_c")?.value,
    ).toBe("—");
  });

  it("treats explicitly empty collections as known zero totals", () => {
    const result = prepareViewer(completeEmptyV16);

    for (const id of [
      "roof_area",
      "roof_edges",
      "penetrations",
      "gutters",
      "walls",
      "openings",
      "trim",
      "condition_areas",
    ]) {
      expect(card(result, id).hero, id).not.toBe("—");
    }
    expect(
      card(result, "gutters").rows.find((row) => row.id === "ds")?.value,
    ).toBe("0");
    expect(
      card(result, "trim").rows.find((row) => row.id === "t_out_c")?.value,
    ).toBe("0");
  });

  it("keeps valid sibling geometry but does not present partial collections as complete totals", () => {
    const result = prepareViewer({
      ...completeEmptyV16,
      faces: [
        {
          id: "roof-good",
          face_class: "roof_face",
          area_mm2: { value: 10_000_000 },
        },
        null,
      ],
      openings: [
        {
          id: "window-good",
          type: "window",
          width_mm: { value: 1000 },
          height_mm: { value: 1000 },
        },
        { type: "door" },
      ],
    });

    expect(result.measurement.faces).toHaveLength(1);
    expect(result.derived.openings.items).toHaveLength(1);
    expect(result.derived.roof.area_mm2.value).toBeNull();
    expect(result.derived.openings.total.value).toBeNull();
    expect(card(result, "roof_area").rows).toHaveLength(1);
    expect(card(result, "openings").rows).toHaveLength(1);
    expect(card(result, "roof_area").hero).toBe("—");
    expect(card(result, "openings").hero).toBe("—");
  });

  it("keeps good nested data when neighboring optional data is malformed", () => {
    const result = prepareProjectMeasurement(
      {
        meta: { schema_version: "1.6" },
        building: {
          footprint: {
            points: [[0, 0], "bad point", [5000, 0]],
            width_mm: { value: 5000 },
            depth_mm: "bad dimension",
          },
          heights: {
            eave_height_mm: { value: 3000 },
            ridge_height_mm: 42,
          },
        },
        faces: [
          {
            id: "wall-good",
            face_class: "wall",
            width_mm: { value: 5000 },
            height_mm: { value: 3000 },
            gable_height_mm: null,
          },
          {
            id: "wall-partial",
            face_class: "wall",
            width_mm: "bad dimension",
          },
        ],
        openings: [],
        edges: [],
        references: [{ photo_index: 1 }, "bad reference"],
        quality: { warnings: ["Keep me", 17] },
      },
      deDE.viewerNext,
    );

    expect(result.kind).toBe("viewer");
    if (result.kind !== "viewer") return;
    expect(result.derived.walls.faces).toHaveLength(2);
    expect(result.derived.walls.faces[0]?.gross_area_mm2.value).toBe(15_000_000);
    expect(result.derived.walls.faces[1]?.gross_area_mm2.value).toBeNull();
    expect(result.measurement.references).toEqual([{ photo_index: 1 }]);
    expect(result.measurement.quality?.warnings).toEqual([
      "Keep me",
      deDE.viewerNext.labels.omittedElements,
    ]);
  });

  it.each([enUS, deDE])("does not label a real partial project as test data", (dictionary) => {
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: dictionary === enUS ? "en-US" : "de-DE",
        dict: dictionary,
        children: createElement(ProjectViewer, {
        measurement: { meta: { schema_version: "1.6" } },
        projectName: "Real project",
        projectAddress: null,
        dict: dictionary.viewerNext,
        webglMessage: dictionary.viewer.webglFehler,
        }),
      }),
    );
    expect(html).toContain("Real project");
    expect(html).toContain(dictionary.viewerNext.labels.projectModelReady);
    expect(html).not.toContain(dictionary.viewerNext.labels.modelReady);
    expect(html).toContain("viewer-next-shell");
  });

  it.each([
    [enUS.viewerNext, enUS.viewer.webglFehler],
    [deDE.viewerNext, deDE.viewer.webglFehler],
  ])(
    "renders the exact localized older-version message without a model",
    (dict, webglMessage) => {
      const html = renderToStaticMarkup(
        createElement(ProjectViewer, {
          measurement: { meta: { schema_version: "1.5" } },
          projectName: "Altbau",
          projectAddress: "Musterstraße 1",
          dict,
          webglMessage,
        }),
      );

      expect(html).toContain('data-project-viewer-state="older-version"');
      expect(html).toContain(dict.projectMessages.olderVersion);
      expect(html).not.toContain("viewer-next-shell");
      expect(html).not.toContain("canvas");
    },
  );
});