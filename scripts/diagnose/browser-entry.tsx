import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { computeDerived } from "../../lib/measurement/src/computeDerived";
import { viewerTokenStyles } from "../../artifacts/aufmass-app/lib/viewer-next/tokens";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
import { buildModel } from "../../artifacts/aufmass-app/lib/viewer-next/model/buildModel";
import { ViewerViewport } from "../../artifacts/aufmass-app/components/viewer-next/ViewerViewport";
import { LocaleProvider } from "../../artifacts/aufmass-app/i18n/LocaleProvider";
import { enUS } from "../../artifacts/aufmass-app/i18n/en-US";

// Analysis-only instrumentation of the actual renderer; no substitute geometry.
const w = window as any;
for (const [key, value] of Object.entries(viewerTokenStyles)) document.documentElement.style.setProperty(key, String(value));
w.observeRender = function (this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const gl = this.getContext();
  const size = this.getDrawingBufferSize(new THREE.Vector2());
  const pixels = new Uint8Array(size.x * size.y * 4);
  gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const colors = new Set<string>();
  let visibleObjects = 0;
  const elementIds = new Set<string>();
  scene.traverse((obj: any) => {
    if (obj.visible && (obj.isMesh || obj.isLine)) visibleObjects++;
    if (obj.userData.elementId) elementIds.add(obj.userData.elementId);
  });
  for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  w.renderEvidence = {
    frames: (w.renderEvidence?.frames ?? 0) + 1,
    webgl: gl.getParameter(gl.VERSION),
    renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    contextLost: gl.isContextLost(), glError: gl.getError(),
    drawCalls: this.info.render.calls, triangles: this.info.render.triangles,
    lines: this.info.render.lines, visibleObjects,
    elementIds: [...elementIds], sampledDistinctColors: colors.size,
    drawingBuffer: { width: size.x, height: size.y },
    camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), near: (camera as any).near, far: (camera as any).far, fov: (camera as any).fov },
  };
};
const collections = { faces: (m: any) => [...m.walls, ...m.roofFaces], edges: (m: any) => m.edges, openings: (m: any) => m.openings, attachments: (m: any) => m.attachments, conditions: (m: any) => m.conditions };
function compare(raw: any, prepared: any, model: any) {
  return Object.fromEntries(Object.entries(collections).map(([name, select]) => {
    const key = name === "conditions" ? "condition_areas" : name;
    const ids = (v: any) => Array.isArray(v) ? v.map(x => x?.id ?? null) : [];
    const inputIds = ids(raw[key]), preparedIds = ids(prepared[key]), modelIds = ids(select(model));
    return [name, { inputIds, preparedIds, modelIds, droppedDuringPreparation: inputIds.filter(x => !preparedIds.includes(x)), droppedFromModel: inputIds.filter(x => !modelIds.includes(x)), addedModelIds: modelIds.filter(x => !inputIds.includes(x)) }];
  }));
}
function diff(a: any, b: any, path = "", result: any[] = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return result;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], path ? `${path}.${key}` : key, result);
  } else result.push({ path, raw: a ?? null, prepared: b ?? null });
  return result;
}
let root: ReturnType<typeof createRoot> | undefined;
w.mountCase = (raw: any) => {
  root?.unmount();
  w.renderEvidence = null;
  const prepared = prepareProjectMeasurement(raw, enUS.viewerNext);
  let rawModel = null, rawError = null, rawDerived = null;
  try { rawDerived = computeDerived(raw); rawModel = buildModel(raw, rawDerived); } catch (error) { rawError = String(error); }
  if (prepared.kind !== "viewer") return { preparationKind: prepared.kind, rawModel, rawError };
  const model = buildModel(prepared.measurement as any, prepared.derived);
  root = createRoot(document.getElementById("root")!);
  root.render(<LocaleProvider locale="en-US" dict={enUS}><ViewerViewport
    model={model} selectedId={null} onSelect={() => {}} measureArmed={false} measureLines={[]}
    onMeasurePoint={() => {}} onSnapPreview={() => {}} showConditions showDimensions
    webglMessage="WEBGL RENDER FAILED" layoutMode="model"
  /></LocaleProvider>);
  return { preparationKind: prepared.kind, preparationWarnings: (prepared.measurement as any).quality?.warnings,
    preparationDifferences: diff(raw, prepared.measurement), dropped: compare(raw, prepared.measurement, model),
    model, derived: prepared.derived, rawModel, rawDerived, rawError,
    rawPreparedModelEqual: JSON.stringify(rawModel) === JSON.stringify(model) };
};