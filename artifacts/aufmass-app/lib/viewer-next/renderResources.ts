import * as THREE from "three";
import type { Bounds3, ModelPolygon, ModelConditionArea, Point3 } from "./model";
import { viewerTokens } from "./tokens";

function isGlazing(part: ModelPolygon): boolean {
  return "type" in part && (part.type === "window" || part.type === "skylight");
}

function isSurfaceOpening(part: ModelPolygon): boolean {
  return "type" in part && "parentFaceId" in part && "widthMm" in part && !("depthMm" in part);
}

/** Translation is presentation-only; local geometry and source model stay canonical. */
export function placeSurfaceVisual(mesh: THREE.Mesh, part: ModelPolygon, offsetMm = isSurfaceOpening(part) ? viewerTokens.openingOffsetMm : 0): void {
  const normal = new THREE.Vector3(part.normal.x, part.normal.y, part.normal.z).normalize();
  mesh.position.copy(normal.clone().multiplyScalar(offsetMm));
  mesh.userData.surfaceNormal = normal;
  mesh.userData.surfaceOffset = mesh.position.clone();
}

/** Undo only our decal translation before unsnapped measurement or snap lookup. */
export function canonicalSurfaceHit(hit: Pick<THREE.Intersection, "object" | "point">): Point3 {
  const point = hit.point.clone();
  const offset = hit.object.userData.surfaceOffset;
  if (offset instanceof THREE.Vector3) point.sub(offset);
  return { x: point.x, y: point.y, z: point.z };
}

/** Render-only decal; source corners remain authoritative for measurements. */
export function createConditionVisual(part: ModelConditionArea): THREE.Mesh {
  const geometry = polygonGeometry(part);
  const tangent = new THREE.Vector3(part.frame.tangent.x, part.frame.tangent.y, part.frame.tangent.z);
  const normal = new THREE.Vector3(part.normal.x, part.normal.y, part.normal.z).normalize();
  const up = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const positions = geometry.getAttribute("position");
  const uv: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
    uv.push(point.dot(tangent) / viewerTokens.conditionHatchMm, point.dot(up) / viewerTokens.conditionHatchMm);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const pixels = new Uint8Array(16 * 16 * 4);
  const color = new THREE.Color(part.severity === "severe" ? viewerTokens.danger : viewerTokens.condition);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4;
    pixels.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255),
      Math.round(255 * ((x + y) % 16 < 3 ? viewerTokens.conditionHatchOpacity : viewerTokens.conditionFillOpacity))], i);
  }
  const texture = new THREE.DataTexture(pixels, 16, 16, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  mesh.renderOrder = 1;
  mesh.userData = { elementId: part.id, elementKind: "condition" };
  placeSurfaceVisual(mesh, part, viewerTokens.conditionOffsetMm);
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(part.corners.map(p => new THREE.Vector3(p.x, p.y, p.z))),
    new THREE.LineBasicMaterial({ color: viewerTokens.danger, depthWrite: false }),
  );
  outline.renderOrder = 2;
  mesh.add(outline);
  return mesh;
}

export function polygonGeometry(part: ModelPolygon): THREE.BufferGeometry {
  const values = part.triangles.flatMap(triangle => triangle.flatMap(point => [point.x, point.y, point.z]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  geometry.computeVertexNormals();
  if (!isGlazing(part) && part.color.secondaryHex && part.triangles.length >= 2) {
    for (let index = 0; index < part.triangles.length; index++) {
      geometry.addGroup(index * 3, 3, index % 2);
    }
  }
  return geometry;
}

/** One continuous glazing material, never alternating triangle groups. */
export function polygonMaterial(part: ModelPolygon): THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] {
  const glass = isGlazing(part);
  const opening = isSurfaceOpening(part);
  // Local vertices stay measured/coplanar; placeSurfaceVisual supplies the
  // outward render translation, complemented by this raster-depth bias.
  const openingDepthBias = {
    polygonOffset: opening,
    polygonOffsetFactor: opening ? -1 : 0,
    polygonOffsetUnits: opening ? -1 : 0,
  };
  const base = new THREE.MeshStandardMaterial({
    color: glass ? viewerTokens.modelWindow : part.color.hex,
    roughness: glass ? 0.3 : 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: glass,
    opacity: glass ? viewerTokens.glassOpacity : 1,
    depthWrite: !glass,
    ...openingDepthBias,
  });
  if (glass || !part.color.secondaryHex || part.triangles.length < 2) return base;
  // Non-glazing secondary colours encode real source material/confidence data.
  // Preserve the original accent treatment rather than flattening every face.
  return [base, new THREE.MeshStandardMaterial({
    color: part.color.secondaryHex,
    roughness: 0.88,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.42,
    ...openingDepthBias,
  })];
}

/** Physical distance, not NDC depth, remains reliable with the 1e6 far plane. */
export function isRayDistanceVisible(
  raycaster: THREE.Raycaster,
  occluders: THREE.Object3D[],
  distance: number,
  epsilonMm: number,
): boolean {
  const nearest = raycaster.intersectObjects(occluders, false)[0];
  return !nearest || nearest.distance >= distance - epsilonMm;
}

/** Independently owned geometry: deselection must not dispose the pickable mesh. */
export function createSelectionVisual(target: THREE.Mesh | THREE.Line): THREE.Group {
  const group = new THREE.Group();
  if (target instanceof THREE.Mesh) {
    const fill = new THREE.Mesh(target.geometry.clone(), new THREE.MeshBasicMaterial({
      color: viewerTokens.accent,
      transparent: true,
      opacity: viewerTokens.selectionFillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }));
    fill.renderOrder = 3;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(target.geometry, 12),
      new THREE.LineBasicMaterial({ color: viewerTokens.accent, transparent: true, opacity: 0.96, depthWrite: false }),
    );
    outline.renderOrder = 4;
    group.add(fill, outline);
  } else {
    group.add(new THREE.Line(target.geometry.clone(), new THREE.LineBasicMaterial({ color: viewerTokens.accent })));
  }
  target.updateWorldMatrix(true, false);
  group.applyMatrix4(target.matrixWorld);
  if (target instanceof THREE.Mesh) {
    // Use the authoritative outward parent normal rather than triangle winding.
    // Geometry normal is a fallback for standalone callers without model metadata.
    const normal = target.userData.surfaceNormal instanceof THREE.Vector3
      ? target.userData.surfaceNormal.clone()
      : new THREE.Vector3().fromBufferAttribute(target.geometry.getAttribute("normal"), 0);
    normal.transformDirection(target.matrixWorld);
    group.position.addScaledVector(normal, viewerTokens.selectionOffsetMm);
  }
  return group;
}

/** Baked soft decal, in the model's XY footprint plane. No shadow-map/light resources. */
export function createContactShadow(bounds: Bounds3): THREE.Mesh {
  const resolution = 64;
  const data = new Uint8Array(resolution * resolution * 4);
  const color = new THREE.Color(viewerTokens.dimensionLine);
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const dx = Math.abs((x + 0.5) / resolution * 2 - 1);
      const dy = Math.abs((y + 0.5) / resolution * 2 - 1);
      const radius = Math.pow(Math.pow(dx, 4) + Math.pow(dy, 4), 0.25);
      const fade = Math.max(0, Math.min(1, (1 - radius) / 0.5));
      const offset = (y * resolution + x) * 4;
      data[offset] = Math.round(color.r * 255);
      data[offset + 1] = Math.round(color.g * 255);
      data[offset + 2] = Math.round(color.b * 255);
      data[offset + 3] = Math.round(fade * fade * (3 - 2 * fade) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, resolution, resolution);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(1, bounds.widthMm) * 1.24, Math.max(1, bounds.depthMm) * 1.24),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: viewerTokens.contactShadowOpacity,
      depthWrite: false, toneMapped: false,
    }),
  );
  shadow.position.set((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.min.z - 8);
  shadow.name = "presentation-contact-shadow";
  return shadow;
}

/** Includes decal textures; shared resources are disposed only once per root. */
export function disposeRenderObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(item => {
    if (!(item instanceof THREE.Mesh || item instanceof THREE.Line || item instanceof THREE.LineSegments)) return;
    geometries.add(item.geometry);
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
  }
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

export function clearRenderGroup(group: THREE.Group): void {
  disposeRenderObject(group);
  group.clear();
}