
// A1: one healing pass between the two Ajv schema validations. Wiring contract for the
// schema-validation step (n8n and app pipeline alike): validate once; call
// healNullFields(result, ajvErrors); if it healed anything, validate a SECOND and final
// time. For every error "must be number/array/string/object" whose actual value is null,
// the property is dropped (arrays -> []). Remaining errors after the second validation
// fail the run as before. Ported 1:1 as heileNullFelder in lib/messung/berechnung.ts and
// executed around validateMeasurement in lib/messung/pipeline.ts.
// Errors are processed in DESCENDING path order so splicing an array element cannot
// shift the indices of elements still to be healed.
function healNullFields(doc, errors) {
  let healed = 0;
  const segsOf = (path) => String(path || '').split('/').slice(1);
  const sorted = (errors || []).slice().sort((a, b) => {
    const A = segsOf(a && a.instancePath), B = segsOf(b && b.instancePath);
    const n = Math.max(A.length, B.length);
    for (let i = 0; i < n; i++) {
      const x = A[i], y = B[i];
      if (x === y) continue;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      const nx = Number(x), ny = Number(y);
      if (!Number.isNaN(nx) && !Number.isNaN(ny)) return ny - nx;
      return x < y ? 1 : -1;
    }
    return 0;
  });
  sorted.forEach(err => {
    const m = /^must be (number|integer|array|string|object)$/.exec(String(err && err.message || ''));
    if (!m || !err.instancePath) return;
    const parts = err.instancePath.split('/').slice(1).map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (!parts.length) return;
    let node = doc;
    for (let i = 0; i < parts.length - 1 && node && typeof node === 'object'; i++) node = node[parts[i]];
    if (!node || typeof node !== 'object') return;
    const key = parts[parts.length - 1];
    if (node[key] !== null) return;
    if (m[1] === 'array') node[key] = [];
    else if (Array.isArray(node)) node.splice(Number(key), 1);
    else delete node[key];
    healed++;
  });
  return healed;
}
const p = $input.first().json;
const r = p.result || {};
const v = [];
const isMeas = (m) => m && typeof m === 'object' && typeof m.value === 'number' && ['high', 'medium', 'low'].indexOf(m.confidence) >= 0 && ['measured', 'scaled', 'estimated'].indexOf(m.source) >= 0;
if (!r.meta || ['US', 'DE'].indexOf(r.meta.country) < 0) v.push('meta.country missing or not US/DE');
if (!r.building || !r.building.roof_type) v.push('building.roof_type missing');
['references', 'faces', 'edges', 'openings'].forEach(k => { if (!Array.isArray(r[k])) { v.push(k + ' is not an array'); r[k] = []; } });
// v1.5: optional arrays default to [] instead of failing
['attachments', 'downspouts', 'condition_areas'].forEach(k => { if (r[k] === null || r[k] === undefined) r[k] = []; else if (!Array.isArray(r[k])) { v.push(k + ' is not an array'); r[k] = []; } });
// A0: building.footprint.points is optional: null/undefined → [] (model cannot always derive the outline)
const fpn = r.building && r.building.footprint; if (fpn) { if (fpn.points === null || fpn.points === undefined) fpn.points = []; else if (!Array.isArray(fpn.points)) { v.push('building.footprint.points is not an array'); fpn.points = []; } }
const idRules = [['faces', /^(RF|WL|SF|FC)-\d+$/], ['edges', /^E-\d+$/], ['openings', /^(W|D|G|SK)-\d+$/], ['attachments', /^AT-\d+$/], ['downspouts', /^DS-\d+$/], ['condition_areas', /^CA-\d+$/]]; // v1.5: new id patterns
idRules.forEach(pair => { const k = pair[0]; const rx = pair[1]; (r[k] || []).forEach(el => { if (!el || typeof el.id !== 'string' || !rx.test(el.id)) v.push(k + ': bad id ' + (el && el.id)); }); });
const EDGE_CLASSES = ['ridge','hip','valley','eave','rake','flashing','step_flashing','outside_corner','inside_corner','base','head','sill','jamb','unclassified'];
(r.edges || []).forEach(el => { if (el && el.edge_class && EDGE_CLASSES.indexOf(el.edge_class) < 0) v.push(String(el.id) + ': unknown edge_class ' + String(el.edge_class)); });
const rtv = r.building ? r.building.roof_type : null;
const roofFacesN = (r.faces || []).filter(f => f && f.face_class === 'roof_face').length;
const wallFacesN = (r.faces || []).filter(f => f && f.face_class === 'wall').length;
if (rtv && ['flat', 'unknown'].indexOf(rtv) < 0 && roofFacesN === 0) v.push('roof_type ' + rtv + ' but no roof faces reported');
if (wallFacesN === 0) v.push('no wall faces reported');
if ((r.edges || []).length === 0) v.push('no edges reported');
const num = (m) => (m && typeof m === 'object') ? m.value : (typeof m === 'number' ? m : null);
const eave = r.building && r.building.heights ? num(r.building.heights.eave_height_mm) : null;
const ridge = r.building && r.building.heights ? num(r.building.heights.ridge_height_mm) : null;
if (eave !== null && (eave < 2000 || eave > 12000)) v.push('eave height ' + Math.round(eave) + ' mm outside 2000-12000');
if (ridge !== null && eave !== null && ridge < eave) v.push('ridge height below eave height');
(r.openings || []).forEach(o => {
  const w = num(o.width_mm); const h = num(o.height_mm);
  if (w !== null && (w < 300 || w > 7000)) v.push(String(o.id) + ': width ' + Math.round(w) + ' mm outside 300-7000');
  if (h !== null && (h < 300 || h > 6000)) v.push(String(o.id) + ': height ' + Math.round(h) + ' mm outside 300-6000');
  if (o.width_mm !== null && o.width_mm !== undefined && !isMeas(o.width_mm)) v.push(String(o.id) + ': width_mm is not a valid measurement object');
  if (o.height_mm !== null && o.height_mm !== undefined && !isMeas(o.height_mm)) v.push(String(o.id) + ': height_mm is not a valid measurement object');
});
const q = (r.quality && typeof r.quality === 'object') ? r.quality : {};
r.quality = q;
q.warnings = Array.isArray(q.warnings) ? q.warnings : [];
v.forEach(x => q.warnings.push('VALIDATION: ' + x));
(function () {
  const fpV = (r.building && r.building.footprint) || {};
  const wV = num(fpV.width_mm), dV = num(fpV.depth_mm);
  const facesV = Array.isArray(r.faces) ? r.faces : [];
  const edgesV = Array.isArray(r.edges) ? r.edges : [];
  const pList0 = facesV.filter(f => f && f.face_class === 'roof_face' && f.pitch && typeof f.pitch.degrees_original === 'number').map(f => f.pitch.degrees_original);
  const pList = (pList0.some(x => x >= 15) ? pList0.filter(x => x >= 10) : pList0).sort((a, b) => a - b); // B1: ignore near-flat faces (<10 deg) in pitch stats and ridge/geometry checks when other faces are >=15 deg
  const pdeg = pList.length ? pList[Math.floor((pList.length - 1) / 2)] : null;
  const pMin = pList.length ? pList[0] : null, pMax = pList.length ? pList[pList.length - 1] : null;
  const unequalPitch = pMin !== null && pMax !== null && (pMax - pMin) > 8;
  const rt2 = r.building ? r.building.roof_type : null;
  const sumE = (cls) => { let s = 0, any = false; edgesV.forEach(e => { if (e && e.edge_class === cls) { const l = num(e.length_mm); if (typeof l === 'number') { s += l; any = true; } } }); return any ? s : null; };
  const gcheck = (name, model, geo, tol) => { if (model === null || geo === null || geo <= 0) return; const dv2 = Math.abs(model - geo) / geo; if (dv2 > tol) q.warnings.push('geometry check ' + name + ': model ' + Math.round(model) + ' vs derived ' + Math.round(geo) + ' (' + Math.round(dv2 * 100) + '% off)'); };
  // A6: complex roofs (more than one ridge edge or any valley edge) skip the single-pitch gable/hip formula block entirely
  const ridgeEdgeCount = edgesV.filter(e => e && e.edge_class === 'ridge' && typeof num(e.length_mm) === 'number').length;
  const valleyEdgeCount = edgesV.filter(e => e && e.edge_class === 'valley').length;
  const complexRoof = ridgeEdgeCount > 1 || valleyEdgeCount >= 1;
  if (wV && dV && pdeg !== null && pdeg > 3 && pdeg < 80 && (rt2 === 'gable' || rt2 === 'hip') && complexRoof) {
    q.warnings.push('geometry checks skipped: complex roof (' + ridgeEdgeCount + ' ridge edge(s), ' + valleyEdgeCount + ' valley edge(s)), single-pitch gable/hip formulas not applicable');
  } else if (wV && dV && pdeg !== null && pdeg > 3 && pdeg < 80 && (rt2 === 'gable' || rt2 === 'hip')) {
    const rad = pdeg * Math.PI / 180, cosp = Math.cos(rad), tanp = Math.tan(rad);
    const mRidge = sumE('ridge');
    if (unequalPitch) q.warnings.push('geometry checks adapted: unequal facet pitches (' + Math.round(pMin) + '-' + Math.round(pMax) + ' deg), single-pitch formulas skipped');
    let L2 = Math.max(wV, dV), S2 = Math.min(wV, dV);
    if (rt2 === 'gable' && mRidge !== null) { if (Math.abs(mRidge - wV) <= Math.abs(mRidge - dV)) { L2 = wV; S2 = dV; } else { L2 = dV; S2 = wV; } }
    const slope = (S2 / 2) / cosp;
    if (rt2 === 'gable') {
      gcheck('ridge length', mRidge, L2, 0.12);
      gcheck('eave total', sumE('eave'), 2 * L2, 0.12);
      if (!unequalPitch) gcheck('rake total', sumE('rake'), 4 * slope, 0.12);
    } else {
      const ridgeGeo = unequalPitch ? Math.max(L2 - S2 * Math.tan(pMin * Math.PI / 180) / Math.tan(pMax * Math.PI / 180), 0) : Math.max(L2 - S2, 0);
      gcheck('ridge length', mRidge, ridgeGeo, unequalPitch ? 0.25 : 0.15);
      gcheck('eave total', sumE('eave'), 2 * (L2 + S2), 0.12);
      if (!unequalPitch) gcheck('hip total', sumE('hip'), 4 * (S2 / 2) * Math.sqrt(tanp * tanp + 2), 0.15);
    }
    let rSum = 0, rAny = false;
    facesV.forEach(f => { if (f && f.face_class === 'roof_face') { const a = num(f.area_mm2); if (typeof a === 'number') { rSum += a; rAny = true; } } });
    if (!unequalPitch) gcheck('roof area', rAny ? rSum : null, (L2 * S2) / cosp, 0.12);
    if (!unequalPitch && eave !== null && ridge !== null) gcheck('rise (ridge height minus eave height)', ridge - eave, (S2 / 2) * tanp, 0.15);
  }
  const wallByElev = {};
  facesV.forEach(f => { if (f && f.face_class === 'wall' && f.elevation) { const a = num(f.area_mm2); if (typeof a === 'number') wallByElev[f.elevation] = (wallByElev[f.elevation] || 0) + a; } });
  // B2: openings whose sill sits at/above the elevation's eave (dormers) are excluded from the wall cross-check
  const eaveByElevV = {};
  const htsV = (r.building && r.building.heights) || {};
  (Array.isArray(htsV.per_elevation) ? htsV.per_elevation : []).forEach(pe => { const ev = pe ? num(pe.eave_height_mm) : null; if (pe && pe.elevation && ev !== null) eaveByElevV[pe.elevation] = ev; });
  const istUeberTraufeV = (o) => { const sill = o ? num(o.sill_height_mm) : null; if (sill === null || sill === undefined) return false; const ee = (o.elevation && eaveByElevV[o.elevation] !== undefined) ? eaveByElevV[o.elevation] : eave; return ee !== null && ee !== undefined && sill >= ee; };
  const opByElev = {};
  (Array.isArray(r.openings) ? r.openings : []).forEach(o => { if (o && o.elevation && o.elevation !== 'roof' && !istUeberTraufeV(o)) { const a = num(o.area_mm2); if (typeof a === 'number') opByElev[o.elevation] = (opByElev[o.elevation] || 0) + a; } });
  Object.keys(opByElev).forEach(el => { if (wallByElev[el] && opByElev[el] > wallByElev[el]) q.warnings.push('geometry check openings on ' + el + ': total opening area exceeds wall gross area'); });
})();
const summary = 'country ' + (r.meta ? r.meta.country : '?') + ' | faces ' + (r.faces || []).length + ' | edges ' + (r.edges || []).length + ' | openings ' + (r.openings || []).length + ' | attachments ' + (r.attachments || []).length + ' | downspouts ' + (r.downspouts || []).length + ' | condition ' + (r.condition_areas || []).length + ' | warnings ' + q.warnings.length + (p.repaired ? ' | repaired output' : '');
return [{ json: { valid: v.length === 0, violations: v, summary: summary, usage: p.usage || null, stop_reason: p.stop_reason || null, model: p.model || null, repaired: !!p.repaired, result: r } }];
