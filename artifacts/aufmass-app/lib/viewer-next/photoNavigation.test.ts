import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerNextClient } from "@/components/viewer-next/ViewerNextClient";
import { enUS } from "@/i18n/en-US";
import { prepareProjectMeasurement } from "./projectMeasurement";

// A component-level event test, not a browser/geometry test. Keep the production
// component and row button; only hooks are held at a deterministic expanded state.
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      const value = typeof initial === "function" ? initial() : initial;
      return [value instanceof Set ? new Set(["photo-fixture"]) : value, vi.fn()];
    },
    useMemo: (factory: () => unknown) => factory(),
    useEffect: () => undefined,
    useRef: (current: unknown) => ({ current }),
  };
});
function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children as React.ReactNode)];
}
function component(uploadHref?: string) {
  const fixture = JSON.parse(readFileSync("fixtures/garage-house.json", "utf8"));
  const prepared = prepareProjectMeasurement(fixture, enUS.viewerNext);
  if (prepared.kind !== "viewer") throw new Error("Fixture unreadable");
  return ViewerNextClient({
    measurement: prepared.measurement, derived: prepared.derived, dict: enUS.viewerNext,
    cards: [{ ...prepared.cards[0], id: "photo-fixture", rows: [{
      id: "photo-fixture", label: "Not captured", value: "—", cta: enUS.viewerNext.labels.addPhoto,
    }] }],
    uploadHref,
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("both production Add photo controls", () => {
  it("routes both the header button and missing-elevation row button to the same real project upload path", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const href = "/app/projekt/11111111-1111-4111-8111-111111111111/upload";
    const tree = elements(component(href));
    const header = tree.find(node => String(node.props.className).includes("viewer-next-add-photo"))!;
    expect(header).toBeDefined();
    expect(header.props.disabled).toBe(false);
    (header.props.onClick as () => void)();
    const row = tree.find(node => (node.props.row as { cta?: string } | undefined)?.cta)!;
    expect(row).toBeDefined();
    const renderRow = row.type as (props: Record<string, unknown>) => React.ReactNode;
    // The CTA is displayed inside the clickable row, not a separate nested button.
    const photo = elements(renderRow(row.props)).find(node => typeof node.props.onClick === "function")!;
    expect(photo).toBeDefined();
    (photo.props.onClick as (event: unknown) => void)({ stopPropagation: vi.fn() });
    expect(assign.mock.calls).toEqual([[href], [href]]);
  });
  it("never invents an upload destination when a fixture has no project ID", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    const header = elements(component()).find(node => String(node.props.className).includes("viewer-next-add-photo"))!;
    expect(header.props.disabled).toBe(true);
    (header.props.onClick as () => void)();
    expect(assign).not.toHaveBeenCalled();
  });
});
