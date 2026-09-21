import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import fixture from "../../../../fixtures/garage-house.json";
import { buildModel } from "./model";
import { buildPresentationClosure } from "./model/closure";
import { canonicalSurfaceHit, placeSurfaceVisual, clearRenderGroup, createConditionVisual, createContactShadow, createSelectionVisual, disposeRenderObject, isRayDistanceVisible, polygonGeometry, polygonMaterial } from "./renderResources";
import { findSelectableElement, getSelectionDetails } from "./interaction";
import { viewerTokens } from "./tokens";

describe("viewer presentation rendering resources", () => {
  const model = buildModel(fixture);
  it("preserves both actual condition records, parent planes and photo metadata", () => {
    expect(model.conditions.map(c => [c.id, c.parentFaceId, c.severity, c.photoIndex])).toEqual([
      ["CA-1", "WL-3", "moderate", 4], ["CA-2", "WL-2", "light", 3],
    ]);
    for (const part of model.conditions) {
      expect(findSelectableElement(model, part.id)).toBe(part);
      expect(getSelectionDetails(part).kind).toBe("condition");
      const wall = model.walls.find(w => w.id === part.parentFaceId)!;
      expect(part.normal).toEqual(wall.normal);
      for (const point of part.corners) {
        expect(new THREE.Vector3(point.x - wall.corners[0].x, point.y - wall.corners[0].y, point.z - wall.corners[0].z)
          .dot(new THREE.Vector3(wall.normal.x, wall.normal.y, wall.normal.z))).toBeCloseTo(0);
      }
    }
    expect(buildModel({ ...fixture, condition_areas: [] }).conditions).toEqual([]);
  });
  it("confirms baseline patches lie behind opaque walls from the initial front/right camera", () => {
    const bounds = model.bounds.overall;
    const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
    const camera = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2 + span * 1.28,
      (bounds.min.y + bounds.max.y) / 2 - span * 1.52,
      (bounds.min.z + bounds.max.z) / 2 + span * 0.82);
    const walls = [...model.walls, ...model.roofFaces, ...model.attachments, ...buildPresentationClosure(model)]
      .map(w => new THREE.Mesh(polygonGeometry(w), polygonMaterial(w)));
    walls.forEach(w => w.updateMatrixWorld());
    for (const condition of model.conditions) {
      const target = getSelectionDetails(condition).target;
      const point = new THREE.Vector3(target.x, target.y, target.z);
      const ray = new THREE.Raycaster(camera, point.clone().sub(camera).normalize());
      expect(isRayDistanceVisible(ray, walls, camera.distanceTo(point), 0.5)).toBe(false);
    }
    walls.forEach(disposeRenderObject);
  });
  it("owns translucent hatched decals, red outlines and a render-only normal offset", () => {
    const part = model.conditions[0], before = JSON.stringify(part);
    const mesh = createConditionVisual(part);
    expect(mesh.position.length()).toBe(viewerTokens.conditionOffsetMm);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthTest).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect(mesh.geometry.getAttribute("uv").count).toBe(mesh.geometry.getAttribute("position").count);
    expect(mesh.children[0]).toBeInstanceOf(THREE.LineLoop);
    expect(JSON.stringify(part)).toBe(before);
    const textureDispose = vi.spyOn(material.map!, "dispose");
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    disposeRenderObject(mesh);
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });
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
  it("retains canonical local vertices and raster bias independently of presentation translation", () => {
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
    placeSurfaceVisual(source, part);
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
    const normal = new THREE.Vector3(part.normal.x, part.normal.y, part.normal.z).normalize();
    expect(visual.position.clone().sub(source.position).distanceTo(normal.multiplyScalar(viewerTokens.selectionOffsetMm))).toBeLessThan(1e-6);
    const geometryDisposal = vi.spyOn(fill.geometry, "dispose"), materialDisposal = vi.spyOn(fill.material, "dispose");
    clearRenderGroup(visual);
    expect(visual.children).toHaveLength(0);
    expect(geometryDisposal).toHaveBeenCalledTimes(1);
    expect(materialDisposal).toHaveBeenCalledTimes(1);
    expect(originalDisposal).not.toHaveBeenCalled();
    disposeRenderObject(source);
  });
  it.each(["front", "back", "left", "right", "roof"])("offsets surface openings outward on %s without moving source or measurement hits", elevation => {
    const parent = elevation === "roof" ? model.roofFaces[0] : model.walls.find(wall => wall.elevation === elevation)!;
    const normal = new THREE.Vector3(parent.normal.x, parent.normal.y, parent.normal.z).normalize();
    for (const type of ["window", "door", "garage_door", "patio_door", "skylight"]) {
      const opening = { ...model.openings[0], ...parent, type, parentFaceId: parent.id };
      const before = JSON.stringify(opening);
      const mesh = new THREE.Mesh(polygonGeometry(opening), polygonMaterial(opening));
      placeSurfaceVisual(mesh, opening);
      mesh.updateMatrixWorld(true);
      expect(mesh.position.distanceTo(normal.clone().multiplyScalar(viewerTokens.openingOffsetMm))).toBeLessThan(1e-6);
      const center = opening.triangles[0].reduce<THREE.Vector3>((sum, p) => sum.add(new THREE.Vector3(p.x, p.y, p.z)), new THREE.Vector3()).multiplyScalar(1 / 3);
      const origin = center.clone().addScaledVector(normal, 10000);
      const ray = new THREE.Raycaster(origin, normal.clone().negate());
      const hit = ray.intersectObject(mesh, false)[0];
      expect(hit).toBeDefined();
      expect(hit.distance).toBeCloseTo(10000 - viewerTokens.openingOffsetMm, 2);
      const canonical = canonicalSurfaceHit(hit);
      expect(new THREE.Vector3(canonical.x, canonical.y, canonical.z).distanceTo(center)).toBeLessThan(0.01);
      expect(JSON.stringify(opening)).toBe(before);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        expect(material.depthTest).toBe(true);
        expect(material.polygonOffsetFactor).toBeLessThan(0);
      });
      const selection = createSelectionVisual(mesh);
      expect(selection.position.dot(normal)).toBeCloseTo(viewerTokens.openingOffsetMm + viewerTokens.selectionOffsetMm);
      disposeRenderObject(selection);
      disposeRenderObject(mesh);
    }
  });
  it("places condition selection above its existing 3mm layer with independent outline ownership", () => {
    const part = model.conditions[0];
    const source = createConditionVisual(part);
    const texture = (source.material as THREE.MeshBasicMaterial).map!;
    const sourceDispose = vi.spyOn(texture, "dispose");
    const selection = createSelectionVisual(source);
    const normal = new THREE.Vector3(part.normal.x, part.normal.y, part.normal.z).normalize();
    expect(source.position.dot(normal)).toBe(3);
    expect(selection.position.dot(normal)).toBe(4);
    const fill = selection.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    expect(fill.renderOrder).toBeGreaterThan(source.renderOrder);
    expect(fill.material.polygonOffsetFactor).toBeLessThan((source.material as THREE.MeshBasicMaterial).polygonOffsetFactor);
    expect(fill.material.depthTest).toBe(true);
    const outline = selection.children[1] as THREE.LineSegments;
    const outlineDispose = vi.spyOn(outline.geometry, "dispose");
    disposeRenderObject(selection);
    expect(outlineDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
    disposeRenderObject(source);
    expect(sourceDispose).toHaveBeenCalledOnce();
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