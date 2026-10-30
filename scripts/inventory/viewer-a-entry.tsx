// Test-only component host. Original production components and event handlers.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import * as THREE from "three";
import { ProjectViewer } from "../../artifacts/aufmass-app/components/viewer-next/ProjectViewer";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
import { modelFromModel3d } from "../../artifacts/aufmass-app/lib/viewer-next/model/fromModel3d";
import { getDictionary } from "../../artifacts/aufmass-app/i18n";
import { LocaleProvider } from "../../artifacts/aufmass-app/i18n/LocaleProvider";
const w = window as any;
const root = createRoot(document.getElementById("root")!);
const dict = getDictionary("en-US");
let model: ReturnType<typeof modelFromModel3d>;
let live: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer };
w.mountInventory = (id: string, measurement: any, model3d: any, status: "ready" | "pending" = "ready") => {
  w.inventoryRender = null;
  const p = prepareProjectMeasurement(measurement, dict.viewerNext);
  if (p.kind !== "viewer") throw new Error(`Preparation: ${p.kind}`);
  model = modelFromModel3d(model3d, p.measurement, p.derived);
  flushSync(() => root.render(<LocaleProvider locale="en-US" dict={dict}><ProjectViewer key={id}
    measurement={measurement} model3d={status === "ready" ? model3d : null} model3dStatus={status} projectName={`Acceptance ${id}`}
    projectAddress={null} dict={dict.viewerNext} webglMessage={dict.viewer.webglFehler}/></LocaleProvider>));
  return { preparation: p.kind, modeled: {
    walls: model.walls.length, roofs: model.roofFaces.length, openings: model.openings.length,
  } };
};
w.inventoryColors = () => ({
  walls: model.walls.map(part => ({ id: part.id, ...part.color })),
  roofs: model.roofFaces.map(part => ({ id: part.id, ...part.color })),
});
w.observeRender = function(this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  live = { scene, camera, renderer: this };
  const gl = this.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  w.inventoryRender = { triangles: this.info.render.triangles, drawCalls: this.info.render.calls,
    glError: gl.getError(), contextLost: gl.isContextLost(),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
};
const vector = (p: {x:number;y:number;z:number}) => new THREE.Vector3(p.x,p.y,p.z);
function project(p: THREE.Vector3) {
  const rect = live.renderer.domElement.getBoundingClientRect();
  const q = p.clone().project(live.camera);
  return { x: rect.left + (q.x + 1) * rect.width / 2, y: rect.top + (1 - q.y) * rect.height / 2,
    visible: Math.abs(q.x) < .96 && Math.abs(q.y) < .96 && Math.abs(q.z) < 1 };
}
w.inventoryView = (angle: number) => {
  const b = model.bounds.overall;
  const centre = new THREE.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2);
  const span = Math.max(b.widthMm,b.depthMm,b.heightMm);
  let framed = false;
  for(let padding=1; padding<=1.8; padding+=.15) {
    live.camera.position.copy(centre).add(new THREE.Vector3(Math.sin(angle)*span*2.4*padding,-Math.cos(angle)*span*2.4*padding,span*.99*padding));
    w.inventoryControls.target.copy(centre);
    w.inventoryControls.update();
    framed = [b.min.x,b.max.x].every(x=>[b.min.y,b.max.y].every(y=>[b.min.z,b.max.z].every(z=>project(new THREE.Vector3(x,y,z)).visible)));
    if(framed) break;
  }
  w.inventoryControls.dispatchEvent({type:"change"});
  return { camera: live.camera.position.toArray(), target: centre.toArray(), framed };
};
function objects() {
  const parts: THREE.Object3D[] = [];
  live.scene.traverse(o => { if (o.userData.elementId &&
    (o.userData.elementKind !== "condition" || o.parent?.visible)) parts.push(o); });
  return parts;
}
function hit(p: THREE.Vector3) {
  const q = p.clone().project(live.camera);
  const ray = new THREE.Raycaster();
  ray.params.Line.threshold = Math.max(model.bounds.overall.widthMm*.015,80);
  ray.setFromCamera(new THREE.Vector2(q.x,q.y),live.camera);
  const priority: Record<string,number> = {condition:-1,opening:0,attachment:1,face:2,edge:3};
  const hits = ray.intersectObjects(objects(),false).sort((a,b) =>
    Math.abs(a.distance-b.distance)>.5 ? a.distance-b.distance :
      (priority[a.object.userData.elementKind]??9)-(priority[b.object.userData.elementKind]??9));
  return hits[0]?.object.userData.elementId;
}
w.inventoryPick = (id: string, allowOccluded = false) => {
  const parts = objects().filter(o=>o.userData.elementId===id);
  for (const o of parts) {
    const geometry = (o as THREE.Mesh).geometry;
    const pos = geometry?.getAttribute("position");
    if (!pos) continue;
    const points: THREE.Vector3[] = [];
    const box = new THREE.Box3().setFromObject(o);
    points.push(box.getCenter(new THREE.Vector3()));
    if (o instanceof THREE.Line) {
      for(let i=0;i<pos.count-1;i++) for(const t of [.25,.5,.75])
        points.push(new THREE.Vector3().fromBufferAttribute(pos,i).lerp(new THREE.Vector3().fromBufferAttribute(pos,i+1),t).applyMatrix4(o.matrixWorld));
    } else {
      const index=geometry.getIndex();
      for(let i=0;i<(index?.count??pos.count);i+=3) {
        const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j));
        points.push(vs[0].add(vs[1]).add(vs[2]).divideScalar(3).applyMatrix4(o.matrixWorld));
      }
    }
    for (const p of points) {
      const screen=project(p);
      if(screen.visible && (allowOccluded || hit(p)===id)) return {...screen, id, predictedHit:hit(p), point:p.toArray()};
    }
  }
  return null;
};
w.inventoryEave = () => {
  const edge=model.edges.find(e=>e.edgeClass==="eave" && e.elevation==="front") ?? model.edges.find(e=>e.edgeClass==="eave");
  if(!edge) throw new Error("No measured eave edge");
  return { id:edge.id, start:project(vector(edge.corners[0])), end:project(vector(edge.corners[1])),
    midpoint:project(vector(edge.corners[0]).lerp(vector(edge.corners[1]),.5)) };
};
w.inventoryState = () => ({
  source:document.querySelector("[data-geometry-source]")?.getAttribute("data-geometry-source"),
  webgl:document.querySelector("[data-webgl-state]")?.getAttribute("data-webgl-state"),
  selected:[...document.querySelectorAll(".viewer-next-selected-row")].map(el=>el.getAttribute("data-viewer-row-id")),
  blackbox:document.querySelector('[data-testid="selection-label"]')?.textContent,
  measures:[...document.querySelectorAll(".viewer-next-measure-label")].map(el=>el.textContent),
});
