export interface RenderLoopScheduler {
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

export interface DampedRenderLoopHandle {
  readonly wake: () => void;
  readonly stop: () => void;
}

export interface CurrentCallback<TArgs extends readonly unknown[], TResult> {
  readonly set: (callback: (...args: TArgs) => TResult) => void;
  readonly invoke: (...args: TArgs) => TResult;
}

export function createCurrentCallback<TArgs extends readonly unknown[], TResult>(
  initial: (...args: TArgs) => TResult,
): CurrentCallback<TArgs, TResult> {
  let current = initial;
  return {
    set: callback => {
      current = callback;
    },
    invoke: (...args) => current(...args),
  };
}

/**
 * Runs damping on asynchronous frames after `wake()`. An OrbitControls
 * "change" listener must call render only; calling update from that listener
 * synchronously re-enters OrbitControls. Errors stop this isolated loop and
 * are reported to the viewport boundary without affecting the measurements
 * panel. A false update result stops the loop until the next wake, so idle
 * viewports do not render or update React overlay state continuously.
 */
export function startDampedRenderLoop(
  update: () => boolean | void,
  render: () => void,
  scheduler: RenderLoopScheduler,
  onError: (error: unknown) => void,
): DampedRenderLoopHandle {
  let active = false;
  let stopped = false;
  let frame: number | null = null;
  const tick = () => {
    frame = null;
    if (!active || stopped) return;
    try {
      const changed = update();
      render();
      if (changed !== false) {
        frame = scheduler.requestFrame(tick);
      } else {
        active = false;
      }
    } catch (error) {
      active = false;
      onError(error);
    }
  };
  return {
    wake: () => {
      if (stopped || active) return;
      active = true;
      frame = scheduler.requestFrame(tick);
    },
    stop: () => {
      stopped = true;
      active = false;
      if (frame !== null) scheduler.cancelFrame(frame);
      frame = null;
    },
  };
}