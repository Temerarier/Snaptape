import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectViewer } from "@/components/viewer-next/ProjectViewer";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { enUS } from "@/i18n/en-US";
import { deDE } from "@/i18n/de-DE";
import { loadTestHouse } from "@/app/viewer-next/testHouses";
import type { Model3dStatus } from "./model/fromModel3d";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

async function render(status: Model3dStatus, dict = enUS) {
  const { measurement, model3d } = await loadTestHouse("leipzig-villa");
  return renderToStaticMarkup(createElement(LocaleProvider, {
    locale: dict === enUS ? "en-US" : "de-DE", dict,
    children: createElement(ProjectViewer, {
      measurement, model3d: status === "ready" ? model3d : null,
      model3dStatus: status, projectName: "Viewer state acceptance",
      projectAddress: null, dict: dict.viewerNext, webglMessage: dict.viewer.webglFehler,
    }),
  }));
}
describe("project viewer model states", () => {
  it.each([enUS, deDE])("pending: visible measurement panel, localized viewport status, no old model", async dict => {
    const html = await render("pending", dict);
    expect(html).toContain('data-model3d-state="pending"');
    expect(html).toContain(dict.viewerNext.model3dPending);
    expect(html).toContain("viewer-next-panel");
    expect(html).not.toContain("<canvas");
  });
  it.each([enUS, deDE])("unavailable: keeps panel, no misleading fallback geometry", async dict => {
    const html = await render("unavailable", dict);
    expect(html).toContain(dict.viewerNext.model3dUnavailable);
    expect(html).toContain('data-model3d-state="unavailable"');
    expect(html).toContain("viewer-next-panel");
    expect(html).not.toContain("<canvas");
  });
  it("ready renders A viewport; old projects still use the original model", async () => {
    const html = await render("ready");
    expect(html).toContain('data-geometry-source="model3d"');
    expect(html).toContain("<canvas");
    expect(await render(null)).toContain('data-geometry-source="buildModel"');
  });
  it("status changes do not change any numeric panel values", async () => {
    const ready = await render("ready"), pending = await render("pending"), unavailable = await render("unavailable");
    const panel = (html: string) => html.slice(html.indexOf('data-viewer-panel-scroll'))
      .split("</aside>")[0]!.match(/>[^<>]*\d[^<>]*</g);
    expect(panel(ready)).not.toBeNull();
    expect(panel(pending)).toEqual(panel(ready));
    expect(panel(unavailable)).toEqual(panel(ready));
  });
});
