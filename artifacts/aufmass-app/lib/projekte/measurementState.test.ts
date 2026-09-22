import { describe, expect, it } from "vitest";
import { projectMeasurementState } from "./measurementState";

describe("projectMeasurementState", () => {
  it("polls only for an active processing project", () => {
    expect(projectMeasurementState("processing")).toBe("processing");
  });

  it("keeps failed and ready projects in their explicit states", () => {
    expect(projectMeasurementState("failed")).toBe("failed");
    expect(projectMeasurementState("model_ready")).toBe("ready");
  });

  it.each(["draft", "files_uploaded", "classified", "reviewing", "ready"])(
    "does not present %s as an active measurement",
    (status) => {
      expect(projectMeasurementState(status)).toBe("unavailable");
    },
  );
});