// 1:1-Port der getesteten n8n-Nodes docs/pipeline/compute.js und
// validate-assemble.js. Die Logik ist UNVERÄNDERT übernommen – nur die
// Ein-/Ausgabe-Verdrahtung ($input.first().json / return [{json}]) ist
// durch Funktionsparameter/-rückgaben ersetzt. Änderungen an der
// Rechenlogik gehören in die Quelldateien, nicht hierher.
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ComputeInput {
  result: any;
  usage?: unknown;
  stop_reason?: unknown;
  model?: unknown;
  repaired?: boolean;
  computed?: boolean;
}

export interface ValidateAssembleOutput {
  valid: boolean;
  violations: string[];
  summary: string;
  usage: unknown;
  stop_reason: unknown;
  model: unknown;
  repaired: boolean;
  result: any;
}

// ---- docs/pipeline/compute.js (verbatim body) ----
export function berechneKonsolidierung(p: ComputeInput): ComputeInput {
  const r = p.result || {};
  const q = (r.quality && typeof r.quality === 'object') ? r.quality : {};
  r.quality = q;
  q.warnings = Array.isArray(q.warnings) ? q.warnings : [];
  const est = Array.isArray(q.raw_estimates) ? q.raw_estimates.filter((e: any) => e && typeof e.estimate_mm === 'number' && e.estimate_mm > 0) : [];
  const angleOf: any = {};
  (((r.meta || {}).photos) || []).forEach((ph: any) => { if (ph && ph.index) angleOf[ph.index] = ph.view_angle; });
  const relW: any = { high: 3, medium: 2, low: 1 };
  const capRank: any = { high: 3, medium: 2, low: 1 };
  function wmedian(vals: any[]) { const s2 = vals.slice().sort((a, b) => a.v - b.v); const tot = s2.reduce((a, x) => a + x.w, 0); let c = 0; for (const x of s2) { c += x.w; if (c >= tot / 2) return x.v; } return s2.length ? s2[s2.length - 1].v : null; }
  const targets: any = { total_width: ['building', 'footprint', 'width_mm'], total_depth: ['building', 'footprint', 'depth_mm'], eave_height: ['building', 'heights', 'eave_height_mm'], ridge_height: ['building', 'heights', 'ridge_height_mm'] };
  let anySpread: number | null = null;
  for (const tkey of Object.keys(targets)) {
    const path = targets[tkey];
    const es = est.filter((e: any) => e.target === tkey).map((e: any) => { const ro = String(e.reference_object || ''); let w = /^user[_ ]?provided/i.test(ro) ? 5 : (relW[String(e.reliability || '').toLowerCase()] || 1); if ((tkey === 'total_width' || tkey === 'total_depth') && /horizontal/i.test(ro)) w *= 2; if ((tkey === 'total_width' || tkey === 'total_depth') && (/vertical/i.test(ro) || e.via_transfer === true)) w *= 0.5; return { v: e.estimate_mm, w: w, photo: e.photo_index }; });
    if (!es.length) continue;
    const m0 = wmedian(es);
    const kept = es.filter((x: any) => Math.abs(x.v - m0) / m0 <= 0.10);
    const removed = es.length - kept.length;
    if (removed > 0) q.warnings.push(tkey + ': ' + removed + ' outlier estimate(s) more than 10% from median removed in consolidation');
    const use = kept.length ? kept : es;
    const med = wmedian(use);
    const spread = use.length > 1 ? (Math.max(...use.map((x: any) => x.v)) - Math.min(...use.map((x: any) => x.v))) / med * 100 : null;
    let conf = spread === null ? 'low' : (spread < 3 ? 'high' : (spread <= 8 ? 'medium' : 'low'));
    const angles = use.map((x: any) => angleOf[x.photo]).filter(Boolean);
    const angleCap = angles.indexOf('steeply_angled') >= 0 ? 'low' : (angles.indexOf('slightly_angled') >= 0 ? 'medium' : 'high');
    if (capRank[angleCap] < capRank[conf]) conf = angleCap;
    let node = r;
    for (let i = 0; i < path.length - 1; i++) { const k = path[i]; if (!node[k] || typeof node[k] !== 'object') node[k] = {}; node = node[k]; }
    const key = path[path.length - 1];
    const existing = node[key];
    if (existing && typeof existing === 'object' && existing.source === 'measured' && typeof existing.value === 'number') {
      if (Math.abs(existing.value - med) / existing.value > 0.03) q.warnings.push(tkey + ': photo-derived median ' + Math.round(med) + ' mm differs from plan value ' + Math.round(existing.value) + ' mm; plan value kept');
    } else {
      node[key] = { value: Math.round(med * 10) / 10, confidence: conf, source: 'scaled', reference_used: 'weighted median of ' + use.length + ' reference estimate(s), computed in code', low_reason: conf === 'low' ? (spread === null ? 'single estimate' : 'spread ' + spread.toFixed(1) + '%') : null };
    }
    if (spread !== null) anySpread = Math.round(spread * 10) / 10;
  }
  if (anySpread !== null) q.spread_percent = anySpread;
  const refSet: any = {};
  est.forEach((e: any) => { refSet[String(e.photo_index || '?') + ':' + String(e.reference_object || '?')] = 1; });
  const refCount = Object.keys(refSet).length;
  if (refCount) q.references_used = refCount;
  (Array.isArray(r.openings) ? r.openings : []).forEach((o: any) => {
    const w = (o && o.width_mm && typeof o.width_mm.value === 'number') ? o.width_mm.value : null;
    const h = (o && o.height_mm && typeof o.height_mm.value === 'number') ? o.height_mm.value : null;
    if (w && h) {
      const cw = (o.width_mm.confidence || 'low'); const ch = (o.height_mm.confidence || 'low');
      const conf = capRank[cw] < capRank[ch] ? cw : ch;
      if (!o.area_mm2 || typeof o.area_mm2 !== 'object' || typeof o.area_mm2.value !== 'number') o.area_mm2 = { value: Math.round(w * h), confidence: conf, source: 'scaled', reference_used: 'computed w x h in code', low_reason: null };
      else o.area_mm2.value = Math.round(w * h);
      if (!o.perimeter_mm || typeof o.perimeter_mm !== 'object' || typeof o.perimeter_mm.value !== 'number') o.perimeter_mm = { value: Math.round(2 * (w + h)), confidence: conf, source: 'scaled', reference_used: 'computed 2 x (w + h) in code', low_reason: null };
      else o.perimeter_mm.value = Math.round(2 * (w + h));
    }
  });
  const wallsByElev: any = {};
  (Array.isArray(r.faces) ? r.faces : []).forEach((f: any) => { if (f && f.face_class === 'wall' && f.elevation) wallsByElev[f.elevation] = (wallsByElev[f.elevation] || 0) + 1; });
  const openAreaByElev: any = {};
  (Array.isArray(r.openings) ? r.openings : []).forEach((o: any) => {
    const a = (o && o.area_mm2 && typeof o.area_mm2.value === 'number') ? o.area_mm2.value : null;
    if (a && o.elevation && o.elevation !== 'roof') openAreaByElev[o.elevation] = (openAreaByElev[o.elevation] || 0) + a;
  });
  (Array.isArray(r.faces) ? r.faces : []).forEach((f: any) => {
    if (!f || f.face_class !== 'wall') return;
    const g = (f.area_mm2 && typeof f.area_mm2.value === 'number') ? f.area_mm2.value : null;
    if (g === null) return;
    if (wallsByElev[f.elevation] > 1) { q.warnings.push('net area not derived for ' + String(f.id) + ': several wall faces share elevation ' + String(f.elevation)); return; }
    const net = Math.max(0, g - (openAreaByElev[f.elevation] || 0));
    const has = f.net_area_mm2 && typeof f.net_area_mm2 === 'object' && typeof f.net_area_mm2.value === 'number';
    if (!has) {
      f.net_area_mm2 = { value: Math.round(net), confidence: (f.area_mm2.confidence || 'low'), source: 'scaled', reference_used: 'gross minus openings on this elevation, computed in code', low_reason: null };
    } else if (net > 0 && Math.abs(f.net_area_mm2.value - net) / net > 0.03) {
      q.warnings.push(String(f.id) + ': reported net area differs more than 3% from computed gross-minus-openings (' + Math.round(f.net_area_mm2.value / 10000) / 100 + ' vs ' + Math.round(net / 10000) / 100 + ' m2)');
    }
  });
  const chains = Array.isArray(q.dimension_chains) ? q.dimension_chains : [];
  chains.forEach((c: any) => {
    if (c && Array.isArray(c.values_mm) && typeof c.stated_total_mm === 'number' && c.stated_total_mm > 0) {
      const sum = c.values_mm.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
      c.computed_sum_mm = Math.round(sum * 10) / 10;
      const dev = Math.abs(sum - c.stated_total_mm) / c.stated_total_mm * 100;
      c.deviation_percent = Math.round(dev * 100) / 100;
      if (dev > 1) q.warnings.push('Dimension chain "' + (c.label || ('page ' + c.page)) + '": sum ' + Math.round(sum) + ' mm vs stated ' + Math.round(c.stated_total_mm) + ' mm (' + dev.toFixed(1) + '% off)');
    }
  });
  const fp = r.building && r.building.footprint;
  if (fp && Array.isArray(fp.points) && fp.points.length >= 3) {
    let a = 0, per = 0;
    const pts = fp.points;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i]; const p2 = pts[(i + 1) % pts.length];
      a += p1[0] * p2[1] - p2[0] * p1[1];
      per += Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
    }
    a = Math.abs(a) / 2;
    fp.area_mm2 = { value: Math.round(a), confidence: 'medium', source: 'scaled', reference_used: 'shoelace area from footprint points, computed in code', low_reason: null };
    fp.perimeter_mm = { value: Math.round(per), confidence: 'medium', source: 'scaled', reference_used: 'perimeter from footprint points, computed in code', low_reason: null };
  }
  (function () {
    const b3 = r.building || {}; const fp3 = b3.footprint || {};
    const gv = (m: any) => (m && typeof m === 'object' && typeof m.value === 'number') ? m.value : null;
    if (b3.roof_type !== 'gable') return;
    const w3 = gv(fp3.width_mm), d3 = gv(fp3.depth_mm);
    if (!w3 || !d3) return;
    const rf = (Array.isArray(r.faces) ? r.faces : []).filter((f: any) => f && f.face_class === 'roof_face');
    if (rf.length !== 2) return;
    const pl = rf.filter((f: any) => f.pitch && typeof f.pitch.degrees_original === 'number').map((f: any) => f.pitch.degrees_original).sort((a: number, b: number) => a - b);
    if (!pl.length) return;
    const pdeg = pl[Math.floor((pl.length - 1) / 2)];
    if (pdeg <= 3 || pdeg >= 80) return;
    const missing = rf.filter((f: any) => gv(f.area_mm2) === null);
    if (!missing.length) return;
    const cosp = Math.cos(pdeg * Math.PI / 180);
    let ridgeSum: number | null = null;
    (Array.isArray(r.edges) ? r.edges : []).forEach((e2: any) => { if (e2 && e2.edge_class === 'ridge') { const l = gv(e2.length_mm); if (typeof l === 'number') ridgeSum = (ridgeSum || 0) + l; } });
    let L3 = Math.max(w3, d3), S3 = Math.min(w3, d3);
    if (typeof ridgeSum === 'number') { if (Math.abs(ridgeSum - w3) <= Math.abs(ridgeSum - d3)) { L3 = w3; S3 = d3; } else { L3 = d3; S3 = w3; } }
    const half = Math.round((L3 * S3) / (2 * cosp));
    missing.forEach((f: any) => { f.area_mm2 = { value: half, confidence: 'medium', source: 'scaled', reference_used: 'derived: footprint x pitch gable geometry (code)', low_reason: null }; });
    q.warnings.push('gable roof face area derived from footprint and pitch in code for: ' + missing.map((f: any) => f.id).join(', '));
  })();

  (function () {
    const b4 = r.building || {}; const fp4 = b4.footprint || {};
    const gv4 = (m: any) => (m && typeof m === 'object' && typeof m.value === 'number') ? m.value : null;
    const w4 = gv4(fp4.width_mm), d4 = gv4(fp4.depth_mm);
    if (!w4 || !d4) return;
    const ridges = (Array.isArray(r.edges) ? r.edges : []).filter((e: any) => e && e.edge_class === 'ridge' && gv4(e.length_mm));
    if (!ridges.length) return;
    const ridgeSum = ridges.reduce((a: number, e: any) => a + gv4(e.length_mm), 0);
    const rt = String(b4.roof_type || '');
    const maxWT = Math.max(w4, d4), diffWT = Math.abs(w4 - d4);
    if (rt === 'gable') {
      const exp0 = Math.abs(ridgeSum - w4) <= Math.abs(ridgeSum - d4) ? w4 : d4;
      if (Math.abs(ridgeSum - exp0) / exp0 > 0.15) {
        const sc = exp0 / ridgeSum;
        ridges.forEach((e: any) => { e.length_mm.value = Math.round(gv4(e.length_mm) * sc); e.length_mm.source = 'scaled'; e.length_mm.reference_used = 'rescaled in code: gable ridge = footprint dimension along ridge axis'; });
        q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm inconsistent with gable footprint axis ' + Math.round(exp0) + ' mm; rescaled in code');
      }
    } else if (ridgeSum > maxWT * 1.05) {
      const sc = maxWT / ridgeSum;
      ridges.forEach((e: any) => { e.length_mm.value = Math.round(gv4(e.length_mm) * sc); e.length_mm.source = 'scaled'; e.length_mm.reference_used = 'clamped in code: ridge cannot exceed footprint max dimension'; });
      q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm exceeds footprint max ' + Math.round(maxWT) + ' mm; clamped in code');
    } else if (['hip', 'mansard', 'half_hip', 'halfhip', 'jerkinhead'].indexOf(rt) >= 0 && diffWT > 500 && ridgeSum < diffWT * 0.4) {
      q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm implausibly short for ' + rt + ' roof on ' + Math.round(w4) + ' x ' + Math.round(d4) + ' footprint (equal-pitch expectation near ' + Math.round(diffWT) + ' mm); verify roof interpretation');
    }
  })();
  p.result = r;
  p.computed = true;
  return p;
}

// ---- docs/pipeline/validate-assemble.js (verbatim body) ----
export function validiereUndAssembliere(p: ComputeInput): ValidateAssembleOutput {
  const r = p.result || {};
  const v: string[] = [];
  const isMeas = (m: any) => m && typeof m === 'object' && typeof m.value === 'number' && ['high', 'medium', 'low'].indexOf(m.confidence) >= 0 && ['measured', 'scaled', 'estimated'].indexOf(m.source) >= 0;
  if (!r.meta || ['US', 'DE'].indexOf(r.meta.country) < 0) v.push('meta.country missing or not US/DE');
  if (!r.building || !r.building.roof_type) v.push('building.roof_type missing');
  ['references', 'faces', 'edges', 'openings'].forEach(k => { if (!Array.isArray(r[k])) { v.push(k + ' is not an array'); r[k] = []; } });
  // v1.5: optional arrays default to [] instead of failing
  ['attachments', 'downspouts', 'condition_areas'].forEach(k => { if (r[k] === null || r[k] === undefined) r[k] = []; else if (!Array.isArray(r[k])) { v.push(k + ' is not an array'); r[k] = []; } });
  const idRules: [string, RegExp][] = [['faces', /^(RF|WL|SF|FC)-\d+$/], ['edges', /^E-\d+$/], ['openings', /^(W|D|G|SK)-\d+$/], ['attachments', /^AT-\d+$/], ['downspouts', /^DS-\d+$/], ['condition_areas', /^CA-\d+$/]]; // v1.5: new id patterns
  idRules.forEach(pair => { const k = pair[0]; const rx = pair[1]; (r[k] || []).forEach((el: any) => { if (!el || typeof el.id !== 'string' || !rx.test(el.id)) v.push(k + ': bad id ' + (el && el.id)); }); });
  const EDGE_CLASSES = ['ridge', 'hip', 'valley', 'eave', 'rake', 'flashing', 'step_flashing', 'outside_corner', 'inside_corner', 'base', 'head', 'sill', 'jamb', 'unclassified'];
  (r.edges || []).forEach((el: any) => { if (el && el.edge_class && EDGE_CLASSES.indexOf(el.edge_class) < 0) v.push(String(el.id) + ': unknown edge_class ' + String(el.edge_class)); });
  const rtv = r.building ? r.building.roof_type : null;
  const roofFacesN = (r.faces || []).filter((f: any) => f && f.face_class === 'roof_face').length;
  const wallFacesN = (r.faces || []).filter((f: any) => f && f.face_class === 'wall').length;
  if (rtv && ['flat', 'unknown'].indexOf(rtv) < 0 && roofFacesN === 0) v.push('roof_type ' + rtv + ' but no roof faces reported');
  if (wallFacesN === 0) v.push('no wall faces reported');
  if ((r.edges || []).length === 0) v.push('no edges reported');
  const num = (m: any) => (m && typeof m === 'object') ? m.value : (typeof m === 'number' ? m : null);
  const eave = r.building && r.building.heights ? num(r.building.heights.eave_height_mm) : null;
  const ridge = r.building && r.building.heights ? num(r.building.heights.ridge_height_mm) : null;
  if (eave !== null && (eave < 2000 || eave > 12000)) v.push('eave height ' + Math.round(eave) + ' mm outside 2000-12000');
  if (ridge !== null && eave !== null && ridge < eave) v.push('ridge height below eave height');
  (r.openings || []).forEach((o: any) => {
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
    const pList = facesV.filter((f: any) => f && f.face_class === 'roof_face' && f.pitch && typeof f.pitch.degrees_original === 'number').map((f: any) => f.pitch.degrees_original).sort((a: number, b: number) => a - b);
    const pdeg = pList.length ? pList[Math.floor((pList.length - 1) / 2)] : null;
    const pMin = pList.length ? pList[0] : null, pMax = pList.length ? pList[pList.length - 1] : null;
    const unequalPitch = pMin !== null && pMax !== null && (pMax - pMin) > 8;
    const rt2 = r.building ? r.building.roof_type : null;
    const sumE = (cls: string) => { let s = 0, any = false; edgesV.forEach((e: any) => { if (e && e.edge_class === cls) { const l = num(e.length_mm); if (typeof l === 'number') { s += l; any = true; } } }); return any ? s : null; };
    const gcheck = (name: string, model: number | null, geo: number | null, tol: number) => { if (model === null || geo === null || geo <= 0) return; const dv2 = Math.abs(model - geo) / geo; if (dv2 > tol) q.warnings.push('geometry check ' + name + ': model ' + Math.round(model) + ' vs derived ' + Math.round(geo) + ' (' + Math.round(dv2 * 100) + '% off)'); };
    if (wV && dV && pdeg !== null && pdeg > 3 && pdeg < 80 && (rt2 === 'gable' || rt2 === 'hip')) {
      const rad = pdeg * Math.PI / 180, cosp = Math.cos(rad), tanp = Math.tan(rad);
      const mRidge = sumE('ridge');
      if (unequalPitch) q.warnings.push('geometry checks adapted: unequal facet pitches (' + Math.round(pMin!) + '-' + Math.round(pMax!) + ' deg), single-pitch formulas skipped');
      let L2 = Math.max(wV, dV), S2 = Math.min(wV, dV);
      if (rt2 === 'gable' && mRidge !== null) { if (Math.abs(mRidge - wV) <= Math.abs(mRidge - dV)) { L2 = wV; S2 = dV; } else { L2 = dV; S2 = wV; } }
      const slope = (S2 / 2) / cosp;
      if (rt2 === 'gable') {
        gcheck('ridge length', mRidge, L2, 0.12);
        gcheck('eave total', sumE('eave'), 2 * L2, 0.12);
        if (!unequalPitch) gcheck('rake total', sumE('rake'), 4 * slope, 0.12);
      } else {
        const ridgeGeo = unequalPitch ? Math.max(L2 - S2 * Math.tan(pMin! * Math.PI / 180) / Math.tan(pMax! * Math.PI / 180), 0) : Math.max(L2 - S2, 0);
        gcheck('ridge length', mRidge, ridgeGeo, unequalPitch ? 0.25 : 0.15);
        gcheck('eave total', sumE('eave'), 2 * (L2 + S2), 0.12);
        if (!unequalPitch) gcheck('hip total', sumE('hip'), 4 * (S2 / 2) * Math.sqrt(tanp * tanp + 2), 0.15);
      }
      let rSum = 0, rAny = false;
      facesV.forEach((f: any) => { if (f && f.face_class === 'roof_face') { const a = num(f.area_mm2); if (typeof a === 'number') { rSum += a; rAny = true; } } });
      if (!unequalPitch) gcheck('roof area', rAny ? rSum : null, (L2 * S2) / cosp, 0.12);
      if (!unequalPitch && eave !== null && ridge !== null) gcheck('rise (ridge height minus eave height)', ridge - eave, (S2 / 2) * tanp, 0.15);
    }
    const wallByElev: any = {};
    facesV.forEach((f: any) => { if (f && f.face_class === 'wall' && f.elevation) { const a = num(f.area_mm2); if (typeof a === 'number') wallByElev[f.elevation] = (wallByElev[f.elevation] || 0) + a; } });
    const opByElev: any = {};
    (Array.isArray(r.openings) ? r.openings : []).forEach((o: any) => { if (o && o.elevation && o.elevation !== 'roof') { const a = num(o.area_mm2); if (typeof a === 'number') opByElev[o.elevation] = (opByElev[o.elevation] || 0) + a; } });
    Object.keys(opByElev).forEach(el => { if (wallByElev[el] && opByElev[el] > wallByElev[el]) q.warnings.push('geometry check openings on ' + el + ': total opening area exceeds wall gross area'); });
  })();
  const summary = 'country ' + (r.meta ? r.meta.country : '?') + ' | faces ' + (r.faces || []).length + ' | edges ' + (r.edges || []).length + ' | openings ' + (r.openings || []).length + ' | attachments ' + (r.attachments || []).length + ' | downspouts ' + (r.downspouts || []).length + ' | condition ' + (r.condition_areas || []).length + ' | warnings ' + q.warnings.length + (p.repaired ? ' | repaired output' : '');
  return { valid: v.length === 0, violations: v, summary: summary, usage: p.usage || null, stop_reason: p.stop_reason || null, model: p.model || null, repaired: !!p.repaired, result: r };
}
