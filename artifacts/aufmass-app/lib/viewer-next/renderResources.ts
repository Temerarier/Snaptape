import * as THREE from "three";
import type { Bounds3, ModelPolygon } from "./model";
import { viewerTokens } from "./tokens";

function isGlazing(part: ModelPolygon): boolean {
  return "type" in part && (part.type === "window" || part.type === "skylight");
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
  const opening = "type" in part && "parentFaceId" in part && "widthMm" in part && !("depthMm" in part);
  // Openings intentionally retain measured, coplanar geometry. Bias raster
  // depth only, keeping raycasting/snapping coordinates exactly unchanged.
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
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }));
    fill.renderOrder = 2;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(target.geometry, 12),
      new THREE.LineBasicMaterial({ color: viewerTokens.accent, transparent: true, opacity: 0.96, depthWrite: false }),
    );
    outline.renderOrder = 3;
    group.add(fill, outline);
  } else {
    group.add(new THREE.Line(target.geometry.clone(), new THREE.LineBasicMaterial({ color: viewerTokens.accent })));
  }
  group.applyMatrix4(target.matrix);
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