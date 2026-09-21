import { describe, expect, it } from "vitest";
import type { ViewerCard } from "./viewerCards";
import {
  DEFAULT_SHOW_DIMENSIONS,
  revealSelection,
} from "../../components/viewer-next/ViewerNextClient";

const cards: ViewerCard[] = [
  {
    id: "roof_area",
    title: "ROOF AREA",
    hero: "1",
    heroUnit: "sq ft",
    accentClass: "",
    rows: [{ id: "RF-1", label: "Front (RF-1)", value: "1" }],
  },
  {
    id: "openings",
    title: "OPENINGS",
    hero: "1",
    heroUnit: "EA",
    accentClass: "",
    rows: [{
      id: "op_window",
      label: "Windows",
      hasSub: true,
      subRows: [{ id: "W-1", label: "W-1", value: "1" }],
    }],
  },
];

describe("viewer-next panel selection reveal", () => {
  it("defaults permanent dimensions on", () => {
    expect(DEFAULT_SHOW_DIMENSIONS).toBe(true);
  });

  it("opens every ancestor and switches an incompatible trade filter", () => {
    expect(revealSelection(cards, "W-1", "roofing")).toEqual({
      cardId: "openings",
      rowIds: ["op_window", "W-1"],
      filter: "all",
    });
  });

  it("keeps a compatible filter while still returning row ancestors", () => {
    expect(revealSelection(cards, "RF-1", "roofing")).toEqual({
      cardId: "roof_area",
      rowIds: ["RF-1"],
      filter: "roofing",
    });
  });
});