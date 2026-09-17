import { describe, expect, it, vi } from "vitest";
import { applyExposedViewport, createTapGate, placeCameraWithoutMomentum, nearestPanelDetent } from "./viewportInput";

const sample = (pointerId = 1, clientX = 20, clientY = 40, button = 0) =>
  ({ pointerId, clientX, clientY, button });

describe("viewport input safety", () => {
  it("snaps a drag to each of the three portrait reference positions", () => {
    expect(nearestPanelDetent(.1)).toBe("full");
    expect(nearestPanelDetent(.40)).toBe("half");
    expect(nearestPanelDetent(.7)).toBe("peek");
    expect(nearestPanelDetent(.26)).toBe("full");
    expect(nearestPanelDetent(.28)).toBe("half");
    expect(nearestPanelDetent(.58)).toBe("peek");
  });
  it("clears old orbit momentum before reset and restores damping", () => {
    const calls: string[] = [];
    const controls = { enableDamping: true, update: () => { calls.push(`update:${controls.enableDamping}`); } };
    placeCameraWithoutMomentum(controls, () => calls.push("place"));
    expect(calls).toEqual(["update:false", "place", "update:false"]);
    expect(controls.enableDamping).toBe(true);
  });

  it("accepts each tap once, but rejects orbit drags even when returning to the start", () => {
    const gate = createTapGate();
    gate.down(sample());
    gate.up(sample(1, 22));
    expect(gate.consumeTap()).toBe(true);
    expect(gate.consumeTap()).toBe(false);
    gate.down(sample());
    gate.move(sample(1, 80));
    gate.up(sample());
    expect(gate.consumeTap()).toBe(false);
    gate.down(sample());
    gate.up(sample());
    expect(gate.consumeTap()).toBe(true);
  });

  it("rejects pinch/two-finger pan, right-button pan and cancelled touches", () => {
    const gate = createTapGate();
    gate.down(sample(1));
    gate.down(sample(2));
    gate.up(sample(2));
    gate.up(sample(1));
    expect(gate.consumeTap()).toBe(false);
    gate.down(sample(1, 20, 40, 2));
    gate.up(sample(1, 20, 40, 2));
    expect(gate.consumeTap()).toBe(false);
    gate.down(sample());
    gate.cancel(sample());
    gate.up(sample());
    expect(gate.consumeTap()).toBe(false);
  });

  it("restores exposed phone coordinates after repeated same-size renderer resizes", () => {
    let drawn = [0, 0, 390, 844];
    const camera = { aspect: 1, setViewOffset: vi.fn(), updateProjectionMatrix: vi.fn() };
    const renderer = {
      setViewport: (...rect: number[]) => { drawn = rect; },
      setScissor: vi.fn(),
      setScissorTest: vi.fn(),
    };
    const size = { width: 390, height: 844 * 0.48, fullHeight: 844 };
    for (let index = 0; index < 3; index++) {
      // WebGLRenderer.setSize overwrites viewport, even without a size change.
      drawn = [0, 0, 390, 844];
      applyExposedViewport(camera, renderer, size);
      expect(drawn).toEqual([0, 844 - size.height, 390, size.height]);
      expect(renderer.setScissor).toHaveBeenLastCalledWith(...drawn);
      expect(camera.aspect).toBe(390 / size.height);
    }
    expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(3);
  });
});