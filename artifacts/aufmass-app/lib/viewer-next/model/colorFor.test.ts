import { describe, expect, it } from "vitest";
import { colorFor, openingTypeColor } from "./buildModel";
import { viewerTokens } from "../tokens";

describe("measured colors and the proposed material palette", () => {
  it("preserves a measured hex even at low confidence, including secondary color", () => {
    expect(colorFor({ face_class: "wall", material: "brick",
      color: { hex: "#12aBcD", secondary_hex: "#112233", confidence: "low" } }))
      .toEqual({ hex: "#12aBcD", secondaryHex: "#112233", confidence: "low", neutral: false });
  });
  it.each([
    ["stucco", "#D9D2C5"], ["brick", "#9E5A44"], ["siding", "#C9CFD3"],
    ["wood", "#B08A5B"], ["concrete", "#B8B8B4"], ["eifs", "#E1DCD2"],
    ["unknown", "#CFCBC3"], ["other", "#CFCBC3"],
  ])("uses the wall palette for %s when measured color is absent", (material, hex) => {
    expect(colorFor({ face_class: "wall", material })).toMatchObject({ hex, neutral: false });
  });
  it.each([
    ["roof_face", "#4A4F55"], ["soffit", "#E8E6E1"], ["fascia", "#F2F1ED"],
  ])("chooses %s before material", (face_class, hex) => {
    expect(colorFor({ face_class, material: "brick", color: { hex: "not-hex", confidence: "low" } }))
      .toMatchObject({ hex, confidence: "low", neutral: false });
  });
  it("keeps invalid secondary hex out of measured colors", () => {
    expect(colorFor({ color: { hex: "#123456", secondary_hex: "#oops" } }).secondaryHex).toBeNull();
  });
  it("keeps the existing semantic opening colors and darker garage doors", () => {
    expect(openingTypeColor("garage_door").hex).toBe(viewerTokens.modelOpeningGarage);
    expect(openingTypeColor("door").hex).toBe(viewerTokens.modelOpeningDefault);
    const luminance = (hex: string) => [1, 3, 5].reduce((sum, p) => sum + parseInt(hex.slice(p, p + 2), 16), 0);
    expect(luminance(openingTypeColor("garage_door").hex)).toBeLessThan(luminance(openingTypeColor("door").hex));
  });
});
