import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { computeDerived } from "./computeDerived";
import { validateMeasurement } from "./validateMeasurement";

const FIXTURES = [
  "farmhouse-140040rk",
  "farmhouse-test5-beispiel",
  "leipzig-villa",
  "triplex-40014db",
  "tudor-93233el",
] as const;

describe.each(FIXTURES)("schema 1.8: %s", (name) => {
  const relativePath = `test-fixtures/variante-a/${name}/messung.json`;
  const load = () => JSON.parse(readFileSync(resolve(relativePath), "utf8"));

  it("validates the unchanged handover fixture, including massing", () => {
    expect(readFileSync(resolve(relativePath))).toEqual(
      readFileSync(resolve("variante-a-paket", relativePath)),
    );
    const measurement = load();
    expect(measurement.meta.schema_version).toBe("1.8");
    expect(measurement.massing.bodies.length).toBeGreaterThan(0);
    expect(validateMeasurement(measurement)).toEqual({ valid: true, errors: [] });
  });

  it("computes existing quantities without consuming or modifying massing", () => {
    const measurement = load();
    const before = JSON.stringify(measurement);
    const withoutMassing = structuredClone(measurement);
    delete withoutMassing.massing;
    let derived: ReturnType<typeof computeDerived> | undefined;
    expect(() => { derived = computeDerived(measurement); }).not.toThrow();
    expect(derived).toEqual(computeDerived(withoutMassing));
    expect(JSON.stringify(measurement)).toBe(before);
  });
});
