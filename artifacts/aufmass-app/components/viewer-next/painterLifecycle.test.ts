import { describe, expect, it } from "vitest";
import * as THREE from "three";
import fixture from "../../../../fixtures/garage-house.json";
import { buildModel } from "../../lib/viewer-next/model";
import {
  chooseSelectionPlacement,
  getExposedViewport,
  getSelectionDetails,
} from "../../lib/viewer-next/interaction";
import { createCurrentCallback, startDampedRenderLoop } from "./painterLifecycle";

describe("viewer-next painter lifecycle", () => {
  it("updates controls only from the asynchronous frame", () => {
    const queued: { current?: () => void } = {};
    let updateCount = 0;
    let renderCount = 0;
    const cancelled: number[] = [];
    const loop = startDampedRenderLoop(
      () => { updateCount += 1; },
      () => { renderCount += 1; },
      {
        requestFrame: next => {
          queued.current = next;
          return 7;
        },
        cancelFrame: handle => cancelled.push(handle),
      },
      () => { throw new Error("not expected"); },
    );

    expect(updateCount).toBe(0);
    expect(renderCount).toBe(0);
    loop.wake();
    queued.current?.();
    expect(updateCount).toBe(1);
    expect(renderCount).toBe(1);
    loop.stop();
    expect(cancelled).toContain(7);
  });

  it("stops and reports a painter error without retry recursion", () => {
    const queued: { current?: () => void } = {};
    const errors: unknown[] = [];
    let requests = 0;
    const loop = startDampedRenderLoop(
      () => { throw new Error("update failed"); },
      () => undefined,
      {
        requestFrame: next => {
          queued.current = next;
          requests += 1;
          return requests;
        },
        cancelFrame: () => undefined,
      },
      error => errors.push(error),
    );
    loop.wake();
    queued.current?.();
    queued.current?.();
    expect(errors).toHaveLength(1);
    expect(requests).toBe(1);
    loop.stop();
  });

  it("does not keep scheduling frames after damping settles", () => {
    let queued: (() => void) | undefined;
    let requests = 0;
    const loop = startDampedRenderLoop(
      () => false,
      () => undefined,
      {
        requestFrame: callback => {
          queued = callback;
          requests += 1;
          return requests;
        },
        cancelFrame: () => undefined,
      },
      () => undefined,
    );
    loop.wake();
    queued?.();
    expect(requests).toBe(1);
    loop.wake();
    expect(requests).toBe(2);
    loop.stop();
  });

  it("reprojects a measured real selection card after orbit without stale zero-size placement", () => {
    const model = buildModel(fixture);
    const details = getSelectionDetails(model.walls[0]);
    const measuredBox = { width: 208, height: 112 };
    const boxRef = { current: { width: 0, height: 0 } };
    const camera = new THREE.PerspectiveCamera(42, 402 / 650, 1, 1_000_000);
    const projectBounds = () => {
      const projected = model.walls[0].corners.map(corner =>
        new THREE.Vector3(corner.x, corner.y, corner.z).project(camera),
      );
      return {
        left: Math.min(...projected.map(point => (point.x + 1) * 402 / 2)),
        top: Math.min(...projected.map(point => (1 - point.y) * 650 / 2)),
        right: Math.max(...projected.map(point => (point.x + 1) * 402 / 2)),
        bottom: Math.max(...projected.map(point => (1 - point.y) * 650 / 2)),
      };
    };
    camera.position.set(model.bounds.main.widthMm * 2, -model.bounds.main.depthMm * 2, model.bounds.main.heightMm * 1.2);
    camera.lookAt(new THREE.Vector3(model.bounds.main.widthMm / 2, model.bounds.main.depthMm / 2, model.bounds.main.heightMm / 2));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const elementRef = {
      current: projectBounds(),
    };
    let placement = chooseSelectionPlacement({
      element: elementRef.current,
      box: boxRef.current,
      viewport: { width: 402, height: 650 },
      avoid: [{ left: 330, top: 0, right: 402, bottom: 84 }],
    });
    const currentOverlayCallback = createCurrentCallback<[], void>(() => undefined);
    const capturedLifecycleCallback = () => currentOverlayCallback.invoke();
    currentOverlayCallback.set(() => {
      placement = chooseSelectionPlacement({
        element: elementRef.current,
        box: boxRef.current,
        viewport: { width: 402, height: 650 },
        avoid: [{ left: 330, top: 0, right: 402, bottom: 84 }],
      });
    });

    capturedLifecycleCallback();
    const initialLeft = placement.left;
    expect(elementRef.current.right).toBeGreaterThan(400);
    expect(initialLeft).toBeGreaterThan(0);

    // This is the ResizeObserver update that used to be invisible to the
    // model-only lifecycle closure.
    boxRef.current = measuredBox;
    camera.position.x = model.bounds.main.widthMm * 1.5;
    camera.updateMatrixWorld();
    elementRef.current = projectBounds();
    capturedLifecycleCallback();
    expect(details.title).toBeTruthy();
    expect(placement.left + measuredBox.width).toBeLessThanOrEqual(402);
    expect(placement.top + measuredBox.height).toBeLessThanOrEqual(650);
    expect(placement.left).toBeLessThan(364);
    expect(placement.left).not.toBe(initialLeft);
    expect(placement.top).toBeGreaterThan(84);
  });

  it("projects the real selection above phone sheet detents and reveals peek for a full-sheet selection", () => {
    const model = buildModel(fixture);
    const details = getSelectionDetails(model.walls[0]);
    const phone = { width: 402, height: 844 };
    const card = { width: 208, height: 112 };
    // These are the bounds produced by the actual mobile sheet classes:
    // peek = calc(100% - 128px), half = translateY(48%), full = 12%.
    const sheetTop = {
      peek: phone.height - 128,
      half: phone.height * 0.48,
      full: phone.height * 0.12,
    };
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 1_000_000);
    camera.position.set(
      model.bounds.main.widthMm * 1.5,
      -model.bounds.main.depthMm * 1.5,
      model.bounds.main.heightMm * 1.2,
    );
    camera.lookAt(new THREE.Vector3(details.target.x, details.target.y, details.target.z));
    camera.updateMatrixWorld();

    for (const detent of ["half", "peek"] as const) {
      const viewport = getExposedViewport(phone, sheetTop[detent]);
      camera.aspect = viewport.width / viewport.height;
      camera.setViewOffset(viewport.width, viewport.height, 0, 0, viewport.width, viewport.height);
      camera.updateProjectionMatrix();
      const projected = new THREE.Vector3(
        details.target.x,
        details.target.y,
        details.target.z,
      ).project(camera);
      const targetTop = (1 - projected.y) * viewport.height / 2;
      expect(targetTop).toBeGreaterThanOrEqual(0);
      expect(targetTop).toBeLessThan(viewport.height);

      const placement = chooseSelectionPlacement({
        element: { left: 328, top: targetTop - 24, right: 398, bottom: targetTop + 24 },
        box: card,
        viewport,
        avoid: [{ left: 330, top: 0, right: 402, bottom: 132 }],
      });
      expect(placement.left + card.width).toBeLessThanOrEqual(viewport.width);
      expect(placement.top + card.height).toBeLessThanOrEqual(viewport.height);
    }

    const fullViewport = getExposedViewport(phone, sheetTop.full);
    expect(fullViewport.height).toBeLessThan(card.height);
    // Selecting from the panel changes full/half to peek; manual cycling is
    // still unchanged when there is no selection request.
    const selectedDetent = "peek";
    const revealedViewport = getExposedViewport(phone, sheetTop[selectedDetent]);
    expect(revealedViewport.height).toBeGreaterThanOrEqual(card.height);
    expect(details.title).toBeTruthy();
  });
});