import { describe, expect, it } from "vitest";
import { formatTallyValue, groupTally, toggleTallyItem } from "./calc";

describe("viewer calc tally", () => {
  const roof = (id: string, value: number, unit: "sq ft" | "LF" | "EA") => ({
    id,
    label: id,
    value,
    unit,
    semanticClass: "roof",
  });

  it("groups only by semantic class and unit", () => {
    expect(
      groupTally([
        roof("RF-1", 612, "sq ft"),
        roof("RF-2", 598, "sq ft"),
        { ...roof("E-1", 12, "LF"), semanticClass: "roof" },
        { ...roof("W-1", 612, "sq ft"), semanticClass: "walls" },
      ]),
    ).toEqual([
      { semanticClass: "roof", unit: "sq ft", value: 1210 },
      { semanticClass: "roof", unit: "LF", value: 12 },
      { semanticClass: "walls", unit: "sq ft", value: 612 },
    ]);
  });

  it("toggles a row without treating zero as null", () => {
    const item = roof("zero", 0, "EA");
    expect(toggleTallyItem([], item)).toEqual([item]);
    expect(toggleTallyItem([item], item)).toEqual([]);
  });

  it("formats totals without parsing display strings", () => {
    expect(formatTallyValue(1210, "sq ft")).toBe("1,210");
    expect(formatTallyValue(1346.000023, "sq ft")).toBe("1,346");
    expect(formatTallyValue(63, "LF")).toBe(`63' 0"`);
  });
});
