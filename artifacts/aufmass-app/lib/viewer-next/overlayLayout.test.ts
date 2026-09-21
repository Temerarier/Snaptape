import { describe, expect, it } from "vitest";
import { computeDerived } from "@workspace/measurement";
import type { MeasurementInput } from "@workspace/measurement";
import * as THREE from "three";
import fixture from "../../../../fixtures/garage-house.json";
import { buildModel } from "./model";
import { convexHull, dimensionRails, layoutLabels, overlapArea, screenBounds, silhouetteOverlap, visiblePermanentDimensions } from "./overlayLayout";

describe("screen-space overlay layout", () => {
  const silhouette = [{ x: 150, y: 130 }, { x: 340, y: 130 }, { x: 340, y: 310 }, { x: 150, y: 310 }];
  it("clamps first, then avoids controls, the silhouette and higher priority labels", () => {
    const obstacles = [{ left: 450, top: 0, right: 500, bottom: 180 }];
    const placed = layoutLabels({
      viewport: { width: 500, height: 400 }, silhouette, obstacles,
      labels: [
        { id: "permanent", width: 100, height: 30, preferred: { x: 470, y: 140 }, priority: 2 },
        { id: "selection", width: 140, height: 90, preferred: { x: 470, y: 140 }, priority: 1 },
        { id: "transient", width: 120, height: 40, preferred: { x: 470, y: 140 }, priority: 0 },
      ],
    });
    expect(placed.map(label => label.id)).toEqual(["transient", "selection", "permanent"]);
    placed.forEach((label, index) => {
      expect(label.left).toBeGreaterThanOrEqual(4);
      expect(label.top).toBeGreaterThanOrEqual(4);
      expect(label.right).toBeLessThanOrEqual(496);
      expect(label.bottom).toBeLessThanOrEqual(396);
      expect(label.conflicts).toEqual([]);
      expect(silhouetteOverlap(label, silhouette)).toBe(0);
      [...obstacles, ...placed.slice(0, index)].forEach(other => expect(overlapArea(label, other)).toBe(0));
    });
  });
  it("reports impossible projections instead of hiding labels or shrinking text", () => {
    const placed = layoutLabels({
      viewport: { width: 100, height: 80 },
      silhouette: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }],
      obstacles: [],
      labels: [
        { id: "selection", width: 120, height: 90, preferred: { x: 50, y: 50 }, priority: 1 },
        { id: "width", width: 70, height: 28, preferred: { x: 50, y: 70 }, priority: 2, region: "below" },
      ],
    });
    expect(placed).toHaveLength(2);
    expect(placed[0].conflicts).toContain("viewport too small");
    expect(placed[1].conflicts).toContain("higher-priority label");
    expect(placed[1].conflicts).toContain("no room below model");
    expect(placed[0].right - placed[0].left).toBe(120);
  });
  it("uses the polygon silhouette, not its unnecessarily large bounding rectangle", () => {
    const hull = convexHull([{ x: 0, y: 200 }, { x: 200, y: 0 }, { x: 400, y: 200 }, { x: 200, y: 400 }]);
    expect(silhouetteOverlap({ left: 0, top: 0, right: 40, bottom: 40 }, hull)).toBe(0);
    expect(silhouetteOverlap({ left: 180, top: 180, right: 220, bottom: 220 }, hull)).toBe(1600);
  });

  it("draws depth on a projected ground rail parallel to its measured edge", () => {
    const source = { start: { x: 120, y: 220 }, end: { x: 205, y: 115 } };
    const rails = dimensionRails(
      { left: 80, top: 60, right: 330, bottom: 260 },
      [{ id: "depth", ...source, width: 72, height: 28 }],
      { width: 390, height: 330 },
      convexHull([
        { x: 80, y: 190 },
        { x: 180, y: 60 },
        { x: 330, y: 120 },
        { x: 280, y: 260 },
      ]),
    );
    const rail = rails.strokes.find(
      stroke => stroke.dimensionId === "depth" && !stroke.dashed &&
        Math.hypot(stroke.end.x - stroke.start.x, stroke.end.y - stroke.start.y) > 8,
    )!;
    const sourceVector = {
      x: source.end.x - source.start.x,
      y: source.end.y - source.start.y,
    };
    const railVector = {
      x: rail.end.x - rail.start.x,
      y: rail.end.y - rail.start.y,
    };

    expect(sourceVector.x * railVector.y - sourceVector.y * railVector.x)
      .toBeCloseTo(0, 8);
    expect(rails.strokes.filter(stroke =>
      stroke.dimensionId === "depth" && stroke.dashed,
    )).toHaveLength(2);
    expect(rails.strokes.some(stroke => stroke.dimensionId === "ridge")).toBe(false);
  });

  const model = buildModel(
    fixture,
    computeDerived(fixture as unknown as MeasurementInput),
  );
  it("gates all permanent reservations while leaving contextual requests available", () => {
    expect(visiblePermanentDimensions(model.permanentDimensions, true).map(item => item.id))
      .toEqual(["length", "depth", "eave"]);
    const hidden = visiblePermanentDimensions(model.permanentDimensions, false);
    expect(hidden).toEqual([]);
    const hiddenRails = dimensionRails(
      { left: 80, top: 60, right: 330, bottom: 260 },
      hidden.map(({ id, dimension }) => ({
        id,
        width: 80,
        height: 28,
        start: dimension.segments[0].start,
        end: dimension.segments[0].end,
      })),
      { width: 390, height: 330 },
    );
    expect(hiddenRails.labels).toEqual([]);
    expect(hiddenRails.strokes).toEqual([]);

    const contextual = layoutLabels({
      viewport: { width: 390, height: 330 },
      silhouette: convexHull([
        { x: 80, y: 90 },
        { x: 300, y: 90 },
        { x: 300, y: 250 },
        { x: 80, y: 250 },
      ]),
      obstacles: [],
      labels: [
        { id: "measure-0", width: 70, height: 28, priority: 0, preferred: { x: 8, y: 8 } },
        { id: "condition-CA-1", width: 120, height: 48, priority: 1, preferred: { x: 8, y: 48 } },
        { id: "selection", width: 120, height: 70, priority: 1, preferred: { x: 8, y: 104 } },
      ],
    });
    expect(contextual.map(item => item.id)).toEqual([
      "measure-0",
      "condition-CA-1",
      "selection",
    ]);
  });
  const bounds = model.bounds.overall;
  const centre = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, Math.max(0, (bounds.min.z + bounds.max.z) / 2));
  const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
  const points = [...model.walls, ...model.roofFaces, ...model.openings, ...model.attachments, ...model.massing].flatMap(part => part.corners);
  it.each([[375, 260], [390, 330], [768, 440], [544, 650], [960, 880]])(
    "fits ordinary permanent labels without constraints at %i×%i",
    (width, height) => {
      const camera = new THREE.PerspectiveCamera(38, width / height, 1, 1000000);
      camera.up.set(0, 0, 1);
      camera.position.copy(centre).add(new THREE.Vector3(1.28, -1.52, 0.82).multiplyScalar(span));
      camera.lookAt(centre);
      camera.updateMatrixWorld(true);
      const project = (point: { x: number; y: number; z: number }) => {
        const p = new THREE.Vector3(point.x, point.y, point.z).project(camera);
        return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
      };
      const hull = convexHull(points.map(project));
      const dimensions = [
        { id: "length" as const, dimension: model.permanentDimensions.length! },
        { id: "depth" as const, dimension: model.permanentDimensions.depth! },
        { id: "eave" as const, dimension: model.permanentDimensions.eaveHeight },
      ].filter(item => item.dimension && item.dimension.segments.length);
      const rails = dimensionRails(screenBounds(hull), dimensions.map(({ id, dimension }) => ({
        id, width: width < 768 ? 80 : 94, height: width < 768 ? 27 : 31,
        start: project(dimension!.segments[0].start), end: project(dimension!.segments[0].end),
      })), { width, height }, hull);
      for (const id of ["length", "depth"] as const) {
        const rail = rails.strokes
          .filter(stroke => stroke.dimensionId === id && !stroke.dashed)
          .sort((a, b) =>
            Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) -
            Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y),
          )[0];
        const source = dimensions.find(item => item.id === id)!.dimension!.segments[0];
        const projectedStart = project(source.start);
        const projectedEnd = project(source.end);
        const sourceVector = {
          x: projectedEnd.x - projectedStart.x,
          y: projectedEnd.y - projectedStart.y,
        };
        const normal = { x: -sourceVector.y, y: sourceVector.x };
        const railProjection = rail.start.x * normal.x + rail.start.y * normal.y;
        const hullProjections = hull.map(point => point.x * normal.x + point.y * normal.y);
        expect(
          railProjection < Math.min(...hullProjections) ||
          railProjection > Math.max(...hullProjections),
          `${width}×${height} ${id} rail crossed the projected silhouette`,
        ).toBe(true);
      }
      const obstacles = [{ left: width - 56, top: 12, right: width - 12, bottom: 156 }];
      const placed = layoutLabels({ viewport: { width, height }, silhouette: hull, obstacles, labels: rails.labels });
      expect(placed.flatMap(label => label.conflicts), JSON.stringify({ bounds: screenBounds(hull), placed })).toEqual([]);
    },
  );
  for (const [width, height] of [[390, 260], [768, 400], [544, 620], [960, 720]]) {
    for (const [name, offset] of [
      ["initial", [1.28, -1.52, 0.82]], ["rear", [-1.28, 1.52, 0.12]], ["underneath", [0.8, -1, -0.8]],
    ] as const) {
      it(`contains all measured-size labels or explicitly reports constraints at ${width}×${height}, ${name}`, () => {
        // These are the production camera FOV, near/far and initial offset.
        // Rear/underneath cases explicitly retain unrestricted orbit.
        const camera = new THREE.PerspectiveCamera(38, width / height, 1, 1000000);
        camera.up.set(0, 0, 1);
        camera.position.copy(centre).add(new THREE.Vector3(...offset).multiplyScalar(span));
        camera.lookAt(centre);
        camera.updateMatrixWorld(true);
        const project = (point: { x: number; y: number; z: number }) => {
          const p = new THREE.Vector3(point.x, point.y, point.z).project(camera);
          return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
        };
        const hull = convexHull(points.map(project));
        const dimensions = [
          { id: "length" as const, dimension: model.permanentDimensions.length! },
          { id: "depth" as const, dimension: model.permanentDimensions.depth! },
          { id: "eave" as const, dimension: model.permanentDimensions.eaveHeight },
        ].filter(item => item.dimension && item.dimension.segments.length);
        const rails = dimensionRails(screenBounds(hull), dimensions.map(({ id, dimension }) => ({
          id, width: width < 768 ? 80 : 94, height: width < 768 ? 27 : 31,
          start: project(dimension!.segments[0].start), end: project(dimension!.segments[0].end),
        })), { width, height }, hull);
        for (const id of ["length", "depth"] as const) {
          const rail = rails.strokes
            .filter(stroke => stroke.dimensionId === id && !stroke.dashed)
            .sort((a, b) =>
              Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) -
              Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y),
            )[0];
          const source = dimensions.find(item => item.id === id)!.dimension!.segments[0];
          const projectedStart = project(source.start);
          const projectedEnd = project(source.end);
          const normal = {
            x: -(projectedEnd.y - projectedStart.y),
            y: projectedEnd.x - projectedStart.x,
          };
          const railProjection = rail.start.x * normal.x + rail.start.y * normal.y;
          const hullProjections = hull.map(point => point.x * normal.x + point.y * normal.y);
          expect(
            railProjection < Math.min(...hullProjections) ||
            railProjection > Math.max(...hullProjections),
            `${width}×${height} ${name} ${id} rail crossed the projected silhouette`,
          ).toBe(true);
        }
        const vertical = rails.strokes.filter(stroke => !stroke.dashed && stroke.start.x === stroke.end.x && Math.abs(stroke.start.y - stroke.end.y) > 8);
        expect(vertical.every(stroke => stroke.start.x === rails.right)).toBe(true);
        expect(rails.strokes.filter(stroke => stroke.dashed)).toHaveLength(dimensions.length * 2);
        const obstacles = [{ left: width - 56, top: 12, right: width - 12, bottom: 156 }];
        const placed = layoutLabels({
          viewport: { width, height }, silhouette: hull, obstacles,
          labels: [{ id: "selection", width: 160, height: 100, priority: 1, preferred: { x: width / 2, y: height / 2 } }, ...rails.labels],
        });
        expect(placed).toHaveLength(dimensions.length + 1);
        placed.forEach((label, index) => {
          expect(label.left).toBeGreaterThanOrEqual(0);
          expect(label.top).toBeGreaterThanOrEqual(0);
          expect(label.right).toBeLessThanOrEqual(width);
          expect(label.bottom).toBeLessThanOrEqual(height);
          if (silhouetteOverlap(label, hull) > 0.5) expect(label.conflicts).toContain("model silhouette");
          if (placed.slice(0, index).some(other => overlapArea(label, other) > 0.5)) expect(label.conflicts).toContain("higher-priority label");
          if (obstacles.some(other => overlapArea(label, other) > 0.5)) expect(label.conflicts).toContain("controls");
        });
        expect(dimensions.find(d => d.id === "depth")?.dimension).toBe(model.permanentDimensions.depth);
      });
    }
  }
});