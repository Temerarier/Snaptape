// Contract tests for shared/schema/measurement-v1.7.json (docs/plan.md, Step 0).
// The fixture fixtures/garage-house.json is the canonical example house and
// must always validate; a misclassified material must always fail.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateMeasurement } from "./validateMeasurement";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturePath = join(repoRoot, "fixtures", "garage-house.json");

interface FixtureFace {
  id: string;
  face_class: string;
  material: string | null;
}

interface Fixture {
  meta: { schema_version: string };
  faces: FixtureFace[];
}

function loadFixture(): Fixture {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
}

describe("measurement contract v1.7", () => {
  it("validates the garage-house fixture against the schema (Test 1)", () => {
    const { valid, errors } = validateMeasurement(loadFixture());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it("rejects material 'brick' on a roof_face via the if/then rules (Test 2)", () => {
    const mutated = loadFixture();
    const roofFace = mutated.faces.find((f) => f.face_class === "roof_face");
    if (!roofFace) throw new Error("fixture contains no roof_face");
    roofFace.material = "brick";

    const { valid, errors } = validateMeasurement(mutated);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    // Pin the conditional semantics: the violation must target the mutated
    // face's material property (the if/then branch), not just any failure.
    const faceIndex = mutated.faces.indexOf(roofFace);
    expect(
      errors.some((e) => e.instancePath === `/faces/${faceIndex}/material`),
    ).toBe(true);
  });

  it("v1.7: fixture links the garage roof facets to the garage attachment", () => {
    const fixture = loadFixture() as unknown as { faces: Array<Record<string, unknown>> };
    const linked = fixture.faces.filter((f) => f.parent_attachment_id === "AT-7").map((f) => f.id);
    expect(linked).toEqual(["RF-5", "RF-6"]);
  });

  it("v1.7: rejects a parent_attachment_id that is not an AT-n id", () => {
    const mutated = loadFixture() as unknown as { faces: Array<Record<string, unknown>> };
    const roofFace = mutated.faces.find((f) => f.face_class === "roof_face");
    if (!roofFace) throw new Error("fixture contains no roof_face");
    roofFace.parent_attachment_id = "WL-4";
    const { valid, errors } = validateMeasurement(mutated);
    expect(valid).toBe(false);
    const faceIndex = mutated.faces.indexOf(roofFace);
    expect(errors.some((e) => e.instancePath === `/faces/${faceIndex}/parent_attachment_id`)).toBe(true);
  });

  it("returns {valid, errors} without throwing on junk input", () => {
    const result = validateMeasurement({ hello: "world" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validates v1.6 with its own schema instead of the v1.7 contract", () => {
    const fixture = loadFixture() as unknown as {
      meta: { schema_version: string };
      faces: Array<Record<string, unknown>>;
    };
    fixture.meta.schema_version = "1.6";
    fixture.faces[0]!.parent_attachment_id = "not-an-attachment-id";

    expect(validateMeasurement(fixture)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an unknown schema version", () => {
    const fixture = loadFixture();
    fixture.meta.schema_version = "0.9";

    const result = validateMeasurement(fixture);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (error) =>
          error.instancePath === "/meta/schema_version" &&
          error.keyword === "const",
      ),
    ).toBe(true);
  });
});
