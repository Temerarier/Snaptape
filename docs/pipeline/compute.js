
const p = $input.first().json;
const r = p.result || {};
const q = (r.quality && typeof r.quality === 'object') ? r.quality : {};
r.quality = q;
q.warnings = Array.isArray(q.warnings) ? q.warnings : [];
const est = Array.isArray(q.raw_estimates) ? q.raw_estimates.filter(e => e && typeof e.estimate_mm === 'number' && e.estimate_mm > 0) : [];
const angleOf = {};
(((r.meta || {}).photos) || []).forEach(ph => { if (ph && ph.index) angleOf[ph.index] = ph.view_angle; });
const relW = { high: 3, medium: 2, low: 1 };
const capRank = { high: 3, medium: 2, low: 1 };
function wmedian(vals) { const s2 = vals.slice().sort((a, b) => a.v - b.v); const tot = s2.reduce((a, x) => a + x.w, 0); let c = 0; for (const x of s2) { c += x.w; if (c >= tot / 2) return x.v; } return s2.length ? s2[s2.length - 1].v : null; }
const targets = { total_width: ['building', 'footprint', 'width_mm'], total_depth: ['building', 'footprint', 'depth_mm'], eave_height: ['building', 'heights', 'eave_height_mm'], ridge_height: ['building', 'heights', 'ridge_height_mm'] };
let anySpread = null;
for (const tkey of Object.keys(targets)) {
  const path = targets[tkey];
  const es = est.filter(e => e.target === tkey).map(e => { const ro = String(e.reference_object || ''); let w = /^user[_ ]?provided/i.test(ro) ? 5 : (relW[String(e.reliability || '').toLowerCase()] || 1); if ((tkey === 'total_width' || tkey === 'total_depth') && /horizontal/i.test(ro)) w *= 2; if ((tkey === 'total_width' || tkey === 'total_depth') && (/vertical/i.test(ro) || e.via_transfer === true)) w *= 0.5; return { v: e.estimate_mm, w: w, photo: e.photo_index }; });
  if (!es.length) continue;
  const m0 = wmedian(es);
  const kept = es.filter(x => Math.abs(x.v - m0) / m0 <= 0.10);
  const removed = es.length - kept.length;
  if (removed > 0) q.warnings.push(tkey + ': ' + removed + ' outlier estimate(s) more than 10% from median removed in consolidation');
  const use = kept.length ? kept : es;
  const med = wmedian(use);
  const spread = use.length > 1 ? (Math.max(...use.map(x => x.v)) - Math.min(...use.map(x => x.v))) / med * 100 : null;
  let conf = spread === null ? 'low' : (spread < 3 ? 'high' : (spread <= 8 ? 'medium' : 'low'));
  const angles = use.map(x => angleOf[x.photo]).filter(Boolean);
  const angleCap = angles.indexOf('steeply_angled') >= 0 ? 'low' : (angles.indexOf('slightly_angled') >= 0 ? 'medium' : 'high');
  if (capRank[angleCap] < capRank[conf]) conf = angleCap;
  if (removed > 0) conf = 'low'; // A4: outlier removal caps confidence at low (a real conflict between photos must stay visible)
  let node = r;
  for (let i = 0; i < path.length - 1; i++) { const k = path[i]; if (!node[k] || typeof node[k] !== 'object') node[k] = {}; node = node[k]; }
  const key = path[path.length - 1];
  const existing = node[key];
  if (existing && typeof existing === 'object' && existing.source === 'measured' && typeof existing.value === 'number') {
    if (Math.abs(existing.value - med) / existing.value > 0.03) q.warnings.push(tkey + ': photo-derived median ' + Math.round(med) + ' mm differs from plan value ' + Math.round(existing.value) + ' mm; plan value kept');
  } else {
    node[key] = { value: Math.round(med * 10) / 10, confidence: conf, source: 'scaled', reference_used: 'weighted median of ' + use.length + ' reference estimate(s), computed in code', low_reason: conf === 'low' ? (removed > 0 ? 'outlier estimate(s) removed in consolidation' : (spread === null ? 'single estimate' : 'spread ' + spread.toFixed(1) + '%')) : null };
  }
  if (spread !== null) { const sp = Math.round(spread * 10) / 10; if (anySpread === null || sp > anySpread) anySpread = sp; } // B3: keep the WORST spread across targets, not the last
}
if (anySpread !== null) q.spread_percent = anySpread;
const refSet = {};
est.forEach(e => { refSet[String(e.photo_index || '?') + ':' + String(e.reference_object || '?')] = 1; });
const refCount = Object.keys(refSet).length;
if (refCount) q.references_used = refCount;
// A2: rise_over_12_snapped fallback from degrees_original (tan x 12, snapped to 0..12,14,16,18,24)
const PITCH_SNAPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 24];
(Array.isArray(r.faces) ? r.faces : []).forEach(f => {
  if (!f || f.face_class !== 'roof_face' || !f.pitch || typeof f.pitch.degrees_original !== 'number') return;
  if (typeof f.pitch.rise_over_12_snapped === 'number') return;
  const rise = Math.tan(f.pitch.degrees_original * Math.PI / 180) * 12;
  let snap = PITCH_SNAPS[0];
  PITCH_SNAPS.forEach(s => { if (Math.abs(s - rise) < Math.abs(snap - rise)) snap = s; });
  f.pitch.rise_over_12_snapped = snap;
});
(Array.isArray(r.openings) ? r.openings : []).forEach(o => {
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
const wallsByElev = {};
(Array.isArray(r.faces) ? r.faces : []).forEach(f => { if (f && f.face_class === 'wall' && f.elevation) wallsByElev[f.elevation] = (wallsByElev[f.elevation] || 0) + 1; });
// B2: openings whose sill sits at/above the elevation's eave (dormers) must not reduce wall net area
const eaveByElev = {};
const hts = (r.building && r.building.heights) || {};
(Array.isArray(hts.per_elevation) ? hts.per_elevation : []).forEach(pe => { const ev = (pe && pe.eave_height_mm && typeof pe.eave_height_mm.value === 'number') ? pe.eave_height_mm.value : null; if (pe && pe.elevation && ev !== null) eaveByElev[pe.elevation] = ev; });
const eaveGlobal = (hts.eave_height_mm && typeof hts.eave_height_mm.value === 'number') ? hts.eave_height_mm.value : null;
const istUeberTraufe = (o) => { const sill = (o && o.sill_height_mm && typeof o.sill_height_mm.value === 'number') ? o.sill_height_mm.value : null; if (sill === null) return false; const ee = (o.elevation && eaveByElev[o.elevation] !== undefined) ? eaveByElev[o.elevation] : eaveGlobal; return ee !== null && sill >= ee; };
const openAreaByElev = {};
(Array.isArray(r.openings) ? r.openings : []).forEach(o => {
  const a = (o && o.area_mm2 && typeof o.area_mm2.value === 'number') ? o.area_mm2.value : null;
  if (a && o.elevation && o.elevation !== 'roof' && !istUeberTraufe(o)) openAreaByElev[o.elevation] = (openAreaByElev[o.elevation] || 0) + a;
});
(Array.isArray(r.faces) ? r.faces : []).forEach(f => {
  if (!f || f.face_class !== 'wall') return;
  const g = (f.area_mm2 && typeof f.area_mm2.value === 'number') ? f.area_mm2.value : null;
  if (g === null) return;
  if (wallsByElev[f.elevation] > 1) {
    // A7: multi-face elevations with a model-supplied net area are accepted silently; only warn when the net value is missing
    const hatNetz = f.net_area_mm2 && typeof f.net_area_mm2 === 'object' && typeof f.net_area_mm2.value === 'number';
    if (!hatNetz) q.warnings.push('net area not derived for ' + String(f.id) + ': several wall faces share elevation ' + String(f.elevation) + ' and no model net area present');
    return;
  }
  const net = Math.max(0, g - (openAreaByElev[f.elevation] || 0));
  const has = f.net_area_mm2 && typeof f.net_area_mm2 === 'object' && typeof f.net_area_mm2.value === 'number';
  if (!has) {
    f.net_area_mm2 = { value: Math.round(net), confidence: (f.area_mm2.confidence || 'low'), source: 'scaled', reference_used: 'gross minus openings on this elevation, computed in code', low_reason: null };
  } else if (net > 0 && Math.abs(f.net_area_mm2.value - net) / net > 0.03) {
    q.warnings.push(String(f.id) + ': reported net area differs more than 3% from computed gross-minus-openings (' + Math.round(f.net_area_mm2.value / 10000) / 100 + ' vs ' + Math.round(net / 10000) / 100 + ' m2)');
  }
});
const chains = Array.isArray(q.dimension_chains) ? q.dimension_chains : [];
chains.forEach(c => {
  if (c && Array.isArray(c.values_mm) && typeof c.stated_total_mm === 'number' && c.stated_total_mm > 0) {
    const sum = c.values_mm.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    c.computed_sum_mm = Math.round(sum * 10) / 10;
    const dev = Math.abs(sum - c.stated_total_mm) / c.stated_total_mm * 100;
    c.deviation_percent = Math.round(dev * 100) / 100;
    if (dev > 1) q.warnings.push('Dimension chain "' + (c.label || ('page ' + c.page)) + '": sum ' + Math.round(sum) + ' mm vs stated ' + Math.round(c.stated_total_mm) + ' mm (' + dev.toFixed(1) + '% off)');
  }
});
// A5: when the footprint points' bounding box drifts >3% from the consolidated width/depth, rescale the points axis-wise before deriving area/perimeter
(function () {
  const fpA = r.building && r.building.footprint;
  if (!fpA || !Array.isArray(fpA.points) || fpA.points.length < 3) return;
  const gvA = (m) => (m && typeof m === 'object' && typeof m.value === 'number') ? m.value : null;
  const wA = gvA(fpA.width_mm), dA = gvA(fpA.depth_mm);
  if (!wA || !dA) return;
  const xs = fpA.points.map(pt => pt[0]), ys = fpA.points.map(pt => pt[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = maxX - minX, bd = maxY - minY;
  if (bw <= 0 || bd <= 0) return;
  if (Math.abs(bw - wA) / wA <= 0.03 && Math.abs(bd - dA) / dA <= 0.03) return;
  const sx = wA / bw, sy = dA / bd;
  fpA.points = fpA.points.map(pt => [minX + (pt[0] - minX) * sx, minY + (pt[1] - minY) * sy]);
  q.warnings.push('footprint points rescaled in code: bounding box ' + Math.round(bw) + ' x ' + Math.round(bd) + ' mm differs more than 3% from consolidated ' + Math.round(wA) + ' x ' + Math.round(dA) + ' mm');
})();
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
  const gv = (m) => (m && typeof m === 'object' && typeof m.value === 'number') ? m.value : null;
  if (b3.roof_type !== 'gable') return;
  const w3 = gv(fp3.width_mm), d3 = gv(fp3.depth_mm);
  if (!w3 || !d3) return;
  const rf = (Array.isArray(r.faces) ? r.faces : []).filter(f => f && f.face_class === 'roof_face');
  if (rf.length !== 2) return;
  const pl0 = rf.filter(f => f.pitch && typeof f.pitch.degrees_original === 'number').map(f => f.pitch.degrees_original);
  const pl = (pl0.some(x => x >= 15) ? pl0.filter(x => x >= 10) : pl0).sort((a, b) => a - b); // B1: ignore near-flat faces (<10 deg) when other faces are >=15 deg
  if (!pl.length) return;
  const pdeg = pl[Math.floor((pl.length - 1) / 2)];
  if (pdeg <= 3 || pdeg >= 80) return;
  const missing = rf.filter(f => gv(f.area_mm2) === null);
  if (!missing.length) return;
  const cosp = Math.cos(pdeg * Math.PI / 180);
  let ridgeSum = null;
  (Array.isArray(r.edges) ? r.edges : []).forEach(e2 => { if (e2 && e2.edge_class === 'ridge') { const l = gv(e2.length_mm); if (typeof l === 'number') ridgeSum = (ridgeSum || 0) + l; } });
  let L3 = Math.max(w3, d3), S3 = Math.min(w3, d3);
  if (typeof ridgeSum === 'number') { if (Math.abs(ridgeSum - w3) <= Math.abs(ridgeSum - d3)) { L3 = w3; S3 = d3; } else { L3 = d3; S3 = w3; } }
  const half = Math.round((L3 * S3) / (2 * cosp));
  missing.forEach(f => { f.area_mm2 = { value: half, confidence: 'medium', source: 'scaled', reference_used: 'derived: footprint x pitch gable geometry (code)', low_reason: null }; });
  q.warnings.push('gable roof face area derived from footprint and pitch in code for: ' + missing.map(f => f.id).join(', '));
})();

(function () {
  const b4 = r.building || {}; const fp4 = b4.footprint || {};
  const gv4 = (m) => (m && typeof m === 'object' && typeof m.value === 'number') ? m.value : null;
  const w4 = gv4(fp4.width_mm), d4 = gv4(fp4.depth_mm);
  if (!w4 || !d4) return;
  const ridges = (Array.isArray(r.edges) ? r.edges : []).filter(e => e && e.edge_class === 'ridge' && gv4(e.length_mm));
  if (!ridges.length) return;
  const ridgeSum = ridges.reduce((a, e) => a + gv4(e.length_mm), 0);
  const rt = String(b4.roof_type || '');
  const maxWT = Math.max(w4, d4), diffWT = Math.abs(w4 - d4);
  if (ridges.length > 1) {
    // A3: more than one ridge edge (cross-wing): NEVER rescale the sum; clamp each edge individually to footprint max x 1.05
    ridges.forEach(e => {
      const len = gv4(e.length_mm);
      if (len > maxWT * 1.05) {
        e.length_mm.value = Math.round(maxWT * 1.05); e.length_mm.source = 'scaled'; e.length_mm.reference_used = 'clamped in code: single ridge edge cannot exceed footprint max dimension x 1.05';
        q.warnings.push('ridge edge ' + String(e.id) + ': length ' + Math.round(len) + ' mm exceeds footprint max ' + Math.round(maxWT) + ' mm x 1.05; clamped in code');
      }
    });
  } else if (rt === 'gable') {
    const exp0 = Math.abs(ridgeSum - w4) <= Math.abs(ridgeSum - d4) ? w4 : d4;
    if (Math.abs(ridgeSum - exp0) / exp0 > 0.15) {
      const sc = exp0 / ridgeSum;
      ridges.forEach(e => { e.length_mm.value = Math.round(gv4(e.length_mm) * sc); e.length_mm.source = 'scaled'; e.length_mm.reference_used = 'rescaled in code: gable ridge = footprint dimension along ridge axis'; });
      q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm inconsistent with gable footprint axis ' + Math.round(exp0) + ' mm; rescaled in code');
    }
  } else if (ridgeSum > maxWT * 1.05) {
    const sc = maxWT / ridgeSum;
    ridges.forEach(e => { e.length_mm.value = Math.round(gv4(e.length_mm) * sc); e.length_mm.source = 'scaled'; e.length_mm.reference_used = 'clamped in code: ridge cannot exceed footprint max dimension'; });
    q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm exceeds footprint max ' + Math.round(maxWT) + ' mm; clamped in code');
  } else if (['hip', 'mansard', 'half_hip', 'halfhip', 'jerkinhead'].indexOf(rt) >= 0 && diffWT > 500 && ridgeSum < diffWT * 0.4) {
    q.warnings.push('ridge length ' + Math.round(ridgeSum) + ' mm implausibly short for ' + rt + ' roof on ' + Math.round(w4) + ' x ' + Math.round(d4) + ' footprint (equal-pitch expectation near ' + Math.round(diffWT) + ' mm); verify roof interpretation');
  }
})();
p.result = r;
p.computed = true;
return [{ json: p }];
