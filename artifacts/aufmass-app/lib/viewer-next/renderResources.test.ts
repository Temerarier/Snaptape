import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import fixture from "../../../../fixtures/garage-house.json";
import { buildModel } from "./model";
import { buildPresentationClosure } from "./model/closure";
import { clearRenderGroup, createContactShadow, createSelectionVisual, disposeRenderObject, isRayDistanceVisible, polygonGeometry, polygonMaterial } from "./renderResources";
import { viewerTokens } from "./tokens";

describe("viewer presentation rendering resources", () => {
  const model = buildModel(fixture);
  it("uses one simple blue glass material without alternating triangles", () => {
    const opening = model.openings.find(part => part.type === "window")!;
    expect(opening).toBeDefined();
    const geometry = polygonGeometry(opening), material = polygonMaterial(opening);
    expect(Array.isArray(material)).toBe(false);
    if (Array.isArray(material)) throw new Error("Glazing must have a single material");
    expect(geometry.groups).toEqual([]);
    expect(material.color.getHexString()).toBe(new THREE.Color(viewerTokens.modelWindow).getHexString());
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(viewerTokens.glassOpacity);
    expect(material.depthWrite).toBe(false);
    geometry.dispose(); material.dispose();
  });
  it("preserves source secondary colours and alternating groups on non-glazing faces", () => {
    const walls = model.walls.filter(part => part.color.secondaryHex && part.triangles.length >= 2);
    expect(walls.length).toBeGreaterThanOrEqual(2);
    for (const wall of walls) {
      const geometry = polygonGeometry(wall), materials = polygonMaterial(wall);
      expect(Array.isArray(materials)).toBe(true);
      if (!Array.isArray(materials)) throw new Error("Source secondary material was lost");
      expect(materials).toHaveLength(2);
      expect(materials[0].color.getHexString()).toBe(new THREE.Color(wall.color.hex).getHexString());
      expect(materials[1].color.getHexString()).toBe(new THREE.Color(wall.color.secondaryHex!).getHexString());
      expect(materials[1].opacity).toBe(0.42);
      expect(materials[1].roughness).toBe(0.88);
      expect(geometry.groups.map(group => group.materialIndex)).toEqual(wall.triangles.map((_, index) => index % 2));
      geometry.dispose(); materials.forEach(material => material.dispose());
    }
  });
  it.each(["window", "skylight"])("suppresses secondary groups only for %s glazing", type => {
    const source = model.openings.find(part => part.type === "window")!;
    const secondaryHex = model.walls.find(part => part.color.secondaryHex)!.color.secondaryHex;
    const glazing = { ...source, type, color: { ...source.color, secondaryHex } };
    const mesh = new THREE.Mesh(polygonGeometry(glazing), polygonMaterial(glazing));
    expect(Array.isArray(mesh.material)).toBe(false);
    expect(mesh.geometry.groups).toEqual([]);
    disposeRenderObject(mesh);
  });
  it("biases only opening raster depth without moving measured vertices or changing ray hits", () => {
    for (const opening of model.openings) {
      const geometry = polygonGeometry(opening), material = polygonMaterial(opening);
      const materials = Array.isArray(material) ? material : [material];
      materials.forEach(item => {
        expect(item.polygonOffset).toBe(true);
        expect(item.polygonOffsetFactor).toBe(-1);
        expect(item.polygonOffsetUnits).toBe(-1);
      });
      const expectedPositions = new Float32Array(opening.triangles.flatMap(triangle => triangle.flatMap(p => [p.x, p.y, p.z])));
      expect(geometry.getAttribute("position").array).toEqual(expectedPositions);
      const triangle = opening.triangles[0];
      const target = triangle.reduce<THREE.Vector3>((sum, point) => sum.add(new THREE.Vector3(point.x, point.y, point.z)), new THREE.Vector3()).multiplyScalar(1 / 3);
      const normal = new THREE.Vector3(opening.normal.x, opening.normal.y, opening.normal.z).normalize();
      const origin = target.clone().addScaledVector(normal, 10000);
      const raycaster = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 1, 1000000);
      const mesh = new THREE.Mesh(geometry, material);
      const biasedHit = raycaster.intersectObject(mesh, false)[0];
      expect(biasedHit).toBeDefined();
      materials.forEach(item => { item.polygonOffset = false; });
      const unbiasedHit = raycaster.intersectObject(mesh, false)[0];
      expect(biasedHit.distance).toBe(unbiasedHit.distance);
      expect(biasedHit.point.equals(unbiasedHit.point)).toBe(true);
      disposeRenderObject(mesh);
    }
    for (const part of [...model.walls, ...model.roofFaces, ...model.attachments, ...model.conditions]) {
      const material = polygonMaterial(part);
      for (const item of Array.isArray(material) ? material : [material]) {
        expect(item.polygonOffset).toBe(false);
        item.dispose();
      }
    }
  });
  it("rejects a real roof hit and snap hidden by the nonselectable floor from underneath", () => {
    const roof = model.roofFaces[0];
    const triangle = roof.triangles[0];
    const target = triangle.reduce<THREE.Vector3>((sum, point) => sum.add(new THREE.Vector3(point.x, point.y, point.z)), new THREE.Vector3()).multiplyScalar(1 / 3);
    const span = Math.max(model.bounds.overall.widthMm, model.bounds.overall.depthMm, model.bounds.overall.heightMm);
    const camera = new THREE.PerspectiveCamera(38, 960 / 720, 1, 1000000);
    camera.up.set(0, 0, 1);
    camera.position.set(target.x + span * 0.05, target.y - span * 0.05, -span);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const interactive = [new THREE.Mesh(polygonGeometry(roof), polygonMaterial(roof))];
    const occluders = buildPresentationClosure(model).map(part => new THREE.Mesh(polygonGeometry(part), polygonMaterial(part)));
    const roofHit = raycaster.intersectObjects(interactive, false)[0];
    expect(roofHit).toBeDefined();
    expect(isRayDistanceVisible(raycaster, [], roofHit.distance, 0.5)).toBe(true);
    expect(isRayDistanceVisible(raycaster, occluders, roofHit.distance, 0.5)).toBe(false);
    expect(isRayDistanceVisible(raycaster, occluders, camera.position.distanceTo(target), 8)).toBe(false);
    expect(occluders.every(mesh => !interactive.includes(mesh))).toBe(true);
    [...interactive, ...occluders].forEach(disposeRenderObject);
  });
  it("blocks points behind real presentation seams without creating selectable snap targets", () => {
    const seams = buildPresentationClosure(model).filter(part => part.id.startsWith("presentation-seam"));
    expect(seams.length).toBeGreaterThan(0);
    for (const seam of seams) {
      const triangle = seam.triangles[0];
      const centre = triangle.reduce<THREE.Vector3>((sum, point) => sum.add(new THREE.Vector3(point.x, point.y, point.z)), new THREE.Vector3()).multiplyScalar(1 / 3);
      const normal = new THREE.Vector3(seam.normal.x, seam.normal.y, seam.normal.z).normalize();
      const camera = new THREE.PerspectiveCamera(38, 960 / 720, 1, 1000000);
      camera.up.set(0, 0, 1);
      camera.position.copy(centre).addScaledVector(normal, 10000);
      const hidden = centre.clone().addScaledVector(normal, -100);
      camera.lookAt(hidden); camera.updateMatrixWorld(true);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const mesh = new THREE.Mesh(polygonGeometry(seam), polygonMaterial(seam));
      expect(isRayDistanceVisible(raycaster, [mesh], camera.position.distanceTo(hidden), 0.5)).toBe(false);
      expect(isRayDistanceVisible(raycaster, [mesh], camera.position.distanceTo(hidden), 8)).toBe(false);
      const visible = centre.clone().addScaledVector(normal, 100);
      expect(isRayDistanceVisible(raycaster, [mesh], camera.position.distanceTo(visible), 8)).toBe(true);
      expect([...model.walls, ...model.roofFaces, ...model.openings, ...model.attachments, ...model.edges].some(part => part.id === seam.id)).toBe(false);
      disposeRenderObject(mesh);
    }
  });
  it.each(["wall", "roof", "opening"])("fills a selected %s and owns/disposes its own resources", kind => {
    const part = kind === "wall" ? model.walls[0] : kind === "roof" ? model.roofFaces[0] : model.openings[0];
    const source = new THREE.Mesh(polygonGeometry(part), polygonMaterial(part));
    const originalDisposal = vi.spyOn(source.geometry, "dispose");
    const visual = createSelectionVisual(source);
    const fill = visual.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    expect(fill).toBeDefined();
    expect(fill.geometry).not.toBe(source.geometry);
    expect(fill.material.opacity).toBe(viewerTokens.selectionFillOpacity);
    expect(fill.material.transparent).toBe(true);
    expect(fill.material.depthWrite).toBe(false);
    expect(fill.material.polygonOffset).toBe(true);
    expect(fill.material.side).toBe(THREE.DoubleSide);
    const geometryDisposal = vi.spyOn(fill.geometry, "dispose"), materialDisposal = vi.spyOn(fill.material, "dispose");
    clearRenderGroup(visual);
    expect(visual.children).toHaveLength(0);
    expect(geometryDisposal).toHaveBeenCalledTimes(1);
    expect(materialDisposal).toHaveBeenCalledTimes(1);
    expect(originalDisposal).not.toHaveBeenCalled();
    disposeRenderObject(source);
  });
  it("scales a soft contact decal to footprint and disposes its texture", () => {
    const shadow = createContactShadow(model.bounds.overall);
    const geometry = shadow.geometry as THREE.PlaneGeometry;
    const material = shadow.material as THREE.MeshBasicMaterial;
    const texture = material.map as THREE.DataTexture;
    expect(geometry.parameters.width).toBeCloseTo(model.bounds.overall.widthMm * 1.24);
    expect(geometry.parameters.height).toBeCloseTo(model.bounds.overall.depthMm * 1.24);
    expect(shadow.position.z).toBeLessThan(model.bounds.overall.min.z);
    expect(material.depthWrite).toBe(false);
    const pixels = texture.image.data as Uint8Array;
    expect(pixels[3]).toBe(0);
    expect(pixels[(32 * 64 + 32) * 4 + 3]).toBe(255);
    const textureDisposal = vi.spyOn(texture, "dispose");
    const materialDisposal = vi.spyOn(material, "dispose");
    const geometryDisposal = vi.spyOn(geometry, "dispose");
    const root = new THREE.Group();
    root.add(shadow, new THREE.Mesh(geometry, material));
    disposeRenderObject(root);
    expect(textureDisposal).toHaveBeenCalledTimes(1);
    expect(materialDisposal).toHaveBeenCalledTimes(1);
    expect(geometryDisposal).toHaveBeenCalledTimes(1);
  });
});