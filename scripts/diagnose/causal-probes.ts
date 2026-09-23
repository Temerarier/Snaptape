import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildModel } from "../../artifacts/aufmass-app/lib/viewer-next/model/buildModel";
import { buildPresentationClosure } from "../../artifacts/aufmass-app/lib/viewer-next/model/closure";
import { polygonMaterial, polygonGeometry } from "../../artifacts/aufmass-app/lib/viewer-next/renderResources";
import { prepareProjectMeasurement } from "../../artifacts/aufmass-app/lib/viewer-next/projectMeasurement";
import { enUS } from "../../artifacts/aufmass-app/i18n/en-US";

// Offline only. Inputs are read, cloned and never written.
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x) ?? "undefined").digest("hex");
const clone = <T>(x: T): T => structuredClone(x);
const paths = [
  ...readdirSync("scripts/diagnose/real").filter(x => x.endsWith(".json")).sort().map(x => `scripts/diagnose/real/${x}`),
  ...readdirSync("export-messungen").filter(x => x.endsWith(".json")).sort().map(x => `export-messungen/${x}`),
  "fixtures/garage-house.json",
];
function run(raw: any) {
  const p = prepareProjectMeasurement(raw, enUS.viewerNext);
  if (p.kind !== "viewer") throw new Error(`Preparation failed: ${p.kind}`);
  return { prepared: p.measurement as any, model: buildModel(p.measurement, p.derived) as any };
}
const geometry = (m: any) => Object.fromEntries(["walls", "roofFaces", "roofs", "attachments", "openings", "edges", "conditions", "massing"].filter(k => Array.isArray(m[k])).map(k => [k, m[k].map((x: any) => ({ id: x.id, corners: x.corners, segments: x.segments })).sort((a: any,b: any) => a.id.localeCompare(b.id))]));
const summarize = (x: any) => ({ id: x.id, elevation: x.elevation, bounds: x.bounds, corners: x.corners, widthMm: x.widthMm, depthMm: x.depthMm, heightMm: x.heightMm });
function materialEvidence(part: any) {
  const material = polygonMaterial(part), materials = Array.isArray(material) ? material : [material];
  const geometry = polygonGeometry(part);
  const result = { id: part.id, color: part.color, groups: geometry.groups, materials: materials.map(m => ({
    color: `#${m.color.getHexString()}`, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, side: m.side,
  })) };
  geometry.dispose(); materials.forEach(m => m.dispose());
  return result;
}
const results = paths.map(path => {
  const text = readFileSync(path, "utf8");
  const raw = JSON.parse(text);
  const { prepared, model } = run(raw);
  const roofKey = Array.isArray(model.roofFaces) ? "roofFaces" : "roofs";
  const roofs = model[roofKey];
  if (!Array.isArray(roofs)) throw new Error(`Unknown roof collection: ${Object.keys(model)}`);
  const closureParts = buildPresentationClosure(model);
  const seams = closureParts.filter(p => p.id.startsWith("presentation-seam"));
  const extent = (parts: any[]) => parts.length ? {
    min: Object.fromEntries(["x","y","z"].map(k => [k, Math.min(...parts.map(p => p.bounds.min[k]))])),
    max: Object.fromEntries(["x","y","z"].map(k => [k, Math.max(...parts.map(p => p.bounds.max[k]))])),
  } : null;
  const closure = { count: closureParts.length, capCount: closureParts.length-seams.length, seamCount: seams.length,
    bounds: extent(closureParts), seamBounds: extent(seams), roofBounds: extent(roofs),
    roofMinZ: Math.min(...roofs.map((p:any) => p.bounds.min.z)),
    seamMinZ: seams.length ? Math.min(...seams.map(p => p.bounds.min.z)) : null,
    parts: closureParts.map(p => ({...summarize(p),material:materialEvidence(p)})) };
  const structuralMaterials = [...model.walls,...roofs,...model.attachments,...model.massing].map(materialEvidence);
  const secondaryColorInventory = raw.faces.map((f:any) => ({id:f.id,face_class:f.face_class,color:f.color,
    modeledColor: [...model.walls,...roofs].find((p:any)=>p.id===f.id)?.color}));
  const annexIds = ["WL-5","WL-6","WL-7"];
  const annexOpenings = {
    input: (raw.openings ?? []).filter((o:any)=>annexIds.includes(o.parent_face_id)),
    model: model.openings.filter((o:any)=>annexIds.includes(o.parentFaceId)).map((o:any)=>({...summarize(o),parentFaceId:o.parentFaceId,material:materialEvidence(o)})),
    walls: model.walls.filter((w:any)=>annexIds.includes(w.id)).map((w:any)=>({...summarize(w),material:materialEvidence(w)})),
    proxies: model.attachments.map((p:any)=>({...summarize(p),parentFaceId:p.parentFaceId,type:p.type,material:materialEvidence(p)})),
    allInputOpeningParents:(raw.openings ?? []).map((o:any)=>({id:o.id,parent_face_id:o.parent_face_id,type:o.type})),
  };
  const probes: any[] = [];
  const probe = (name: string, mutate: (x: any) => void) => {
    const changed = clone(raw); mutate(changed);
    const next = run(changed);
    const beforeGeom = geometry(model), afterGeom = geometry(next.model);
    probes.push({ name, inputChanged: hash(raw) !== hash(changed), identicalFullModel: hash(model) === hash(next.model), identicalCanonicalGeometry: hash(beforeGeom) === hash(afterGeom),
      coordinateChangedParts: Object.keys(beforeGeom).flatMap(k => (afterGeom[k] ?? []).filter((x: any) => {
        const old = beforeGeom[k].find((b: any) => b.id === x.id || (name.startsWith("roof IDs") && b.id + "A" === x.id));
        return old && hash(old.corners) !== hash(x.corners);
      }).map((x: any) => ({collection:k,id:x.id,corners:x.corners}))),
      changedCollections: Object.keys(beforeGeom).filter(k => hash(beforeGeom[k]) !== hash(afterGeom[k])),
      changedParts: Object.keys(beforeGeom).flatMap(k => (afterGeom[k] ?? []).filter((x: any) => hash(x) !== hash(beforeGeom[k].find((b: any) => b.id === x.id))).map((x: any) => ({ collection: k, ...x }))) });
  };
  probe("parent_attachment_id replaced on every face/edge", d => { for (const x of [...d.faces ?? [], ...d.edges ?? []]) x.parent_attachment_id = "AT-causal-probe"; });
  probe("roof_type changed", d => { d.building.roof_type = d.building.roof_type === "flat" ? "hip" : "flat"; });
  probe("per_elevation heights and grade changed", d => { d.building.heights.per_elevation = ["front","back","left","right"].map(elevation => ({ elevation, eave_height_mm: { value: 23456 }, ridge_height_mm: { value: 34567 }, grade_offset_mm: { value: -4321 } })); });
  const points = raw.building?.footprint?.points;
  if (points?.length >= 3) {
    probe("footprint point order reversed (same extents)", d => { d.building.footprint.points.reverse(); });
    probe("footprint concave notch (same extents)", d => {
      const xs = points.map((p: number[]) => p[0]), ys = points.map((p: number[]) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      d.building.footprint.points = [[x0,y0],[x1,y0],[x1,y1],[(x0+x1)/2,(y0+y1)/2],[x0,y1]];
    });
  }
  probe("faces array reversed", d => { d.faces.reverse(); });
  probe("attachments array reversed", d => { d.attachments?.reverse(); });
  probe("roof degrees changed only; snapped ratio retained", d => { d.faces.filter((f: any) => f.face_class === "roof_face").forEach((f: any) => { f.pitch = {...f.pitch, degrees_original: 67, degrees_rounded: 67}; }); });
  probe("roof IDs renamed with parity-changing suffix; references remapped", d => {
    const ids = new Set(d.faces.filter((f: any) => f.face_class === "roof_face").map((f: any) => f.id));
    const visit = (x: any) => { if (!x || typeof x !== "object") return; for (const k of Object.keys(x)) { if ((k === "id" || k === "parent_face_id") && ids.has(x[k])) x[k] += "A"; else visit(x[k]); } }; visit(d);
  });
  probe("addition heights increased 1000", d => { d.attachments?.filter((a: any) => a.type === "addition" && a.height_mm?.value).forEach((a: any) => a.height_mm.value += 1000); });
  const walls = model.walls;
  const overlaps: any[] = [];
  for (let i=0;i<walls.length;i++) for(let j=i+1;j<walls.length;j++) {
    const a=walls[i], b=walls[j];
    if(a.elevation !== b.elevation) continue;
    const axis = ["front","back"].includes(a.elevation) ? "x" : "y", normal = axis === "x" ? "y" : "x";
    const span = Math.min(a.bounds.max[axis], b.bounds.max[axis])-Math.max(a.bounds.min[axis],b.bounds.min[axis]);
    const z = Math.min(a.bounds.max.z,b.bounds.max.z)-Math.max(a.bounds.min.z,b.bounds.min.z);
    if(Math.abs(a.bounds.min[normal]-b.bounds.min[normal])<1e-6 && span>0 && z>0) overlaps.push({ids:[a.id,b.id], commonSpanMm:span, commonZExtentMm:z, interpretation:"coplanar bounding-envelope overlap; not polygon intersection area"});
  }
  const gables = walls.filter((w: any) => prepared.faces.find((f: any)=>f.id===w.id)?.gable_height_mm?.value>0).map((w: any) => {
    const apex = w.corners.reduce((a: any,b: any)=>a.z>b.z?a:b);
    return {id:w.id, apex, roofAtApexXY:roofs.filter((r:any)=>apex.x>=r.bounds.min.x && apex.x<=r.bounds.max.x && apex.y>=r.bounds.min.y && apex.y<=r.bounds.max.y).map((r:any)=>{
      const p=r.corners[0], n=r.normal;
      const roofZ = Math.abs(n.z)>1e-9 ? p.z-(n.x*(apex.x-p.x)+n.y*(apex.y-p.y))/n.z : null;
      return {id:r.id,roofZ,apexMinusRoofZ:roofZ===null?null:apex.z-roofZ};
    })};
  });
  return {path, inputSha256:createHash("sha256").update(text).digest("hex"), modelKeys:Object.keys(model), rawBuilding:raw.building,
    walls:{input:raw.faces.filter((f:any)=>f.face_class==="wall"), retained:walls.map((w:any)=>w.id), dropped:raw.faces.filter((f:any)=>f.face_class==="wall"&&!walls.some((w:any)=>w.id===f.id)).map((f:any)=>f.id), model:walls.map(summarize), overlaps,gables},
    roofs:{input:raw.faces.filter((f:any)=>f.face_class==="roof_face"), model:roofs.map(summarize)},
    attachments:{input:raw.attachments,model:model.attachments.map(summarize)},
    closure, structuralMaterials, secondaryColorInventory, annexOpenings,
    probes, notes:model.notes };
});
writeFileSync("scripts/diagnose/causal-results.json", JSON.stringify({ units:"mm; z is vertical", method:"actual prepareProjectMeasurement + buildModel; isolated in-memory mutations; canonical geometry is sorted by ID, full model is not", results },null,2)+"\n");
console.log(JSON.stringify(results.map(r=>({path:r.path, walls:r.walls.retained.length,dropped:r.walls.dropped, overlaps:r.walls.overlaps, gables:r.walls.gables, attachments:r.attachments.model.filter((a:any)=>["AT-5","AT-7","AT-8","AT-9"].includes(a.id)),probes:r.probes.map(p=>({name:p.name,full:p.identicalFullModel,geometry:p.identicalCanonicalGeometry}))})),null,2));