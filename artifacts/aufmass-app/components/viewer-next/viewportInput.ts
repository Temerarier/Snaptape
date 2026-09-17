interface PointerSample {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
}

/** Portrait-source snap points, expressed as viewport proportions. */
export function nearestPanelDetent(viewportFraction: number): "full" | "half" | "peek" {
  const points = [["full", .12], ["half", .42], ["peek", .72]] as const;
  return points.reduce((nearest, point) =>
    Math.abs(point[1] - viewportFraction) < Math.abs(nearest[1] - viewportFraction) ? point : nearest
  )[0];
}

/** Drain OrbitControls' pending damping before an explicit camera placement. */
export function placeCameraWithoutMomentum(
  controls: { enableDamping: boolean; update: () => unknown },
  place: () => void,
) {
  const damping = controls.enableDamping;
  try {
    controls.enableDamping = false;
    controls.update();
    place();
    controls.update();
  } finally {
    controls.enableDamping = damping;
  }
}

/** One tap may pick. Any drag, cancellation or multi-pointer gesture may not. */
export function createTapGate(thresholdPx = 6) {
  const pointers = new Map<number, { x: number; y: number }>();
  let eligible = false;
  let ready = false;
  const move = (event: PointerSample) => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > thresholdPx) {
      eligible = false;
    }
  };
  return {
    down(event: PointerSample) {
      if (pointers.size === 0) eligible = event.button === 0;
      else eligible = false;
      ready = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    },
    move,
    up(event: PointerSample) {
      move(event);
      const known = pointers.delete(event.pointerId);
      if (known && pointers.size === 0) ready = eligible;
    },
    cancel(event: PointerSample) {
      pointers.delete(event.pointerId);
      eligible = false;
      ready = false;
    },
    consumeTap() {
      const result = ready;
      ready = false;
      return result;
    },
  };
}

interface CameraViewport {
  aspect: number;
  setViewOffset: (fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number) => void;
  updateProjectionMatrix: () => void;
}

interface RendererViewport {
  setViewport: (x: number, y: number, width: number, height: number) => void;
  setScissor: (x: number, y: number, width: number, height: number) => void;
  setScissorTest: (enabled: boolean) => void;
}

/** Always reapply: renderer.setSize resets its viewport, even at the same size. */
export function applyExposedViewport(
  camera: CameraViewport,
  renderer: RendererViewport,
  size: { width: number; height: number; fullHeight: number },
) {
  camera.aspect = size.width / size.height;
  camera.setViewOffset(size.width, size.height, 0, 0, size.width, size.height);
  camera.updateProjectionMatrix();
  renderer.setViewport(0, size.fullHeight - size.height, size.width, size.height);
  renderer.setScissor(0, size.fullHeight - size.height, size.width, size.height);
  renderer.setScissorTest(true);
}