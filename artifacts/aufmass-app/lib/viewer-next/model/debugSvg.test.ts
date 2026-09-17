import { describe, expect, it } from "vitest";
import fixture from "../../../../../fixtures/garage-house.json";
import { buildModel } from "./index";
import { renderDebugSvg } from "./debugSvg";

function polygonCoordinates(svg: string, id: string): Array<[number, number]> {
  const match = svg.match(new RegExp(`<polygon id="${id}"[^>]* points="([^"]+)"`));
  if (!match) return [];
  return match[1].split(" ").map(pair => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y];
  });
}

describe("viewer-next debug SVG", () => {
  it("projects front and side elevations from the model output with stable ids", () => {
    const svg = renderDebugSvg(buildModel(fixture));

    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('id="front-elevation"');
    expect(svg).toContain('id="side-elevation"');
    expect(svg).toContain('data-model-id="WL-1"');
    expect(svg).toContain('data-model-id="WL-5"');
    expect(svg).toContain('data-model-id="G-1"');
    expect(svg).toContain('data-model-id="SK-1"');
    expect(svg).toContain('data-model-id="RF-6"');
    expect(svg).toContain('data-dimension-label="width">40&apos; 0&quot;</text>');
    expect(svg).toContain('data-dimension-label="ridge">40&apos; 0&quot;</text>');
    expect(svg).toContain('data-dimension-label="ridge-aggregate">70&apos; 0&quot;</text>');
  });

  it("keeps z upright and allocates front and side to separate columns", () => {
    const svg = renderDebugSvg(buildModel(fixture));
    const frontWall = polygonCoordinates(svg, "front-WL-1");
    const sideWall = polygonCoordinates(svg, "side-WL-4");
    const frontX = frontWall.map(([x]) => x);
    const sideX = sideWall.map(([x]) => x);

    expect(Math.min(...frontX)).toBeGreaterThanOrEqual(48);
    expect(Math.max(...frontX)).toBeLessThan(450);
    expect(Math.min(...sideX)).toBeGreaterThanOrEqual(450);
    expect(Math.max(...sideX)).toBeLessThanOrEqual(852);
    expect(Math.max(...frontWall.map(([, y]) => y))).toBeGreaterThan(Math.min(...frontWall.map(([, y]) => y)));
    expect(Math.min(...polygonCoordinates(svg, "front-RF-1").map(([, y]) => y)))
      .toBeLessThan(Math.min(...frontWall.map(([, y]) => y)));
  });

  it("keeps the garage roof eaves on both garage wall tops", () => {
    const model = buildModel(fixture);
    const frontGarage = model.walls.find(wall => wall.id === "WL-5")!;
    const sideGarage = model.walls.find(wall => wall.id === "WL-6")!;
    const garageRoofs = model.roofFaces.filter(face => face.id === "RF-5" || face.id === "RF-6");

    expect(garageRoofs).toHaveLength(2);
    expect(garageRoofs.every(roof => roof.bounds.min.z <= frontGarage.bounds.max.z + 1e-6)).toBe(true);
    expect(garageRoofs.every(roof => roof.bounds.min.z <= sideGarage.bounds.max.z + 1e-6)).toBe(true);
    expect(model.openings.find(opening => opening.id === "G-1")?.bounds.max.x)
      .toBeLessThanOrEqual(frontGarage.bounds.max.x + 1e-6);
  });
});
