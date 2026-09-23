import { describe, expect, it } from "vitest";
import { schaetzeKostenUsd } from "./modelle";

describe("AI cost estimation prices", () => {
  it("uses the verified exact-model base rates", () => {
    expect(schaetzeKostenUsd("premium", 1_000_000, 0)).toBe(10);
    expect(schaetzeKostenUsd("premium", 0, 1_000_000)).toBe(50);
    expect(schaetzeKostenUsd("standard", 1_000_000, 0)).toBe(3);
    expect(schaetzeKostenUsd("standard", 0, 1_000_000)).toBe(15);
  });

  it("keeps fractional per-run token arithmetic", () => {
    expect(schaetzeKostenUsd("premium", 36_450, 39_601)).toBe(2.34455);
    expect(schaetzeKostenUsd("standard", 1, 1)).toBe(0.000018);
  });
});