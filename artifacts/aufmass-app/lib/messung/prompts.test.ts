import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baueRepairSystemText, baueSystemText } from "./prompts";

const schema = readFileSync("shared/schema/measurement-v1.8.json", "utf8");

describe("verbatim schema 1.8 and extraction prompts", () => {
  it.each([
    "shared/schema/measurement-v1.8.json",
    "docs/pipeline/extract-photo-prompt.md",
    "docs/pipeline/extract-plan-prompt.md",
    "docs/pipeline/extract-mixed-prompt.md",
  ])("%s is byte-identical to the handover package", (path) => {
    expect(readFileSync(path)).toEqual(readFileSync(`variante-a-paket/${path}`));
  });

  it.each(["photo", "plan", "mixed"] as const)("%s appends the exact v1.8 schema", (route) => {
    const system = baueSystemText(route, null);
    expect(system.endsWith(schema)).toBe(true);
    expect(system).toContain("SCHEMA (fill exactly this JSON schema):");
  });

  it("replaces the generic repair placeholder with the exact schema", () => {
    const repair = baueRepairSystemText();
    expect(repair).toContain(schema);
    expect(repair).not.toContain("__SCHEMA__");
    expect(repair).not.toContain("__SCHEMA_V1_7__");
    expect(repair).not.toContain("(Runtime note");
  });

  it("retains the existing user-reference instructions", () => {
    const system = baueSystemText("photo", { objekt: "Door", wert: 80, einheit: "inch" });
    expect(system).toContain(schema);
    expect(system).toContain("USER REFERENCE: Door = 80 inch (2032 mm)");
    expect(system).toContain("scale_type \"user_provided\"");
  });
});
