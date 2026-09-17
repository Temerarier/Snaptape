"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  chooseSelectionPlacement,
  findSelectableElement,
  getExposedViewport,
  getSelectionDetails,
  snapMeasurePoint,
  type MeasureLine,
} from "@/lib/viewer-next/interaction";
import type { ModelPolygon, Point3, ViewerModel } from "@/lib/viewer-next/model";
import { createCurrentCallback, startDampedRenderLoop } from "./painterLifecycle";
import { applyExposedViewport, createTapGate } from "./viewportInput";

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
  sheetDetent: "peek" | "half" | "full";
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
  readonly permanentGroup: THREE.Group;
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

function polygonGeometry(part: ModelPolygon): THREE.BufferGeometry {
  const values: number[] = [];
  for (const triangle of part.triangles) {
    for (const point of triangle) values.push(point.x, point.y, point.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function colourMaterial(part: ModelPolygon): THREE.Material | THREE.Material[] {
  const base = new THREE.MeshStandardMaterial({
    color: part.color.hex,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  if (!part.color.secondaryHex || part.triangles.length < 2) return base;
  const accent = new THREE.MeshStandardMaterial({
    color: part.color.secondaryHex,
    roughness: 0.88,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.42,
  });
  return [base, accent];
}

function addPolygon(
  part: ModelPolygon,
  group: THREE.Group,
  interactiveMeshes: THREE.Object3D[],
  interactive: boolean,
): void {
  const geometry = polygonGeometry(part);
  const material = colourMaterial(part);
  const elementKind = "type" in part
    ? ("depthMm" in part ? "attachment" : "opening")
    : "face";
  if (Array.isArray(material)) {
    const materials = material;
    for (let index = 0; index < part.triangles.length; index += 1) {
      geometry.addGroup(index * 3, 3, index % 2 === 0 ? 0 : 1);
    }
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.userData = { elementId: part.id, elementKind };
    group.add(mesh);
    if (interactive) interactiveMeshes.push(mesh);
    return;
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { elementId: part.id, elementKind };
  group.add(mesh);
  if (interactive) interactiveMeshes.push(mesh);
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

function updateLineGroup(group: THREE.Group, segments: readonly { start: Point3; end: Point3 }[]): void {
  while (group.children.length) {
    const child = group.children.pop();
    if (!child) continue;
    child.traverse(item => {
      if (item instanceof THREE.Mesh || item instanceof THREE.Line || item instanceof THREE.LineSegments) {
        item.geometry.dispose();
        if (Array.isArray(item.material)) item.material.forEach(material => material.dispose());
        else item.material.dispose();
      }
    });
  }
  for (const segment of segments) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      toVector(segment.start),
      toVector(segment.end),
    ]);
    group.add(new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: "#334155", transparent: true, opacity: 0.84 }),
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

/**
 * The measurements sheet is an overlay, not part of the flex layout. Keep
 * Three's drawing viewport and projection aligned with the exposed area above
 * its current animated detent, rather than centring a focused element under
 * the sheet.
 */
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

function disposeObject(root: THREE.Object3D): void {
  root.traverse(item => {
    if (item instanceof THREE.Mesh || item instanceof THREE.Line || item instanceof THREE.LineSegments) {
      item.geometry.dispose();
      if (Array.isArray(item.material)) item.material.forEach(material => material.dispose());
      else item.material.dispose();
    }
  });
}

function overlaysEqual(previous: readonly OverlayPosition[], next: readonly OverlayPosition[]): boolean {
  return previous.length === next.length && previous.every((item, index) => {
    const candidate = next[index];
    return item.left === candidate.left &&
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
  sheetDetent,
  modelState = "ready",
}, ref) {
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
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const [selectionBoxSize, setSelectionBoxSize] = useState({ width: 0, height: 0 });
  const selectionBoxSizeRef = useRef(selectionBoxSize);
  const updateOverlaysRef = useRef(createCurrentCallback<[], void>(() => undefined));
  const renderViewportRef = useRef(createCurrentCallback<[], void>(() => undefined));
  const previousSheetDetentRef = useRef(sheetDetent);
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
    const nextOverlays: OverlayPosition[] = [];
    const permanent = [
      model.permanentDimensions.width,
      model.permanentDimensions.ridge,
      model.permanentDimensions.eaveHeight,
    ];
    for (const dimension of permanent) {
      const segment = dimension.segments[0];
      if (!segment) continue;
      const position = projectPoint(midpoint(segment.start, segment.end), painter.camera, width, height);
      nextOverlays.push({
        ...position,
        text: dimension.label,
        kind: "dimension",
      });
    }
    for (const line of stateRef.current.measureLines) {
      const position = projectPoint(midpoint(line.start, line.end), painter.camera, width, height);
      nextOverlays.push({ ...position, text: line.label, kind: "measure" });
    }
    setOverlays(previous => overlaysEqual(previous, nextOverlays) ? previous : nextOverlays);

    const selected = findSelectableElement(model, stateRef.current.selectedId);
    if (!selected) {
      setSelectionOverlay(previous => previous === null ? previous : null);
      return;
    }
    const details = getSelectionDetails(selected);
    const anchor = projectPoint(details.anchor, painter.camera, width, height);
    const projectedCorners = selected.corners.map(corner => projectPoint(corner, painter.camera, width, height));
    const elementBounds = {
      left: Math.min(...projectedCorners.map(item => item.left), anchor.left),
      top: Math.min(...projectedCorners.map(item => item.top), anchor.top),
      right: Math.max(...projectedCorners.map(item => item.left), anchor.left),
      bottom: Math.max(...projectedCorners.map(item => item.top), anchor.top),
    };
    const hostRect = host.getBoundingClientRect();
    const avoid = Array.from(document.querySelectorAll<HTMLElement>("[data-control]"))
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
    const placement = chooseSelectionPlacement({
      element: elementBounds,
      box: selectionBoxSizeRef.current,
      viewport: { width, height },
      avoid,
    });
    const nextSelectionOverlay: SelectionOverlay = {
      left: placement.left,
      top: placement.top,
      anchorLeft: placement.anchorLeft,
      anchorTop: placement.anchorTop,
      title: details.title,
      dimensions: details.dimensions,
      value: details.value,
    };
    setSelectionOverlay(previous =>
      previous && selectionOverlaysEqual(previous, nextSelectionOverlay)
        ? previous
        : nextSelectionOverlay,
    );
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
    if (previousSheetDetentRef.current === sheetDetent) return;
    previousSheetDetentRef.current = sheetDetent;
    let frames = 0;
    let handle = 0;
    const followSheetTransition = () => {
      renderViewportRef.current.invoke();
      frames += 1;
      if (frames < 24) handle = requestAnimationFrame(followSheetTransition);
    };
    handle = requestAnimationFrame(followSheetTransition);
    return () => cancelAnimationFrame(handle);
  }, [sheetDetent]);

  const updateSelection = () => {
    const painter = painterRef.current;
    if (!painter) return;
    while (painter.selectionGroup.children.length) {
      const child = painter.selectionGroup.children.pop();
      if (child) disposeObject(child);
    }
    const selected = findSelectableElement(model, stateRef.current.selectedId);
    if (!selected) {
      updateOverlays();
      return;
    }
    const target = painter.interactiveMeshes.find(item => item.userData.elementId === selected.id);
    if (target instanceof THREE.Mesh) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(target.geometry, 12),
        new THREE.LineBasicMaterial({ color: "#0f6fff", transparent: true, opacity: 0.96 }),
      );
      outline.scale.setScalar(1.008);
      painter.selectionGroup.add(outline);
    } else if (target instanceof THREE.Line) {
      const outline = new THREE.Line(
        target.geometry.clone(),
        new THREE.LineBasicMaterial({ color: "#0f6fff", linewidth: 3 }),
      );
      painter.selectionGroup.add(outline);
    }
    updateOverlays();
  };

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const painter = painterRef.current;
      const host = hostRef.current;
      if (!painter || !host) return;
      try {
        syncPainterViewport(painter, host);
        painter.camera.position.copy(painter.initialPosition);
        painter.controls.target.copy(painter.initialTarget);
        painter.controls.update();
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
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch {
      setWebglFailed(true);
      return;
    }
    setWebglFailed(false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f7fafc");
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

    scene.add(new THREE.HemisphereLight("#ffffff", "#aab6c4", 1.9));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(span, -span, span * 1.5);
    scene.add(key);

    const geometryGroup = new THREE.Group();
    const conditionsGroup = new THREE.Group();
    const measureGroup = new THREE.Group();
    const permanentGroup = new THREE.Group();
    const selectionGroup = new THREE.Group();
    const interactiveMeshes: THREE.Object3D[] = [];
    scene.add(geometryGroup, conditionsGroup, measureGroup, permanentGroup, selectionGroup);

    for (const wall of model.walls) addPolygon(wall, geometryGroup, interactiveMeshes, true);
    for (const roof of model.roofFaces) addPolygon(roof, geometryGroup, interactiveMeshes, true);
    for (const opening of model.openings) addPolygon(opening, geometryGroup, interactiveMeshes, true);
    for (const attachment of model.attachments) addPolygon(attachment, geometryGroup, interactiveMeshes, true);
    for (const mass of model.massing) addPolygon(mass, geometryGroup, interactiveMeshes, false);
    for (const edge of model.edges) addEdge(edge, geometryGroup, interactiveMeshes);
    for (const condition of model.conditions) addPolygon(condition, conditionsGroup, [], false);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(span * 0.012, 50), 16, 12),
      new THREE.MeshBasicMaterial({ color: "#2563eb" }),
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
      permanentGroup,
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
    const opaqueMeshes = interactiveMeshes.filter(item => item instanceof THREE.Mesh);
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
      return hits[0] ?? null;
    };
    const isCandidateVisible = (candidate: Point3, projected: { x: number; y: number; visible?: boolean }) => {
      if (projected.visible === false) return false;
      const viewport = syncPainterViewport(state, host);
      pointer.x = (projected.x / viewport.width) * 2 - 1;
      pointer.y = -(projected.y / viewport.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const candidateDistance = camera.position.distanceTo(toVector(candidate));
      const nearest = raycaster.intersectObjects(opaqueMeshes, false)[0];
      // A few millimetres absorbs triangle-boundary rounding, but unlike NDC
      // depth it remains meaningful at this camera's 1e6 far plane.
      const epsilonMm = Math.max(8, candidateDistance * 1e-6);
      return !nearest || nearest.distance >= candidateDistance - epsilonMm;
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
      disposeObject(scene);
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
      updateLineGroup(
        painter.permanentGroup,
        [
          ...model.permanentDimensions.width.segments,
          ...model.permanentDimensions.ridge.segments,
          ...model.permanentDimensions.eaveHeight.segments,
        ],
      );
      updateLineGroup(painter.measureGroup, measureLines);
      painter.marker.visible = false;
      updateSelection();
      painter.renderer.render(painter.scene, painter.camera);
      updateOverlays();
    } catch {
      setWebglFailed(true);
    }
  }, [model, selectedId, measureArmed, measureLines, showConditions]);

  return (
    <div
      ref={hostRef}
      className="viewer-next-viewport relative min-h-0 min-w-0 flex-1 overflow-hidden"
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
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {overlays.map((overlay, index) => (
          <span
            key={`${overlay.kind}-${index}`}
            className={overlay.kind === "measure" ? "viewer-next-dimension-label viewer-next-measure-label" : "viewer-next-dimension-label"}
            style={{ left: overlay.left, top: overlay.top }}
          >
            {overlay.text}
          </span>
        ))}
        {selectionOverlay && (
          <>
            <span
              className="viewer-next-selection-connector"
              style={{
                left: selectionOverlay.anchorLeft,
                top: selectionOverlay.anchorTop,
                width: Math.hypot(selectionOverlay.left - selectionOverlay.anchorLeft, selectionOverlay.top - selectionOverlay.anchorTop),
                transform: `rotate(${Math.atan2(selectionOverlay.top - selectionOverlay.anchorTop, selectionOverlay.left - selectionOverlay.anchorLeft)}rad)`,
              }}
            />
            <div
              ref={selectionBoxRef}
              className="viewer-next-selection-box"
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
    </div>
  );
});
