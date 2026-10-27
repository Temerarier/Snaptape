// SnapTape Variante A, Schritt 2 - buildHouse fuer Triplex 40014DB (3 Reihenhaus-Einheiten, US)
// Messung: snaptape-v2-chattest-triplex-40014db-c3-ergebnis.json (Schema 1.8, Prompt v1.8.2)
// Stand: 2026-10-12, im Chat erzeugt, noch nicht im Viewer geprueft.
function buildHouse(MESS, api) {
  const R = d => d * Math.PI / 180, DEG = r => r * 180 / Math.PI, TOL = 0.03;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const Z = (P, x, y) => P.a * x + P.b * y + P.c;
  const uniq = f => f.filter((p, i) => dist(p, f[(i + f.length - 1) % f.length]) > 1e-6);
  const num = id => parseInt(String(id).split("-")[1], 10);
  const sortIds = o => Object.keys(o || {}).sort((a, b) => num(a) - num(b));
  const box = (x0, x1, y0, y1, z0, z1) => [
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]],
    [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], [[x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [x0, y1, z0]],
    [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]];
  const done = new Set();
  const call = (fn, id, ...a) => { try { api[fn](id, ...a); done.add(id); } catch (e) { api.konflikt(id, "Aufruf fehlgeschlagen: " + e.message); } };
  const C = [];
  const cand = (cls, el, pa, p, q) => C.push({ cls, el, pa: pa || null, p, q, L: dist(p, q), used: false });
  const pick = (ids, src, el) => { const id = (ids || []).find(i => src[i] && src[i].elevation === el); return id ? Object.assign({ id }, src[id]) : null; };

  try {
    const B = MESS.massing.bodies, mb = B.find(b => b.role === "main");
    const wF = pick(mb.wall_ids, MESS.walls, "front"), wL = pick(mb.wall_ids, MESS.walls, "left");
    const wR = pick(mb.wall_ids, MESS.walls, "right"), wB = pick(mb.wall_ids, MESS.walls, "back");
    const rF = pick(mb.roof_face_ids, MESS.roofs, "front"), rB = pick(mb.roof_face_ids, MESS.roofs, "back");
    const rL = pick(mb.roof_face_ids, MESS.roofs, "left"), rR = pick(mb.roof_face_ids, MESS.roofs, "right");
    const W = wF.width_mm, D = wL.width_mm, H = wF.height_mm;
    const tk = Object.keys(MESS.trim || {});
    const sfId = tk.find(k => MESS.trim[k].face_class === "soffit"), fcId = tk.find(k => MESS.trim[k].face_class === "fascia");
    const o = (sfId && MESS.trim[sfId].soffit_depth_mm) || api.ergaenzt("dachueberstand_mm", 305, "Dachüberstand fehlt in MESS", "Foto 3");
    const t = Math.tan(R(rF.pitch_deg)), zE = H - o * t, zr = H + D / 2 * t;
    const rh = MESS.building.ridge_height_mm;
    if (rh && Math.abs(zr - rh) > TOL * rh) api.konflikt("MB-1", `Firsthöhe aus Dachneigung ${Math.round(zr)} mm, MESS ${rh} mm; Neigung beibehalten.`);

    // Zwerchgiebel (Gauben-Körper), links nach rechts
    const G = B.filter(b => b.role === "dormer").map(b => {
      const wid = b.wall_ids[0], wl = MESS.walls[wid], w = wl.width_mm, gh = wl.gable_height_mm, xs = wl.start_mm;
      return { at: b.attachment_id, wid, xs, w, gh, tg: gh / (w / 2), xc: xs + w / 2, zg: H + gh,
        rl: pick(b.roof_face_ids, MESS.roofs, "left"), rr: pick(b.roof_face_ids, MESS.roofs, "right") };
    }).sort((a, b) => a.xs - b.xs);
    const g1 = G[0], gn = G[G.length - 1];
    const tl = g1.tg, tr = (zr - H) / (W - gn.xc);           // Walmenden so, dass äußere Giebelfirste am Hauptfirst enden
    const oL = o * t / tl, oR = o * t / tr;                    // gleiche Traufhöhe rundum
    const A = [-oL, -o, zE], M = [-oL, D / 2, zE], OBL = [-oL, D + o, zE], OBR = [W + oR, D + o, zE], OFR = [W + oR, -o, zE];
    const R1 = [(zr - H) / tl, D / 2, zr], R2 = [gn.xc, D / 2, zr];
    G.forEach((g, i) => {
      g.T = [g.xc, -o, g.zg];
      g.Pl = i === 0 ? A : [g.xs - o * t / g.tg, -o, zE];
      g.Pr = [g.xs + g.w + o * t / g.tg, -o, zE];
      const ye = Math.min((g.zg - H) / t, D / 2);
      g.Q = i === 0 ? R1 : i === G.length - 1 ? R2 : [g.xc, ye, Math.min(g.zg, zr)];
      g.top = i === 0 ? R1 : i === G.length - 1 ? R2 : [g.xc, D / 2, zr];
    });
    api.konflikt("MB-1", `Walm mit ${rF.pitch_deg}° an allen Seiten passt nicht zu den äußeren Zwerchgiebeln: ${g1.at} Mitte ${Math.round(g1.xc)} mm vom linken, ${gn.at} ${Math.round(W - gn.xc)} mm vom rechten Ende, halbe Tiefe ${Math.round(D / 2)} mm – ihre Firste (${Math.round(g1.zg)} mm) würden über dem Walm enden. Gebaut: steilere Walmenden, beide Giebelfirste enden am Hauptfirst; links liegt die Walmfläche in einer Ebene mit der linken Giebelfläche (Foto 3: Giebel an der Hausecke).`);
    api.konflikt(rL.id, `Neigung MESS ${rL.pitch_deg}°, gebaut ${DEG(Math.atan(tl)).toFixed(1)}° (siehe MB-1).`);
    api.konflikt(rR.id, `Neigung MESS ${rR.pitch_deg}°, gebaut ${DEG(Math.atan(tr)).toFixed(1)}° (siehe MB-1).`);
    if (sfId) api.konflikt(sfId, `Überstand ${o} mm vorn/hinten; an den steileren Walmenden bei gleicher Traufhöhe nur ${Math.round(oL)} mm (links) und ${Math.round(oR)} mm (rechts).`);

    // Wände
    call("wall", wF.id, [[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]]);
    call("wall", wL.id, [[0, D, 0], [0, 0, 0], [0, 0, H], [0, D, H]]);
    call("wall", wR.id, [[W, 0, 0], [W, D, 0], [W, D, H], [W, 0, H]]);
    call("wall", wB.id, [[W, D, 0], [0, D, 0], [0, D, H], [W, D, H]]);
    G.forEach(g => { call("wall", g.wid, [[g.xs, 0, H], [g.xs + g.w, 0, H], [g.xc, 0, g.zg]]); api.nichtGebaut(g.at, `gebaut als ${g.wid}, ${g.rl.id}, ${g.rr.id}`); done.add(g.at); });

    // Hauptdach + Zwerchgiebel
    for (let i = 0; i + 1 < G.length; i++) { const a = G[i], b = G[i + 1]; call("roof", rF.id, uniq([a.Pr, b.Pl, b.Q, b.top, a.top, a.Q])); }
    call("roof", rF.id, [gn.Pr, OFR, R2]);
    call("roof", rB.id, [OBR, OBL, R1, R2]);
    call("roof", rL.id, [M, R1, OBL]);
    call("roof", rR.id, [OFR, OBR, R2]);
    G.forEach((g, i) => {
      call("roof", g.rl.id, i === 0 ? [A, g.T, R1, M] : [g.Pl, g.T, g.Q]);
      call("roof", g.rr.id, [g.T, g.Pr, g.Q]);
      cand("ridge", "roof", g.at, g.T, g.Q);
      if (i > 0) cand("valley", "roof", g.at, g.Pl, g.Q);
      cand("valley", "roof", g.at, g.Pr, g.Q);
      cand("rake", "front", g.at, g.Pl, g.T); cand("rake", "front", g.at, g.T, g.Pr);
    });
    cand("ridge", "roof", null, R1, R2);
    cand("hip", "left", null, OBL, R1); cand("hip", "right", null, OFR, R2); cand("hip", "right", null, OBR, R2);
    cand("eave", "left", null, A, OBL);
    const fr = [];
    for (let i = 0; i + 1 < G.length; i++) fr.push([G[i].Pr, G[i + 1].Pl]);
    fr.push([gn.Pr, OFR]);
    fr.forEach(([p, q]) => cand("eave", "front", null, p, q));
    cand("eave", "right", null, OFR, OBR); cand("eave", "back", null, OBR, OBL);
    [[0, 0, "front"], [W, 0, "front"], [0, D, "back"], [W, D, "back"]].forEach(([x, y, el]) => cand("outside_corner", el, null, [x, y, 0], [x, y, H]));

    // Untersicht und Stirnbrett (nur an Traufen, nicht unter Ortgängen)
    if (sfId) {
      fr.forEach(([p, q]) => call("trim", sfId, [[p[0], -o, zE], [q[0], -o, zE], [q[0], 0, zE], [p[0], 0, zE]]));
      call("trim", sfId, [[-oL, 0, zE], [0, 0, zE], [0, D, zE], [-oL, D, zE]]);
      call("trim", sfId, [[W, 0, zE], [W + oR, 0, zE], [W + oR, D, zE], [W, D, zE]]);
      call("trim", sfId, [[-oL, D, zE], [W + oR, D, zE], [W + oR, D + o, zE], [-oL, D + o, zE]]);
    }
    if (fcId) {
      const fh = MESS.trim[fcId].area_mm2 / (2 * ((W + oL + oR) + (D + 2 * o))), zb = zE - fh;
      fr.forEach(([p, q]) => call("trim", fcId, [[p[0], -o, zb], [q[0], -o, zb], [q[0], -o, zE], [p[0], -o, zE]]));
      call("trim", fcId, [[-oL, D + o, zb], [-oL, -o, zb], [-oL, -o, zE], [-oL, D + o, zE]]);
      call("trim", fcId, [[W + oR, -o, zb], [W + oR, D + o, zb], [W + oR, D + o, zE], [W + oR, -o, zE]]);
      call("trim", fcId, [[W + oR, D + o, zb], [-oL, D + o, zb], [-oL, D + o, zE], [W + oR, D + o, zE]]);
    }

    // Öffnungen (Ursprung je Ansicht: vorn kleinstes x, hinten größtes x, links größtes y, rechts kleinstes y)
    const posW = (el, s, z) => el === "front" ? [s, 0, z] : el === "back" ? [W - s, D, z] : el === "left" ? [0, D - s, z] : [W, s, z];
    sortIds(MESS.openings).forEach(id => {
      const op = MESS.openings[id];
      if (!op || op.elevation === "roof" || !(op.width_mm > 0)) return;
      const x = op.x_mm, y = op.y_mm != null ? op.y_mm : op.sill_mm, w = op.width_mm, h = op.height_mm, hd = op.head;
      let f2 = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      if (hd && hd.shape && hd.shape !== "flat" && hd.rise_mm > 0 && hd.rise_mm < h) {
        const r = hd.rise_mm, rad = (w * w / 4 + r * r) / (2 * r), cz = y + h - rad, a0 = Math.asin(Math.min(1, (w / 2) / rad));
        f2 = [[x, y], [x + w, y]];
        for (let k = 0; k <= 12; k++) { const a = a0 - 2 * a0 * k / 12; f2.push([x + w / 2 + rad * Math.sin(a), cz + rad * Math.cos(a)]); }
      }
      call("opening", id, f2.map(([s, z]) => posW(op.elevation, s, z)));
    });

    // Veranda (AT mit eigenen Dachflächen) + Treppen
    const roofsP = sortIds(MESS.roofs).filter(id => MESS.roofs[id].parent_attachment_id);
    if (roofsP.length) {
      const pid = MESS.roofs[roofsP[0]].parent_attachment_id, P = MESS.attachments[pid];
      const shedId = roofsP.find(id => MESS.roofs[id].elevation === "front"), gIds = roofsP.filter(id => id !== shedId);
      const nG = Math.floor(gIds.length / 2);
      const stairs = sortIds(MESS.attachments).filter(id => id !== pid && MESS.attachments[id].type === "other");
      const Pd = P.depth_mm, zPp = P.height_mm, yf = -Pd - o;
      const ts = Math.tan(R(MESS.roofs[shedId].pitch_deg)), tp = Math.tan(R(MESS.roofs[gIds[0]].pitch_deg));
      const gw = api.ergaenzt("veranda_giebel_breite_mm", 4400, "Breite der Verandagiebel (nur als Text in massing.missing)", "Rendering Bild 4, massing.missing");
      const goff = api.ergaenzt("veranda_giebel_versatz_mm", 200, "Abstand Verandagiebel vom linken Rand der Einheit", "Rendering Bild 4, massing.missing");
      const zPe = zPp - gw / 2 * tp, PS = { a: 0, b: ts, c: zPe - ts * yf }, zPw = Z(PS, 0, 0);
      const dv = Math.min((zPw - zPe) / tp, gw / 2);
      const PG = [];
      for (let j = 0; j < nG; j++) {
        const gs = (G[j] ? G[j].xs : j * W / nG) + goff, gc = gs + gw / 2;
        const q = { Fl: [gs, yf, zPe], Fr: [gs + gw, yf, zPe], T: [gc, yf, zPp], Wt: [gc, 0, zPp], VL: [gs + dv, 0, zPw], VR: [gs + gw - dv, 0, zPw] };
        PG.push(q);
        call("roof", gIds[2 * j], [q.Fl, q.T, q.Wt, q.VL]);
        call("roof", gIds[2 * j + 1], [q.T, q.Fr, q.VR, q.Wt]);
        cand("ridge", "front", pid, q.T, q.Wt);
        cand("valley", "front", pid, q.Fl, q.VL); cand("valley", "front", pid, q.Fr, q.VR);
        cand("rake", "front", pid, q.Fl, q.T); cand("rake", "front", pid, q.T, q.Fr);
        cand("step_flashing", "front", pid, q.VL, q.Wt); cand("step_flashing", "front", pid, q.VR, q.Wt);
      }
      const L0 = [-o, yf, zPe], R0 = [W + o, yf, zPe], Lw = [-o, 0, zPw], Rw = [W + o, 0, zPw];
      call("roof", shedId, [L0, PG[0].Fl, PG[0].VL, Lw]);
      cand("eave", "front", pid, L0, PG[0].Fl);
      for (let j = 0; j + 1 < nG; j++) { call("roof", shedId, [PG[j].Fr, PG[j + 1].Fl, PG[j + 1].VL, PG[j].VR]); cand("eave", "front", pid, PG[j].Fr, PG[j + 1].Fl); }
      call("roof", shedId, [PG[nG - 1].Fr, R0, Rw, PG[nG - 1].VR]);
      cand("eave", "front", pid, PG[nG - 1].Fr, R0);
      cand("rake", "left", pid, L0, Lw); cand("rake", "right", pid, R0, Rw);
      cand("flashing", "front", pid, [0, 0, zPw], [W, 0, zPw]);

      const deckH = stairs.length ? MESS.attachments[stairs[0]].height_mm : api.ergaenzt("veranda_bodenhoehe_mm", 3113, "Höhe Verandaboden", "Foto 3");
      const dT = api.ergaenzt("veranda_deckstaerke_mm", 250, "Dicke Verandaboden mit Balkenlage", "Foto 3");
      const post = api.ergaenzt("veranda_stuetze_mm", 150, "Querschnitt der Verandastützen", "Foto 3");
      const railH = api.ergaenzt("gelaender_hoehe_mm", 914, "Geländerhöhe 36 in (US-Referenzkatalog)", "Foto 3, Referenzkatalog US");
      const rT = api.ergaenzt("gelaender_staerke_mm", 50, "Dicke der Geländerfüllung", "Foto 3");
      const unitW = G.length > 1 ? G[1].xs - G[0].xs : W, nU = Math.round(W / unitW), zPost = Z(PS, 0, -Pd);
      const faces = [...box(0, W, -Pd, 0, deckH - dT, deckH)];
      for (let k = 0; k <= nU; k++) { const x0 = Math.min(Math.max(k * unitW - post / 2, 0), W - post); faces.push(...box(x0, x0 + post, -Pd, -Pd + post, 0, zPost)); }
      const gaps = stairs.map(id => [MESS.attachments[id].x_mm, MESS.attachments[id].x_mm + MESS.attachments[id].width_mm]).sort((a, b) => a[0] - b[0]);
      let xa = 0;
      gaps.forEach(([a0, a1]) => { if (a0 > xa) faces.push(...box(xa, a0, -Pd, -Pd + rT, deckH, deckH + railH)); xa = Math.max(xa, a1); });
      if (xa < W) faces.push(...box(xa, W, -Pd, -Pd + rT, deckH, deckH + railH));
      faces.push(...box(0, rT, -Pd, 0, deckH, deckH + railH), ...box(W - rT, W, -Pd, 0, deckH, deckH + railH));
      call("part", pid, "veranda", faces, "#A9784A");

      const riser = api.ergaenzt("treppe_steigung_mm", 183, "Steigungshöhe Außentreppe (US 178-190 mm)", "Referenzkatalog US, Foto 3");
      const tT = api.ergaenzt("treppe_stufendicke_mm", 40, "Dicke der Trittstufen", "Foto 3");
      const sH = api.ergaenzt("treppe_wange_mm", 280, "Höhe der Treppenwangen", "Foto 3");
      stairs.forEach(id => {
        const s = MESS.attachments[id], x0 = s.x_mm, x1 = x0 + s.width_mm, h = s.height_mm, dep = s.depth_mm, yb = -Pd - dep;
        const n = Math.max(2, Math.round(h / riser)), f = [];
        for (let i = 1; i < n; i++) { const z = i * h / n, y0 = -Pd - dep * (n - i) / n; f.push(...box(x0, x1, y0, y0 + dep / n, z - tT, z)); }
        [x0, x1].forEach(x => f.push([[x, yb, 0], [x, -Pd, h - sH], [x, -Pd, h], [x, yb, sH]]));
        call("part", id, "treppe", f, "#A9784A");
      });
    }
  } catch (e) { api.konflikt("MB-1", "Aufbau abgebrochen: " + e.message); }

  // Kanten: erst Klasse+Körper+Seite, dann Klasse+Körper; jeweils nächstliegende Länge
  try {
    const best = (e, pool) => pool.reduce((b, c) => !b || Math.abs(c.L - e.length_mm) < Math.abs(b.L - e.length_mm) ? c : b, null);
    const assign = (id, c) => {
      const e = MESS.edges[id]; c.used = true; call("edge", id, c.p, c.q);
      if (e.length_mm > 0 && Math.abs(c.L - e.length_mm) > TOL * e.length_mm)
        api.konflikt(id, `Modellkante ${Math.round(c.L)} mm, MESS ${e.length_mm} mm (${e.edge_class}); Länge folgt aus der gebauten Dachform (siehe MB-1).`);
    };
    const rest = [];
    sortIds(MESS.edges).forEach(id => {
      const e = MESS.edges[id], pa = e.parent_attachment_id || null;
      const c = best(e, C.filter(c => !c.used && c.cls === e.edge_class && c.pa === pa && c.el === e.elevation));
      c ? assign(id, c) : rest.push(id);
    });
    rest.forEach(id => {
      const e = MESS.edges[id], pa = e.parent_attachment_id || null;
      const c = best(e, C.filter(c => !c.used && c.cls === e.edge_class && c.pa === pa));
      if (c) assign(id, c);
      else { api.nichtGebaut(id, `Keine passende Kante „${e.edge_class}“ (${pa || "Hauptdach"}) im Modell – entfällt durch die gebaute Dachform (siehe MB-1).`); done.add(id); }
    });
  } catch (e) { api.konflikt("MB-1", "Kantenzuordnung abgebrochen: " + e.message); }

  ["walls", "roofs", "trim", "openings", "attachments", "edges", "downspouts", "condition_areas"].forEach(k =>
    sortIds(MESS[k]).forEach(id => { if (!done.has(id)) { try { api.nichtGebaut(id, "Nicht im Modell platziert, siehe Konflikte."); } catch (e) { } } }));
}
