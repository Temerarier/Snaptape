import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enUS } from "@/i18n/en-US";
import { deDE } from "@/i18n/de-DE";
import { MEASUREMENT_DISCLAIMER } from "@/lib/config/haftung";
import { prepareProjectMeasurement } from "./projectMeasurement";
import { escapeHtml, panelValueStrings, renderPrintSheet } from "./printSheet";

const fixture = JSON.parse(readFileSync("fixtures/garage-house.json", "utf8"));
const input = {
  measurement: fixture, name: "Garage house", address: "Fixture", date: "October 28, 2026",
  fileCount: 0, locale: "en-US" as const, dict: enUS.viewerNext, nonce: "test-nonce", preview: true,
};
describe("measurement sheet", () => {
  it("reuses every formatted viewer card and every nested value in order", () => {
    const prepared = prepareProjectMeasurement(fixture, enUS.viewerNext);
    expect(prepared.kind).toBe("viewer");
    if (prepared.kind !== "viewer") throw new Error("fixture must prepare");
    const html = renderPrintSheet(input)!;
    const values = [...html.matchAll(/data-panel-value>([^<]*)</g)].map(match => match[1]);
    for (const value of panelValueStrings(prepared.cards)) expect(values).toContain(escapeHtml(value));
    const titles = [...html.matchAll(/data-card-id="([^"]+)"/g)].map(match => match[1]);
    expect(titles).toEqual(prepared.cards.map(card => card.id));
    expect(html).toContain("2097");
    expect(html).toContain("21.0");
    expect(html).toContain("2779");
    expect(html).toContain(escapeHtml("118' 0\""));
    expect(html).toContain(escapeHtml("70' 0\""));
  });
  it("contains the verbatim disclaimer and no private billing/model UI or 3D canvas", () => {
    const html = renderPrintSheet(input)!;
    expect(html).toContain(MEASUREMENT_DISCLAIMER);
    expect(html).not.toMatch(/credit|opus|claude|\$|<canvas|__next_f|model3dReport|ai_code/i);
    expect(html).toContain("counter(page)");
    expect(html).toContain("/legal/terms");
  });
  it("escapes project names, addresses and source warnings rather than executing HTML", () => {
    const html = renderPrintSheet({
      ...input, name: "<script>alert(1)</script>", address: '<img src=x onerror="bad()">',
      measurement: { ...fixture, quality: { ...fixture.quality, warnings: ["<script>BAD</script>"] } },
    })!;
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;BAD&lt;/script&gt;");
  });
  it("prints only once on load, but never automatically in preview mode", () => {
    expect(renderPrintSheet(input)).not.toContain("window.addEventListener('load'");
    expect(renderPrintSheet({ ...input, preview: false })).toContain("window.addEventListener('load',()=>window.print(),{once:true})");
    expect(renderPrintSheet(input)).toContain("addEventListener('click',()=>window.print())");
  });
  it("localizes labels but keeps the legal disclaimer unchanged", () => {
    const html = renderPrintSheet({ ...input, locale: "de-DE", dict: deDE.viewerNext })!;
    expect(html).toContain('lang="de"');
    expect(html).toContain("Messblatt");
    expect(html).toContain("Drucken / Als PDF speichern");
    expect(html).toContain(MEASUREMENT_DISCLAIMER);
    expect(deDE.viewerNext.disclaimer).toBe(enUS.viewerNext.disclaimer);
  });
  it("does not fabricate a sheet for unreadable data", () => {
    expect(renderPrintSheet({ ...input, measurement: null })).toBeNull();
  });
});
