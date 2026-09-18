"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDictionary } from "@/i18n/LocaleProvider";
import {
  findSelectableElement,
  getExposedViewport,
  getSelectionDetails,
  snapMeasurePoint,
  type MeasureLine,
} from "@/lib/viewer-next/interaction";
import type { ModelPolygon, Point3, ViewerModel } from "@/lib/viewer-next/model";
import { buildPresentationClosure } from "@/lib/viewer-next/model/closure";
import { viewerTokens } from "@/lib/viewer-next/tokens";
import { convexHull, dimensionRails, layoutLabels, screenBounds, type DimensionStroke, type LabelRequest } from "@/lib/viewer-next/overlayLayout";
import { clearRenderGroup, createContactShadow, createSelectionVisual, disposeRenderObject, isRayDistanceVisible, polygonGeometry, polygonMaterial } from "@/lib/viewer-next/renderResources";
import { createCurrentCallback, startDampedRenderLoop } from "./painterLifecycle";
import { applyExposedViewport, createTapGate, placeCameraWithoutMomentum } from "./viewportInput";

export interface ViewerViewportHandle {
  resetView: () => void;
  focusElement: (id: string) => void;
}

export interface ViewerViewportProps {
  model: ViewerModel;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  measureArmed: boolean;
  measureLines: readonly MeasureLine[];
  onMeasurePoint: (point: Point3) => void;
  onSnapPreview: (result: ReturnType<typeof snapMeasurePoint> | null) => void;
  showConditions: boolean;
  webglMessage: string;
  layoutMode: "split" | "model";
  modelState?: "ready" | "notready";
}

interface PainterState {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly interactiveMeshes: THREE.Object3D[];
  readonly conditionsGroup: THREE.Group;
  readonly measureGroup: THREE.Group;
  readonly selectionGroup: THREE.Group;
  readonly marker: THREE.Mesh;
  readonly initialPosition: THREE.Vector3;
  readonly initialTarget: THREE.Vector3;
  readonly viewport: {
    width: number;
    height: number;
    fullHeight: number;
  };
}

interface OverlayPosition {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly text: string;
  readonly kind: "dimension" | "measure";
}

interface SelectionOverlay {
  readonly left: number;
  readonly top: number;
  readonly anchorLeft: number;
  readonly anchorTop: number;
  readonly title: string;
  readonly dimensions: readonly string[];
  readonly value: string;
}

interface ViewerState {
  readonly measureArmed: boolean;
  readonly showConditions: boolean;
  readonly selectedId: string | null;
  readonly measureLines: readonly MeasureLine[];
  readonly onSelect: (id: string | null) => void;
  readonly onMeasurePoint: (point: Point3) => void;
  readonly onSnapPreview: (result: ReturnType<typeof snapMeasurePoint> | null) => void;
}

function toVector(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function addPolygon(
  part: ModelPolygon,
  group: THREE.Group,
  interactiveMeshes: THREE.Object3D[],
  interactive: boolean,
): THREE.Mesh {
  const geometry = polygonGeometry(part);
  const material = polygonMaterial(part);
  const elementKind = "type" in part
    ? ("depthMm" in part ? "attachment" : "opening")
    : "face";
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { elementId: part.id, elementKind };
  group.add(mesh);
  if (interactive) interactiveMeshes.push(mesh);
  return mesh;
}

function addEdge(
  edge: ViewerModel["edges"][number],
  group: THREE.Group,
  interactiveMeshes: THREE.Object3D[],
): void {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    toVector(edge.corners[0]),
    toVector(edge.corners[1]),
  ]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: edge.color.hex, transparent: true, opacity: 0.92 }),
  );
  line.userData = { elementId: edge.id, elementKind: "edge" };
  group.add(line);
  interactiveMeshes.push(line);
}

function updateLineGroup(group: THREE.Group, segments: readonly { start: Point3; end: Point3 }[], color: string = viewerTokens.dimensionLine): void {
  clearRenderGroup(group);
  for (const segment of segments) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      toVector(segment.start),
      toVector(segment.end),
    ]);
    group.add(new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.84 }),
    ));
  }
}

function projectPoint(
  point: Point3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): { left: number; top: number } {
  const projected = toVector(point).project(camera);
  return {
    left: (projected.x + 1) * 0.5 * width,
    top: (1 - projected.y) * 0.5 * height,
  };
}

function projectScreenPoint(
  point: Point3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): { x: number; y: number; visible: boolean } {
  const projected = toVector(point).project(camera);
  return {
    x: (projected.x + 1) * 0.5 * width,
    y: (1 - projected.y) * 0.5 * height,
    visible: projected.z >= -1 && projected.z <= 1,
  };
}

interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly fullHeight: number;
}

function getViewportMetrics(host: HTMLElement): ViewportMetrics {
  const hostRect = host.getBoundingClientRect();
  const panel = document.querySelector<HTMLElement>(".viewer-next-panel");
  const panelRect = panel?.getBoundingClientRect();
  // A side-by-side desktop panel does not cover any of the canvas.
  const sheetTop = panelRect &&
    panelRect.left < hostRect.right &&
    panelRect.right > hostRect.left &&
    panelRect.bottom > hostRect.top
    ? panelRect.top - hostRect.top
    : null;
  const exposed = getExposedViewport(
    { width: hostRect.width, height: hostRect.height },
    sheetTop,
  );
  return {
    width: Math.max(1, exposed.width),
    height: Math.max(1, exposed.height),
    fullHeight: Math.max(1, hostRect.height),
  };
}

/** Align the drawing viewport with the exposed model row, without reframing. */
function syncPainterViewport(painter: PainterState, host: HTMLElement): ViewportMetrics {
  const next = getViewportMetrics(host);
  painter.viewport.width = next.width;
  painter.viewport.height = next.height;
  painter.viewport.fullHeight = next.fullHeight;
  applyExposedViewport(painter.camera, painter.renderer, next);
  return next;
}

function midpoint(start: Point3, end: Point3): Point3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };
}

function overlaysEqual(previous: readonly OverlayPosition[], next: readonly OverlayPosition[]): boolean {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return item.id === candidate.id && item.left === candidate.left &&
      item.top === candidate.top &&
      item.text === candidate.text &&
      item.kind === candidate.kind;
  });
}

function selectionOverlaysEqual(previous: SelectionOverlay, next: SelectionOverlay): boolean {
  return previous.left === next.left &&
    previous.top === next.top &&
    previous.anchorLeft === next.anchorLeft &&
    previous.anchorTop === next.anchorTop &&
    previous.title === next.title &&
    previous.value === next.value &&
    previous.dimensions.length === next.dimensions.length &&
    previous.dimensions.every((dimension, index) => dimension === next.dimensions[index]);
}

export const ViewerViewport = forwardRef<ViewerViewportHandle, ViewerViewportProps>(function ViewerViewport({
  model,
  selectedId,
  onSelect,
  measureArmed,
  measureLines,
  onMeasurePoint,
  onSnapPreview,
  showConditions,
  webglMessage,
  layoutMode,
  modelState = "ready",
}, ref) {
  const dict = useDictionary();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<PainterState | null>(null);
  const stateRef = useRef<ViewerState>({
    measureArmed,
    showConditions,
    selectedId,
    measureLines,
    onSelect,
    onMeasurePoint,
    onSnapPreview,
  });
  const [webglFailed, setWebglFailed] = useState(false);
  const [selectionOverlay, setSelectionOverlay] = useState<SelectionOverlay | null>(null);
  const [overlays, setOverlays] = useState<OverlayPosition[]>([]);
  const [dimensionStrokes, setDimensionStrokes] = useState<DimensionStroke[]>([]);
  const [overlayConstraint, setOverlayConstraint] = useState("");
  const labelSizesRef = useRef(new Map<string, { width: number; height: number }>());
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const [selectionBoxSize, setSelectionBoxSize] = useState({ width: 0, height: 0 });
  const selectionBoxSizeRef = useRef(selectionBoxSize);
  const updateOverlaysRef = useRef(createCurrentCallback<[], void>(() => undefined));
  const renderViewportRef = useRef(createCurrentCallback<[], void>(() => undefined));
  const previousLayoutModeRef = useRef(layoutMode);
  selectionBoxSizeRef.current = selectionBoxSize;

  stateRef.current = {
    measureArmed,
    showConditions,
    selectedId,
    measureLines,
    onSelect,
    onMeasurePoint,
    onSnapPreview,
  };

  const updateOverlays = () => {
    const painter = painterRef.current;
    const host = hostRef.current;
    if (!painter || !host) return;
    const viewport = syncPainterViewport(painter, host);
    const width = viewport.width;
    const height = viewport.height;
    const hostRect = host.getBoundingClientRect();
    const avoid = Array.from(document.querySelectorAll<HTMLElement>(
      "[data-control], .viewer-next-calc-bubble, .viewer-next-calc-bar, .viewer-next-toast, .viewer-next-layout-toggle",
    ))
      .map(control => {
        const controlRect = control.getBoundingClientRect();
        return {
          left: controlRect.left - hostRect.left,
          top: controlRect.top - hostRect.top,
          right: controlRect.right - hostRect.left,
          bottom: controlRect.bottom - hostRect.top,
        };
      })
      .filter(rect =>
        rect.right > rect.left &&
        rect.bottom > rect.top &&
        rect.bottom > 0 &&
        rect.top < height
      );
    const screenPoint = (point: Point3) => {
      const position = projectPoint(point, painter.camera, width, height);
      return { x: position.left, y: position.top };
    };
    const modelPoints = [...model.walls, ...model.roofFaces, ...model.openings, ...model.attachments, ...model.massing]
      .flatMap(part => part.corners);
    const silhouette = convexHull(modelPoints.map(screenPoint));
    if (silhouette.length < 3) {
      setOverlayConstraint("Projection cannot fit dimension overlays.");
      return;
    }
    const bounds = screenBounds(silhouette);
    const sizeOf = (id: string) => labelSizesRef.current.get(id) ?? { width: 0, height: 0 };
    const permanent = [
      { id: "width" as const, dimension: model.permanentDimensions.width },
      { id: "ridge" as const, dimension: model.permanentDimensions.ridge },
      { id: "eave" as const, dimension: model.permanentDimensions.eaveHeight },
    ].filter(({ dimension }) => dimension.segments.length > 0);
    const rails = dimensionRails(bounds, permanent.map(({ id, dimension }) => ({
      id, ...sizeOf(id),
      start: screenPoint(dimension.segments[0].start), end: screenPoint(dimension.segments[0].end),
    })), { width, height });
    const requests: LabelRequest[] = [...rails.labels];
    const labels = permanent.map(({ id, dimension }) => ({
      id, text: dimension.label,
      kind: "dimension" as const,
    }));
    const measureLabels = stateRef.current.measureLines.map((line, index) => {
      const id = `measure-${index}`, size = sizeOf(id);
      const anchor = screenPoint(midpoint(line.start, line.end));
      requests.push({ id, ...size, priority: 0, preferred: { x: anchor.x - size.width / 2, y: anchor.y - size.height / 2 } });
      return { id, text: line.label, kind: "measure" as const };
    });
    const selected = findSelectableElement(model, stateRef.current.selectedId);
    const details = selected ? getSelectionDetails(selected) : null;
    const selectionAnchor = details ? screenPoint(details.target) : null;
    if (selected && selectionAnchor) {
      requests.push({
        id: "selection", ...selectionBoxSizeRef.current, priority: 1,
        preferred: { x: selectionAnchor.x + 12, y: selectionAnchor.y - selectionBoxSizeRef.current.height / 2 },
      });
    }
    const placements = layoutLabels({ viewport: { width, height }, labels: requests, obstacles: avoid, silhouette });
    const nextOverlays = [...labels, ...measureLabels].map(label => {
      const placement = placements.find(p => p.id === label.id)!;
      return { ...label, left: (placement.left + placement.right) / 2, top: (placement.top + placement.bottom) / 2 };
    });
    setOverlays(previous => overlaysEqual(previous, nextOverlays) ? previous : nextOverlays);
    // A displaced dimension remains connected to its own rail rather than losing its association.
    const strokes = [...rails.strokes];
    for (const label of rails.labels) {
      const placed = placements.find(p => p.id === label.id)!;
      if (Math.hypot(placed.left - label.preferred.x, placed.top - label.preferred.y) > 8) {
        strokes.push({
          start: { x: label.preferred.x, y: label.preferred.y + label.height / 2 },
          end: { x: placed.left, y: (placed.top + placed.bottom) / 2 }, dashed: true, dimensionId: label.id,
        });
      }
    }
    setDimensionStrokes(previous => JSON.stringify(previous) === JSON.stringify(strokes) ? previous : strokes);
    const conflicts = placements.flatMap(label => label.conflicts.map(conflict => `${label.id}: ${conflict}`));
    if (modelPoints.some(point => !projectScreenPoint(point, painter.camera, width, height).visible)) conflicts.push("model crosses camera clipping plane");
    setOverlayConstraint(conflicts.length ? `Limited overlay space — ${[...new Set(conflicts)].join("; ")}.` : "");
    if (!details || !selectionAnchor) {
      setSelectionOverlay(previous => previous === null ? previous : null);
    } else {
      const placement = placements.find(p => p.id === "selection")!;
      const nextSelectionOverlay = {
        left: placement.left, top: placement.top,
        anchorLeft: selectionAnchor.x, anchorTop: selectionAnchor.y,
        title: details.title, dimensions: details.dimensions, value: details.value,
      };
      setSelectionOverlay(previous => previous && selectionOverlaysEqual(previous, nextSelectionOverlay) ? previous : nextSelectionOverlay);
    }
  };
  updateOverlaysRef.current.set(updateOverlays);
  const renderViewport = () => {
    const painter = painterRef.current;
    const host = hostRef.current;
    if (!painter || !host) return;
    try {
      syncPainterViewport(painter, host);
      painter.renderer.render(painter.scene, painter.camera);
      updateOverlaysRef.current.invoke();
    } catch {
      setWebglFailed(true);
    }
  };
  renderViewportRef.current.set(renderViewport);

  useEffect(() => {
    const box = selectionBoxRef.current;
    if (!box) return;
    const updateSize = () => {
      const rect = box.getBoundingClientRect();
      const nextSize = { width: rect.width, height: rect.height };
      selectionBoxSizeRef.current = nextSize;
      setSelectionBoxSize(previous =>
        previous.width === rect.width && previous.height === rect.height
          ? previous
          : nextSize,
      );
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(box);
    updateSize();
    return () => observer.disconnect();
  }, [selectionOverlay?.title, selectionOverlay?.value, selectionOverlay?.dimensions.join("|")]);

  useEffect(() => {
    updateOverlaysRef.current.invoke();
    // The callback reads the latest measured box dimensions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionBoxSize.width, selectionBoxSize.height]);

  useEffect(() => {
    if (previousLayoutModeRef.current === layoutMode) return;
    previousLayoutModeRef.current = layoutMode;
    const handle = requestAnimationFrame(() => renderViewportRef.current.invoke());
    return () => cancelAnimationFrame(handle);
  }, [layoutMode]);

  // The collision solver uses actual DOM dimensions (including responsive font,
  // padding and border), not character counts or assumed text sizes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      let changed = false;
      for (const label of host.querySelectorAll<HTMLElement>("[data-overlay-label]")) {
        const id = label.dataset.overlayLabel!;
        const rect = label.getBoundingClientRect();
        const previous = labelSizesRef.current.get(id);
        if (previous?.width !== rect.width || previous?.height !== rect.height) {
          labelSizesRef.current.set(id, { width: rect.width, height: rect.height });
          changed = true;
        }
      }
      if (changed) updateOverlaysRef.current.invoke();
    };
    const observer = new ResizeObserver(() => { measure(); updateOverlaysRef.current.invoke(); });
    host.querySelectorAll<HTMLElement>("[data-overlay-label]").forEach(label => observer.observe(label));
    // Changes to calc/toast/control bounds are higher priority obstacles.
    document.querySelectorAll<HTMLElement>("[data-control], .viewer-next-calc-bubble, .viewer-next-calc-bar, .viewer-next-toast")
      .forEach(element => observer.observe(element));
    measure();
    let active = true;
    void document.fonts.ready.then(() => { if (active) measure(); });
    return () => { active = false; observer.disconnect(); };
  }, [overlays.map(label => `${label.id}:${label.text}`).join("|")]);

  const updateSelection = () => {
    const painter = painterRef.current;
    if (!painter) return;
    clearRenderGroup(painter.selectionGroup);
    const selected = findSelectableElement(model, stateRef.current.selectedId);
    if (!selected) {
      updateOverlays();
      return;
    }
    const target = painter.interactiveMeshes.find(item => item.userData.elementId === selected.id);
    if (target instanceof THREE.Mesh || target instanceof THREE.Line) painter.selectionGroup.add(createSelectionVisual(target));
    updateOverlays();
  };

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const painter = painterRef.current;
      const host = hostRef.current;
      if (!painter || !host) return;
      try {
        syncPainterViewport(painter, host);
        placeCameraWithoutMomentum(painter.controls, () => {
          painter.camera.position.copy(painter.initialPosition);
          painter.controls.target.copy(painter.initialTarget);
        });
        updateOverlays();
      } catch {
        setWebglFailed(true);
      }
    },
    focusElement: (id: string) => {
      const painter = painterRef.current;
      const host = hostRef.current;
      const element = findSelectableElement(model, id);
      if (!painter || !host || !element) return;
      try {
        syncPainterViewport(painter, host);
        const details = getSelectionDetails(element);
        const nextTarget = toVector(details.target);
        const distance = Math.max(
          painter.camera.position.distanceTo(painter.controls.target),
          Math.max(model.bounds.main.widthMm, model.bounds.main.heightMm) * 0.95,
        );
        const normal = toVector(element.normal).normalize();
        const viewOffset = normal.multiplyScalar(distance * 1.35).add(
          new THREE.Vector3(0, 0, distance * 0.38),
        );
        painter.controls.target.copy(nextTarget);
        painter.camera.position.copy(nextTarget).add(viewOffset);
        painter.controls.update();
        updateOverlays();
      } catch {
        setWebglFailed(true);
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    if (modelState === "notready") return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setWebglFailed(true);
      return;
    }
    setWebglFailed(false);
    const scene = new THREE.Scene();
    scene.background = null;
    renderer.setClearAlpha(0);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000000);
    camera.up.set(0, 0, 1);
    const bounds = model.bounds.overall;
    const centre = new THREE.Vector3(
      (bounds.min.x + bounds.max.x) / 2,
      (bounds.min.y + bounds.max.y) / 2,
      Math.max(0, (bounds.min.z + bounds.max.z) / 2),
    );
    const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
    const initialPosition = new THREE.Vector3(
      centre.x + span * 1.28,
      centre.y - span * 1.52,
      centre.z + span * 0.82,
    );
    camera.position.copy(initialPosition);
    camera.lookAt(centre);

    let controls: OrbitControls;
    try {
      controls = new OrbitControls(camera, canvas);
    } catch {
      setWebglFailed(true);
      renderer.dispose();
      return;
    }
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = Math.max(span * 0.15, 100);
    controls.maxDistance = span * 8;
    controls.target.copy(centre);
    controls.update();

    const hemisphere = new THREE.HemisphereLight(viewerTokens.rendererLight, viewerTokens.rendererGroundLight, viewerTokens.rendererHemisphereIntensity);
    hemisphere.position.set(0, 0, 1);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(viewerTokens.rendererLight, viewerTokens.rendererKeyIntensity);
    key.position.set(span, -span, span * 1.5);
    scene.add(key);

    const geometryGroup = new THREE.Group();
    const conditionsGroup = new THREE.Group();
    const measureGroup = new THREE.Group();
    const selectionGroup = new THREE.Group();
    const interactiveMeshes: THREE.Object3D[] = [];
    const presentationOccluders: THREE.Object3D[] = [];
    scene.add(geometryGroup, conditionsGroup, measureGroup, selectionGroup);
    scene.add(createContactShadow(model.bounds.overall));

    for (const wall of model.walls) addPolygon(wall, geometryGroup, interactiveMeshes, true);
    for (const roof of model.roofFaces) addPolygon(roof, geometryGroup, interactiveMeshes, true);
    for (const opening of model.openings) addPolygon(opening, geometryGroup, interactiveMeshes, true);
    for (const attachment of model.attachments) addPolygon(attachment, geometryGroup, interactiveMeshes, true);
    for (const mass of model.massing) addPolygon(mass, geometryGroup, interactiveMeshes, false);
    for (const closure of buildPresentationClosure(model)) {
      presentationOccluders.push(addPolygon(closure, geometryGroup, [], false));
    }
    for (const edge of model.edges) addEdge(edge, geometryGroup, interactiveMeshes);
    for (const condition of model.conditions) addPolygon(condition, conditionsGroup, [], false);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(span * 0.012, 50), 16, 12),
      new THREE.MeshBasicMaterial({ color: viewerTokens.accent }),
    );
    marker.visible = false;
    scene.add(marker);

    const state: PainterState = {
      scene,
      camera,
      renderer,
      controls,
      interactiveMeshes,
      conditionsGroup,
      measureGroup,
      selectionGroup,
      marker,
      initialPosition: initialPosition.clone(),
      initialTarget: centre.clone(),
      viewport: { width: 0, height: 0, fullHeight: 0 },
    };
    painterRef.current = state;

    const setSize = () => {
      try {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        syncPainterViewport(state, host);
        renderer.render(scene, camera);
        updateOverlaysRef.current.invoke();
      } catch {
        setWebglFailed(true);
      }
    };
    const render = () => {
      try {
        syncPainterViewport(state, host);
        renderer.render(scene, camera);
        updateOverlaysRef.current.invoke();
      } catch {
        setWebglFailed(true);
      }
    };
    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(host);
    const scrollContainer = host.closest(".viewer-next-model-section");
    scrollContainer?.addEventListener("scroll", render, { passive: true });
    const dampedRenderLoop = startDampedRenderLoop(
      () => controls.update(),
      () => {
        syncPainterViewport(state, host);
        renderer.render(scene, camera);
        updateOverlaysRef.current.invoke();
      },
      {
        requestFrame: callback => requestAnimationFrame(callback),
        cancelFrame: handle => cancelAnimationFrame(handle),
      },
      () => setWebglFailed(true),
    );
    const handleControlsChange = () => {
      // OrbitControls change handlers may render, but must never call update.
      render();
      dampedRenderLoop.wake();
    };
    controls.addEventListener("change", handleControlsChange);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const opaqueMeshes = [...interactiveMeshes.filter(item => item instanceof THREE.Mesh), ...presentationOccluders];
    const hitAt = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const viewport = syncPainterViewport(state, host);
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || x > viewport.width || y < 0 || y > viewport.height) return null;
      pointer.x = (x / viewport.width) * 2 - 1;
      pointer.y = -(y / viewport.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      raycaster.params.Line.threshold = Math.max(model.bounds.overall.widthMm * 0.015, 80);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      const priority: Record<string, number> = {
        opening: 0,
        attachment: 1,
        face: 2,
        edge: 3,
      };
      hits.sort((a, b) => {
        const distanceDelta = a.distance - b.distance;
        if (Math.abs(distanceDelta) > 0.5) return distanceDelta;
        return (priority[a.object.userData.elementKind] ?? 9) -
          (priority[b.object.userData.elementKind] ?? 9);
      });
      const hit = hits[0];
      // Caps/seams block hidden source faces, but never become selectable or
      // manufacture measurement/snap targets of their own.
      return hit && isRayDistanceVisible(raycaster, presentationOccluders, hit.distance, 0.5) ? hit : null;
    };
    const isCandidateVisible = (candidate: Point3, projected: { x: number; y: number; visible?: boolean }) => {
      if (projected.visible === false) return false;
      const viewport = syncPainterViewport(state, host);
      pointer.x = (projected.x / viewport.width) * 2 - 1;
      pointer.y = -(projected.y / viewport.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const candidateDistance = camera.position.distanceTo(toVector(candidate));
      // A few millimetres absorbs triangle-boundary rounding, but unlike NDC
      // depth it remains meaningful at this camera's 1e6 far plane.
      const epsilonMm = Math.max(8, candidateDistance * 1e-6);
      return isRayDistanceVisible(raycaster, opaqueMeshes, candidateDistance, epsilonMm);
    };
    const handleMove = (event: PointerEvent) => {
      if (!stateRef.current.measureArmed) {
        marker.visible = false;
        stateRef.current.onSnapPreview(null);
        return;
      }
      const hit = hitAt(event);
      if (!hit) {
        marker.visible = false;
        stateRef.current.onSnapPreview(null);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const viewport = syncPainterViewport(state, host);
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const snap = snapMeasurePoint(
        { x: hit.point.x, y: hit.point.y, z: hit.point.z },
        model,
        {
          screenPoint,
          radiusPx: window.matchMedia("(pointer: coarse)").matches ? 38 : 26,
          project: point => {
            const projected = projectScreenPoint(point, camera, viewport.width, viewport.height);
            return {
              x: projected.x,
              y: projected.y,
              visible: projected.visible,
            };
          },
          isVisible: isCandidateVisible,
        },
      );
      marker.position.copy(toVector(snap.point));
      marker.visible = snap.snapped;
      stateRef.current.onSnapPreview(snap.snapped ? snap : null);
      render();
    };
    const handleLeave = () => {
      marker.visible = false;
      stateRef.current.onSnapPreview(null);
      render();
    };
    const tapGate = createTapGate();
    const handleClick = (event: MouseEvent) => {
      if (!tapGate.consumeTap()) return;
      const hit = hitAt(event as unknown as PointerEvent);
      if (!hit) return;
      const id = hit.object.userData.elementId as string | undefined;
      if (stateRef.current.measureArmed) {
        const rect = canvas.getBoundingClientRect();
        const viewport = syncPainterViewport(state, host);
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const snap = snapMeasurePoint(
          { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          model,
          {
            screenPoint,
            radiusPx: window.matchMedia("(pointer: coarse)").matches ? 38 : 26,
            project: point => {
              const projected = projectScreenPoint(point, camera, viewport.width, viewport.height);
              return {
                x: projected.x,
                y: projected.y,
                visible: projected.visible,
              };
            },
            isVisible: isCandidateVisible,
          },
        );
        stateRef.current.onMeasurePoint(snap.point);
        marker.visible = false;
        stateRef.current.onSnapPreview(null);
      } else if (id) {
        stateRef.current.onSelect(id);
      }
    };
    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerleave", handleLeave);
    canvas.addEventListener("pointerdown", tapGate.down, true);
    canvas.addEventListener("pointermove", tapGate.move, true);
    canvas.addEventListener("pointerup", tapGate.up, true);
    canvas.addEventListener("pointercancel", tapGate.cancel, true);
    canvas.addEventListener("click", handleClick);

    setSize();
    updateSelection();
    return () => {
      resizeObserver.disconnect();
      scrollContainer?.removeEventListener("scroll", render);
      dampedRenderLoop.stop();
      controls.removeEventListener("change", handleControlsChange);
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerleave", handleLeave);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("pointerdown", tapGate.down, true);
      canvas.removeEventListener("pointermove", tapGate.move, true);
      canvas.removeEventListener("pointerup", tapGate.up, true);
      canvas.removeEventListener("pointercancel", tapGate.cancel, true);
      controls.dispose();
      disposeRenderObject(scene);
      renderer.dispose();
      painterRef.current = null;
    };
    // The model is the painter's immutable source for this lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, modelState]);

  useEffect(() => {
    const painter = painterRef.current;
    if (!painter) return;
    try {
      painter.conditionsGroup.visible = showConditions;
      updateLineGroup(painter.measureGroup, measureLines, viewerTokens.measure);
      painter.marker.visible = false;
      updateSelection();
      painter.renderer.render(painter.scene, painter.camera);
      updateOverlays();
    } catch {
      setWebglFailed(true);
    }
  }, [model, selectedId, measureArmed, measureLines, showConditions]);

  useEffect(() => {
    const host = hostRef.current;
    const stage = host?.closest(".viewer-next-stage");
    if (!host || !stage) return;
    let frame = 0;
    const observer = new MutationObserver(records => {
      if (records.every(record => record.target instanceof Node && host.contains(record.target))) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => updateOverlaysRef.current.invoke());
    });
    observer.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const selectionConnectorEnd = selectionOverlay ? {
    left: Math.max(selectionOverlay.left, Math.min(selectionOverlay.left + selectionBoxSize.width, selectionOverlay.anchorLeft)),
    top: Math.max(selectionOverlay.top, Math.min(selectionOverlay.top + selectionBoxSize.height, selectionOverlay.anchorTop)),
  } : null;

  return (
    <div
      ref={hostRef}
      className="viewer-next-viewport relative min-h-0 min-w-0 flex-1 overflow-hidden"
      data-testid="viewer-viewport"
      data-overlay-status={overlayConstraint ? "constrained" : "clear"}
      data-overlay-constraint={overlayConstraint || undefined}
      data-webgl-state={modelState === "notready" ? "notready" : webglFailed ? "unavailable" : "ready"}
    >
      {modelState !== "notready" && (
        <canvas
          ref={canvasRef}
          aria-label="Interactive measured building viewport"
          className="absolute inset-0 h-full w-full touch-none"
        />
      )}
      {(webglFailed || modelState === "notready") && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-schrift-sekundaer">
          {webglMessage}
        </div>
      )}
      {modelState !== "notready" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" data-testid="dimension-rails" aria-hidden="true">
          {dimensionStrokes.map((stroke, index) => (
            <line key={index} data-testid={`dimension-stroke-${index}`} data-extension={stroke.dashed}
              data-dimension-id={stroke.dimensionId}
              x1={stroke.start.x} y1={stroke.start.y} x2={stroke.end.x} y2={stroke.end.y}
              stroke={viewerTokens.dimensionLine} strokeWidth={1}
              strokeDasharray={stroke.dashed ? "4 4" : undefined} />
          ))}
        </svg>
        {overlays.map(overlay => (
          <span
            key={overlay.id}
            data-testid={`label-${overlay.id}`}
            data-overlay-label={overlay.id}
            title={overlay.id === "ridge" ? dict.viewerNext.labels.ridge : overlay.id === "eave" ? dict.viewerNext.labels.eaveHeight : undefined}
            aria-label={overlay.id === "ridge" ? `${dict.viewerNext.labels.ridge}: ${overlay.text}` : overlay.id === "eave" ? `${dict.viewerNext.labels.eaveHeight}: ${overlay.text}` : overlay.text}
            className={overlay.kind === "measure" ? "viewer-next-dimension-label viewer-next-measure-label" : "viewer-next-dimension-label"}
            style={{ left: overlay.left, top: overlay.top }}
          >
            {overlay.text}
          </span>
        ))}
        {selectionOverlay && selectionConnectorEnd && (
          <>
            <span
              className="viewer-next-selection-connector"
              data-testid="selection-connector"
              style={{
                left: selectionOverlay.anchorLeft,
                top: selectionOverlay.anchorTop,
                width: Math.hypot(selectionConnectorEnd.left - selectionOverlay.anchorLeft, selectionConnectorEnd.top - selectionOverlay.anchorTop),
                transform: `rotate(${Math.atan2(selectionConnectorEnd.top - selectionOverlay.anchorTop, selectionConnectorEnd.left - selectionOverlay.anchorLeft)}rad)`,
              }}
            />
            <span className="viewer-next-selection-dot" data-testid="selection-anchor-dot"
              style={{
                position: "absolute", left: selectionOverlay.anchorLeft - 3, top: selectionOverlay.anchorTop - 3,
                width: 6, height: 6, borderRadius: "50%", background: viewerTokens.accent,
              }} />
            <div
              ref={selectionBoxRef}
              className="viewer-next-selection-box"
              data-testid="selection-label"
              style={{ left: selectionOverlay.left, top: selectionOverlay.top }}
            >
              <div className="viewer-next-selection-title">{selectionOverlay.title}</div>
              {selectionOverlay.dimensions.map(dimension => <div key={dimension}>{dimension}</div>)}
              <strong>{selectionOverlay.value}</strong>
            </div>
          </>
        )}
        </div>
      )}
      {overlayConstraint && !webglFailed && (
        <div className="viewer-next-overlay-constraint pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-8px)] rounded px-2 py-1 text-xs"
          style={{ color: viewerTokens.warning, background: viewerTokens.surface }}
          data-testid="overlay-constraint" role="status">
          {dict.viewerNext.overlayConstraintMessage}
        </div>
      )}
    </div>
  );
});
