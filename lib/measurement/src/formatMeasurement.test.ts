import { describe, expect, it } from "vitest";

import {
  formatFeetInches,
  formatInches,
  formatSquareFeet,
  formatSquares,
  mm2ToSquareFeet,
  mm2ToSquares,
  mmToInches,
} from "./formatMeasurement";

describe("measurement conversions", () => {
  it("uses the exact length and area conversion constants", () => {
    expect(mmToInches(25.4)).toBe(1);
    expect(mmToInches(12 * 25.4)).toBe(12);
    expect(mm2ToSquareFeet(92903.04)).toBe(1);
    expect(mm2ToSquares(92903.04 * 100)).toBe(1);
  });

  it("formats the golden roof area as square feet and squares", () => {
    const roofAreaMm2 = 194817674.8;

    expect(formatSquareFeet(mm2ToSquareFeet(roofAreaMm2))).toBe("2097 sq ft");
    expect(formatSquares(mm2ToSquares(roofAreaMm2))).toBe("21.0 SQ");
  });
});

describe("measurement formatting", () => {
  it("uses explicit units and documented defaults", () => {
    expect(formatFeetInches(73)).toBe(`6' 1"`);
    expect(formatSquareFeet(2097.4)).toBe("2097 sq ft");
    expect(formatSquares(21)).toBe("21.0 SQ");
    expect(formatInches(12)).toBe(`12.0"`);
  });

  it("carries rounded inches into feet", () => {
    expect(formatFeetInches(11.999)).toBe(`1' 0"`);
    expect(formatFeetInches(11.999, 2)).toBe(`1' 0.00"`);
    expect(formatFeetInches(23.456, 2)).toBe(`1' 11.46"`);
  });

  it("supports fractional precision from zero through six places", () => {
    expect(formatFeetInches(14.125, 3)).toBe(`1' 2.125"`);
    expect(formatSquareFeet(12.34567, 4)).toBe("12.3457 sq ft");
    expect(formatSquares(1.23456789, 6)).toBe("1.234568 SQ");
    expect(formatInches(1.23456, 4)).toBe(`1.2346"`);
  });

  it("renders null as an em dash", () => {
    expect(formatFeetInches(null)).toBe("—");
    expect(formatSquareFeet(null)).toBe("—");
    expect(formatSquares(null)).toBe("—");
    expect(formatInches(null)).toBe("—");
  });

  it("rejects nonfinite values", () => {
    expect(() => mmToInches(Number.NaN)).toThrow();
    expect(() => mm2ToSquareFeet(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => mm2ToSquares(Number.NEGATIVE_INFINITY)).toThrow();
    expect(() => formatFeetInches(Number.NaN)).toThrow();
    expect(() => formatSquareFeet(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => formatSquares(Number.NEGATIVE_INFINITY)).toThrow();
    expect(() => formatInches(Number.NaN)).toThrow();
  });

  it("rejects precision outside the integer range zero through six", () => {
    for (const precision of [-1, 7, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatFeetInches(null, precision)).toThrow();
      expect(() => formatSquareFeet(1, precision)).toThrow();
    }
  });

  it("formats negative values without negative zero", () => {
    expect(formatFeetInches(-18)).toBe(`-1' 6"`);
    expect(formatFeetInches(-11.999)).toBe(`-1' 0"`);
    expect(formatFeetInches(-0)).toBe(`0' 0"`);
    expect(formatInches(-12.34, 1)).toBe(`-12.3"`);
    expect(formatInches(-0.04, 1)).toBe(`0.0"`);
    expect(formatSquareFeet(-0.4)).toBe("0 sq ft");
    expect(formatSquares(-0.04)).toBe("0.0 SQ");
  });
});