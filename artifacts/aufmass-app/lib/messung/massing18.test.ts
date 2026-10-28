import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { heileNullFelder } from "./berechnung";
import { buildModel } from "@/lib/viewer-next/model/buildModel";

// Parsing a saved response must not initialize storage or call a model.
vi.mock("@/lib/storage/objectStorage", () => ({}));
import { parseTolerant } from "./echterExtraktor";

const FIXTURES = [
  "farmhouse-140040rk",
  "farmhouse-test5-beispiel",
  "leipzig-villa",
  "triplex-40014db",
  "tudor-93233el",
] as const;

describe.each(FIXTURES)("massing preservation: %s", (name) => {
  const load = () => JSON.parse(readFileSync(`test-fixtures/variante-a/${name}/messung.json`, "utf8"));

  it("retains the whole object through tolerant parsing", () => {
    const measurement = load();
    expect(parseTolerant(`\`\`\`json\n${JSON.stringify(measurement)}\n\`\`\``)).toEqual(measurement);
  });

  it("retains massing while healing an unrelated null field", () => {
    const measurement = load();
    const massing = structuredClone(measurement.massing);
    measurement._healingProbe = null;
    expect(heileNullFelder(measurement, [
      { instancePath: "/_healingProbe", message: "must be string" },
    ])).toBe(1);
    expect(measurement).not.toHaveProperty("_healingProbe");
    expect(measurement.massing).toEqual(massing);
  });

  it("keeps the existing viewer behavior, ignoring the additional massing key", () => {
    const measurement = load();
    const withoutMassing = structuredClone(measurement);
    delete withoutMassing.massing;
    let model: ReturnType<typeof buildModel> | undefined;
    expect(() => { model = buildModel(measurement); }).not.toThrow();
    expect(model).toEqual(buildModel(withoutMassing));
  });
});
