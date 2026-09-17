import { describe, expect, it } from "vitest";
import * as THREE from "three";
import fixture from "../../../../fixtures/garage-house.json";
import { buildModel } from "./model";
import {
  chooseSelectionPlacement,
  createMeasureLine,
  findSelectableElement,
  getSelectionDetails,
  snapMeasurePoint,
} from "./interaction";

describe("viewer-next interaction", () => {
  const model = buildModel(fixture);

  it("formats each selectable model element with its complete dimensions", () => {
    const wall = getSelectionDetails(model.walls[0]);
    expect(wall.dimensions[0]).toContain("×");
    expect(wall.value).toContain("net");
    const gableWall = model.walls.find(item => item.gableHeightMm > 0);
    expect(gableWall).toBeDefined();
    expect(getSelectionDetails(gableWall!).dimensions[1]).toContain("+ gable");
    expect(getSelectionDetails(gableWall!).dimensions[1]).toContain("/ 2");
    const wl4 = model.walls.find(item => item.id === "WL-4")!;
    const wl4Details = getSelectionDetails(wl4);
    expect(wl4Details.dimensions).toHaveLength(2);
    expect(wl4Details.dimensions[0]).toContain("×");
    expect(wl4Details.dimensions[1]).toBe(`+ gable 28' 0" × 9' 4" / 2`);
    expect(wl4Details.value).toContain("net");

    const opening = getSelectionDetails(model.openings.find(item => item.id === "G-1")!);
    expect(opening.dimensions[0]).toContain("×");
    expect(opening.value).toContain("area");

    const roof = getSelectionDetails(model.roofFaces[0]);
    expect(roof.dimensions[0]).toContain("/12");

    const edge = getSelectionDetails(model.edges[0]);
    expect(edge.value).toContain("'");

    const attachment = getSelectionDetails(model.attachments[0]);
    expect(attachment.dimensions[0].split("×")).toHaveLength(3);
  });

  it("snaps an attachment box's real vertical edge, not storage-loop diagonals", () => {
    const attachment = model.attachments[0];
    expect(attachment.corners).toHaveLength(8);
    const start = attachment.corners[0];
    const end = attachment.corners[4];
    const target = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2,
    };
    const project = (point: { x: number; y: number; z: number }) => ({
      x: point.x / 100,
      y: point.z / 100,
      visible: true,
    });
    const snapped = snapMeasurePoint(target, model, {
      screenPoint: { x: target.x / 100, y: target.z / 100 },
      radiusPx: 3,
      project,
    });
    expect(snapped.snapped).toBe(true);
    expect(snapped.targetId).toBe(attachment.id);
    expect(snapped.targetKind).toBe("edge");
    expect(snapped.point.x).toBeCloseTo(target.x, 0);
    expect(snapped.point.y).toBeCloseTo(target.y, 0);
    expect(snapped.point.z).toBeCloseTo(target.z, 0);
  });

  it("gives corners priority and leaves a wall centre free", () => {
    const wall = model.walls[0];
    const corner = snapMeasurePoint(wall.corners[0], model, 100);
    expect(corner.snapped).toBe(true);
    expect(corner.targetKind).toBe("corner");

    const centre = {
      x: (wall.bounds.min.x + wall.bounds.max.x) / 2,
      y: (wall.bounds.min.y + wall.bounds.max.y) / 2,
      z: (wall.bounds.min.z + wall.bounds.max.z) / 2,
    };
    const free = snapMeasurePoint(centre, model, 100);
    expect(free.snapped).toBe(false);
    expect(free.point).toEqual(centre);
  });

  it("uses screen pixels and rejects geometry behind the visible hit", () => {
    const wall = model.walls[0];
    const eave = {
      x: (wall.corners[2].x + wall.corners[3].x) / 2,
      y: (wall.corners[2].y + wall.corners[3].y) / 2,
      z: (wall.corners[2].z + wall.corners[3].z) / 2,
    };
    const project = (point: { x: number; y: number; z: number }) => ({
      x: point.x / 100,
      y: point.z / 100,
      visible: true,
    });
    const snapped = snapMeasurePoint(
      { x: eave.x + 500, y: eave.y, z: eave.z },
      model,
      {
        screenPoint: { x: eave.x / 100, y: eave.z / 100 },
        radiusPx: 8,
        project,
      },
    );
    expect(snapped.snapped).toBe(true);
    expect(snapped.targetKind).toBe("edge");

    const behind = snapMeasurePoint(
      eave,
      model,
      {
        screenPoint: { x: eave.x / 100, y: eave.z / 100 },
        radiusPx: 8,
        project,
        isVisible: () => false,
      },
    );
    expect(behind.snapped).toBe(false);

    const condition = model.conditions[0];
    if (condition) {
      const conditionCorner = condition.corners[0];
      const conditionSnap = snapMeasurePoint(conditionCorner, model, {
        screenPoint: { x: conditionCorner.x / 100, y: conditionCorner.z / 100 },
        radiusPx: 2,
        project,
      });
      expect(conditionSnap.targetId).not.toBe(condition.id);
    }
  });

  it("uses a production perspective camera for oblique pixel-nearest segments", () => {
    const width = 1200;
    const height = 800;
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 1_000_000);
    camera.position.set(model.bounds.main.widthMm * 1.6, -model.bounds.main.depthMm * 3.2, model.bounds.main.heightMm * 1.35);
    camera.lookAt(new THREE.Vector3(model.bounds.main.widthMm / 2, model.bounds.main.depthMm / 2, model.bounds.main.heightMm / 2));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const project = (candidate: { x: number; y: number; z: number }) => {
      const projected = new THREE.Vector3(candidate.x, candidate.y, candidate.z).project(camera);
      return {
        x: (projected.x + 1) * width / 2,
        y: (1 - projected.y) * height / 2,
        visible: projected.z >= -1 && projected.z <= 1,
      };
    };
    const segment = model.roofFaces[0].corners.slice(0, 2);
    const fraction = 0.63;
    const expected = {
      x: segment[0].x + (segment[1].x - segment[0].x) * fraction,
      y: segment[0].y + (segment[1].y - segment[0].y) * fraction,
      z: segment[0].z + (segment[1].z - segment[0].z) * fraction,
    };
    const expectedScreen = project(expected);
    const snapped = snapMeasurePoint(expected, model, {
      screenPoint: { x: expectedScreen.x + 6, y: expectedScreen.y - 4 },
      radiusPx: 14,
      project,
      isVisible: () => true,
    });
    expect(snapped.snapped).toBe(true);
    expect(Math.hypot(snapped.point.x - expected.x, snapped.point.y - expected.y, snapped.point.z - expected.z)).toBeLessThan(140);
  });

  it("uses an opaque-object raycast predicate to reject a rear wall candidate", () => {
    const width = 1200;
    const height = 800;
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 1_000_000);
    camera.position.set(model.bounds.main.widthMm / 2, -100_000, model.bounds.main.heightMm * 0.55);
    camera.lookAt(new THREE.Vector3(model.bounds.main.widthMm / 2, model.bounds.main.depthMm / 2, model.bounds.main.heightMm * 0.55));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const project = (candidate: { x: number; y: number; z: number }) => {
      const projected = new THREE.Vector3(candidate.x, candidate.y, candidate.z).project(camera);
      return {
        x: (projected.x + 1) * width / 2,
        y: (1 - projected.y) * height / 2,
        visible: projected.z >= -1 && projected.z <= 1,
      };
    };
    const rear = model.walls.find(wall => wall.elevation === "back")!;
    const rearPoint = {
      x: (rear.corners[0].x + rear.corners[1].x) / 2,
      y: (rear.corners[0].y + rear.corners[1].y) / 2,
      z: (rear.corners[0].z + rear.corners[1].z) / 2,
    };
    const meshes = model.walls.map(wall => {
      const positions = wall.triangles.flatMap(triangle => triangle.flatMap(item => [item.x, item.y, item.z]));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    });
    const raycaster = new THREE.Raycaster();
    const snapped = snapMeasurePoint(rearPoint, model, {
      screenPoint: project(rearPoint),
      radiusPx: 12,
      project,
      isVisible: (candidate, projected) => {
        const pointer = new THREE.Vector2(
          (projected.x / width) * 2 - 1,
          -(projected.y / height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const nearest = raycaster.intersectObjects(meshes, false)[0];
        const candidateDistance = camera.position.distanceTo(new THREE.Vector3(candidate.x, candidate.y, candidate.z));
        return !nearest || nearest.distance >= candidateDistance - 8;
      },
    });
    expect(snapped.snapped).toBe(true);
    expect(snapped.targetId).not.toBe(rear.id);
    meshes.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  });

  it("places a measured-size selection box beside bounds and away from controls", () => {
    const placement = chooseSelectionPlacement({
      element: { left: 700, top: 220, right: 780, bottom: 360 },
      box: { width: 260, height: 120 },
      viewport: { width: 1000, height: 600 },
      avoid: [{ left: 760, top: 0, right: 840, bottom: 80 }],
    });
    expect(placement.left).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.left + 260).toBeLessThanOrEqual(1000);
    expect(placement.top + 120).toBeLessThanOrEqual(600);
    expect(placement.side).not.toBe("right");
  });

  it("creates independently labelled measurement lines", () => {
    const line = createMeasureLine({ x: 0, y: 0, z: 0 }, { x: 12192, y: 0, z: 0 });
    expect(line.label).toBe(`40' 0"`);
    expect(findSelectableElement(model, "G-1")?.id).toBe("G-1");
  });
});