import { describe, expect, it } from "vitest";
import { presentViewerWarnings } from "./warningPresentation";

const english = {
  approximatedLayout: "Some geometry uses inferred placement · verify on site.",
  omittedElements: "Some measured elements could not be placed and were omitted · verify on site.",
  missingDimensions: "Some elements are missing dimensions and use an approximate footprint · verify on site.",
  modelFailure: "The 3D model is unavailable; measurements remain available · verify on site.",
};

describe("viewer-next warning presentation", () => {
  it("keeps source warnings and summarizes model diagnostics without raw internals", () => {
    const warnings = presentViewerWarnings(
      ["Photo 3 is dark"],
      [
        { code: "geometry_omitted", category: "omission", ids: ["E-19"] },
        { code: "geometry_inferred", category: "inference", ids: ["W-1"] },
      ],
      [
        "AT-2: missing depth; represented with a measured-width footprint.",
        "E-19: no measured flashing geometry matches 3810 mm on roof; omitted rather than placed falsely.",
        "W-1: position inferred from its parent face and ordered openings.",
        "Aggregate ridge total is 21336 mm; visible ridge dimension uses the main physical segment 12192 mm.",
        "Overall envelope is 18897.6 mm; permanent width dimension remains the main footprint 12192 mm.",
      ],
      english,
    );

    expect(warnings).toEqual([
      "Photo 3 is dark",
      english.approximatedLayout,
      english.omittedElements,
      english.missingDimensions,
    ]);
    expect(warnings.join(" ")).not.toContain("21336");
    expect(warnings.join(" ")).not.toContain("AT-2");
    expect(warnings.join(" ")).not.toContain("mm");
  });

  it("discloses model build failure in a localized quality warning", () => {
    expect(presentViewerWarnings(
      [],
      [{ code: "model_build_failed", category: "model_failure", ids: [] }],
      ["Internal geometry error"],
      english,
    )).toEqual([english.modelFailure]);
  });

  it("limits model summaries to three localized one-line categories", () => {
    const german = {
      approximatedLayout: "Angenäherte Platzierung",
      omittedElements: "Ausgelassene Elemente",
      missingDimensions: "Fehlende Maße",
      modelFailure: "Modell nicht verfügbar",
    };
    const warnings = presentViewerWarnings(
      [],
      [],
      [
        "A: missing width.",
        "B: missing depth.",
        "C: unsupported face class fascia degraded to massing.",
        "D: no parent_face_id; positioned as an attached right addition.",
        "E: no measured placement; omitted.",
      ],
      german,
    );
    expect(warnings).toHaveLength(3);
    expect(warnings).toEqual([
      german.approximatedLayout,
      german.omittedElements,
      german.missingDimensions,
    ]);
  });
});