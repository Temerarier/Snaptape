// SnapTape Variante A, Schritt 2 - buildHouse für Leipzig-Villa (Lausicker Str. 26), Chat-Test 2026-10-12
// Grundlage: snaptape-v1-8-2-chattest-leipzig-villa-ergebnis.json (blinde Messung aus Schritt 1)
function buildHouse(MESS, api) {
  const PI = Math.PI, TOL = 0.03, TOL1 = 0.01, EPS = 1e-6, N = 12;
  const num = v => v == null ? null : typeof v === "number" ? v : (typeof v === "object" && typeof v.value === "number") ? v.value : null;
  const rad = d => d * PI / 180, tn = d => Math.tan(rad(d)), cs = d => Math.cos(rad(d));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const pick = (o, k) => (o && o[k]) || {};
  const W = id => pick(MESS.walls, id), R = id => pick(MESS.roofs, id), T = id => pick(MESS.trim, id), AT = id => pick(MESS.attachments, id);
  const body = id => (((MESS.massing || {}).bodies) || []).find(b => b && b.id === id) || {};
  const done = new Set();
  const need = (v, name, def, grund) => { const n = num(v); return n != null ? n : api.ergaenzt(name, def, grund, "Annahme, Wert fehlt in MESS"); };
  const clean = c => { const r = []; for (const p of c) if (!r.length || dist(r[r.length - 1], p) > EPS) r.push(p);
    if (r.length > 1 && dist(r[0], r[r.length - 1]) < EPS) r.pop(); return r; };
  const face = (fn, id, c) => { const q = clean(c); if (q.length >= 3) { fn(id, q); done.add(id); } };
  const wall = (id, c) => face((i, q) => api.wall(i, q), id, c);
  const roof = (id, c) => face((i, q) => api.roof(i, q), id, c);
  const trim = (id, c) => face((i, q) => api.trim(i, q), id, c);
  const skip = (id, grund) => { api.nichtGebaut(id, grund); done.add(id); };
  const run = (id, f) => { try { f(); } catch (e) { api.konflikt(id, "Bauteil konnte nicht gebaut werden: " + (e && e.message)); } };
  const edge = (id, a, b) => {
    if (!MESS.edges || !MESS.edges[id]) return;
    const m = num(MESS.edges[id].length_mm), L = dist(a, b);
    if (m && Math.abs(L - m) / m > TOL) api.konflikt(id, `Modellkante ${Math.round(L)} mm, gemessen ${Math.round(m)} mm - Länge folgt aus den gemessenen Flächen`);
    api.edge(id, a, b); done.add(id);
  };
  const box = (xa, xb, ya, yb, za, zb) => {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), y0 = Math.min(ya, yb), y1 = Math.max(ya, yb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    const p = (x, y, z) => [x, y, z];
    return [[p(x0,y0,z0),p(x1,y0,z0),p(x1,y1,z0),p(x0,y1,z0)], [p(x0,y0,z1),p(x0,y1,z1),p(x1,y1,z1),p(x1,y0,z1)],
      [p(x0,y0,z0),p(x0,y0,z1),p(x1,y0,z1),p(x1,y0,z0)], [p(x1,y0,z0),p(x1,y0,z1),p(x1,y1,z1),p(x1,y1,z0)],
      [p(x1,y1,z0),p(x1,y1,z1),p(x0,y1,z1),p(x0,y1,z0)], [p(x0,y1,z0),p(x0,y1,z1),p(x0,y0,z1),p(x0,y0,z0)]];
  };

  try {
    // ---------- Hauptkörper MB-1: Maße, Gelände, Walmdach ----------
    const B = MESS.building || {}, PE = B.per_elevation || {};
    const offF = num(pick(PE, "front").grade_offset_mm) ?? 0, offB = num(pick(PE, "back").grade_offset_mm) ?? offF;
    const Wd = need(W("WL-1").width_mm, "breite_hauptkoerper_mm", 14300, "Breite Hauptkörper fehlt");
    const Dd = need((B.footprint || {}).depth_mm ?? W("WL-3").width_mm, "tiefe_hauptkoerper_mm", 10650, "Tiefe Hauptkörper fehlt");
    const ze = need(B.eave_height_mm, "traufhoehe_mm", 8140, "Traufhöhe fehlt") + offF;
    const bil = (G, x0, x1, y0, y1) => (x, y) => {
      const u = (x - x0) / ((x1 - x0) || 1), v = (y - y0) / ((y1 - y0) || 1);
      return (num(G.fl) ?? 0) * (1 - u) * (1 - v) + (num(G.fr) ?? 0) * u * (1 - v) + (num(G.br) ?? 0) * u * v + (num(G.bl) ?? 0) * (1 - u) * v;
    };
    const g = bil(body("MB-1").grade_mm || { fl: offF, fr: offF, br: offB, bl: offB }, 0, Wd, 0, Dd);

    const pf = need(R("RF-1").pitch_deg, "neigung_vorn_grad", 45, "Dachneigung vorn fehlt");
    const pb = num(R("RF-2").pitch_deg) ?? pf, pl = num(R("RF-3").pitch_deg) ?? pf, pr = num(R("RF-4").pitch_deg) ?? pl;
    const tf = tn(pf), tb = tn(pb), tl = tn(pl), tr = tn(pr);
    const o = need(T("SF-1").soffit_depth_mm, "dachueberstand_mm", 650, "Dachüberstand fehlt");
    const yr = Dd * tb / (tf + tb), zr = ze + yr * tf;
    let xrL = (zr - ze) / tl, xrR = Wd - (zr - ze) / tr;
    if (xrL > xrR) { api.konflikt("E-1", "Walme treffen sich vor dem First - Zeltdachspitze gebaut"); xrL = xrR = (xrL + xrR) / 2; }
    const ob = o * tf / tb, osl = o * tf / tl, osr = o * tf / tr, zE = ze - o * tf;
    if (Math.abs(osl - o) > o * TOL || Math.abs(osr - o) > o * TOL)
      api.konflikt("SF-1", `Überstand ${o} mm ist rundum gemessen; bei Seitenwalmen ${pl}°/${pr}° statt ${pf}° liegen alle Traufen nur mit seitlich ${Math.round(osl)}/${Math.round(osr)} mm auf gleicher Höhe - so gebaut`);
    const zrM = num(B.ridge_height_mm);
    if (zrM != null && Math.abs(zr - zrM - offF) > zrM * TOL1)
      api.konflikt("RF-1", `First aus gemessenen Neigungen und Tiefe ${Math.round(zr)} mm, gemessene Firsthöhe ${Math.round(zrM)} mm (inkl. Deckung) - Neigungen behalten`);
    const zFront = y => ze + y * tf, zBack = y => ze + (Dd - y) * tb, zLeft = x => ze + x * tl, zRight = x => ze + (Wd - x) * tr;
    const surf = (x, y) => Math.min(zFront(y), zBack(y), zLeft(x), zRight(x));
    const cFL = [-osl, -o, zE], cFR = [Wd + osr, -o, zE], cBR = [Wd + osr, Dd + ob, zE], cBL = [-osl, Dd + ob, zE];
    const RL = [xrL, yr, zr], RR = [xrR, yr, zr];

    // ---------- Anbau AT-1 (rechts) ----------
    const a1 = AT("AT-1"), b2 = body("MB-2");
    const ad = need(W("WL-2").width_mm ?? a1.depth_mm, "anbau_breite_mm", 3000, "Breite Anbau fehlt");
    const al = need(W("WL-4").width_mm ?? a1.width_mm, "anbau_laenge_mm", 6000, "Länge Anbau fehlt");
    const ay0 = need(a1.x_mm, "anbau_versatz_mm", 2000, "Lage Anbau fehlt"), ay1 = ay0 + al, ax0 = Wd, ax1 = Wd + ad;
    const gA = bil(b2.grade_mm || { fl: g(ax0, ay0), fr: g(ax0, ay0), br: g(ax0, ay1), bl: g(ax0, ay1) }, ax0, ax1, ay0, ay1);
    const p9 = num(R("RF-9").pitch_deg) ?? 0;
    const aZ0 = gA(ax0, ay0) + need(W("WL-2").height_mm, "anbau_hoehe_mm", 2600, "Höhe Anbau fehlt");
    const aZ = y => aZ0 - (y - ay0) * tn(p9); // flaches Dach, Gefälle nach hinten (Foto 2)
    const ovRaw = (b2.roof || {}).overhang_mm;
    const ovA = s => typeof ovRaw === "number" ? ovRaw : (ovRaw && num(ovRaw[s])) || 0;

    // ---------- Wintergarten/Erker AT-2 (hinten) mit Balkon AT-3 ----------
    const a2 = AT("AT-2"), b3 = body("MB-3"), a3 = AT("AT-3");
    const bw = need(W("WL-7").width_mm ?? a2.width_mm, "erker_breite_mm", 7860, "Breite Erker fehlt");
    const bd = need(W("WL-9").width_mm ?? a2.depth_mm, "erker_tiefe_mm", 3000, "Tiefe Erker fehlt");
    const bh = need(W("WL-7").height_mm ?? a2.height_mm, "erker_hoehe_mm", 6900, "Höhe Erker fehlt");
    const oriBack0 = Math.max(Wd, ax1);
    const bx1 = oriBack0 - need(a2.x_mm, "erker_lage_mm", 8650, "Lage Erker fehlt"), bx0 = bx1 - bw, by0 = Dd, by1 = Dd + bd;
    const GB = b3.grade_mm || { fl: offB, fr: offB, br: offB, bl: offB };
    const gBv = ["fl", "fr", "br", "bl"].map(k => num(GB[k]) ?? offB), gBm = gBv.reduce((s, v) => s + v, 0) / gBv.length;
    const zBt = gBm + bh, zDeck = gBm + need(a3.y_mm, "balkon_hoehe_mm", 5890, "Höhe Balkonboden fehlt");

    const gradeAt = (x, y) => (x >= ax0 && x <= ax1 && y >= ay0 && y <= ay1) ? gA(x, y)
      : (y >= by0 && x >= bx0 && x <= bx1) ? gBm : g(x, y);

    // ---------- Wandsysteme (p0 = linke untere Ecke von außen gesehen) ----------
    const fr = {};
    const F = (id, p0, d, L, zb, zt, extra) => { fr[id] = Object.assign({ p0, d, L, zb, zt, el: W(id).elevation }, extra || {}); };
    const P = (f, s, z) => [f.p0[0] + f.d[0] * s, f.p0[1] + f.d[1] * s, z];
    const cz = v => () => v;
    F("WL-1", [0, 0], [1, 0], Wd, s => g(s, 0), cz(ze));
    F("WL-3", [Wd, 0], [0, 1], Dd, s => (s > ay0 && s < ay1) ? aZ(s) : g(Wd, s), cz(ze));
    F("WL-6", [Wd, Dd], [-1, 0], Wd, s => { const x = Wd - s; return (x > bx0 && x < bx1) ? zDeck : g(x, Dd); }, cz(ze));
    F("WL-10", [0, Dd], [0, -1], Dd, s => g(0, Dd - s), cz(ze));
    F("WL-2", [ax0, ay0], [1, 0], ad, s => gA(ax0 + s, ay0), cz(aZ(ay0)));
    F("WL-4", [ax1, ay0], [0, 1], al, s => gA(ax1, ay0 + s), s => aZ(ay0 + s));
    F("WL-5", [ax1, ay1], [-1, 0], ad, s => gA(ax1 - s, ay1), cz(aZ(ay1)));
    F("WL-7", [bx1, by1], [-1, 0], bw, cz(gBm), cz(zBt));
    F("WL-8", [bx1, by0], [0, 1], bd, cz(gBm), cz(zBt));
    F("WL-9", [bx0, by1], [0, -1], bd, cz(gBm), cz(zBt));

    const ori = { front: Infinity, back: -Infinity, left: -Infinity, right: Infinity };
    for (const id in fr) {
      const f = fr[id], a = P(f, 0, 0), b = P(f, f.L, 0);
      if (f.el === "front") ori.front = Math.min(ori.front, a[0], b[0]);
      if (f.el === "back") ori.back = Math.max(ori.back, a[0], b[0]);
      if (f.el === "left") ori.left = Math.max(ori.left, a[1], b[1]);
      if (f.el === "right") ori.right = Math.min(ori.right, a[1], b[1]);
    }
    const start = id => { const f = fr[id];
      return f.el === "front" ? f.p0[0] - ori.front : f.el === "back" ? ori.back - f.p0[0] : f.el === "left" ? ori.left - f.p0[1] : f.p0[1] - ori.right; };
    const quad = id => { const f = fr[id]; wall(id, [P(f, 0, f.zb(0)), P(f, f.L, f.zb(f.L)), P(f, f.L, f.zt(f.L)), P(f, 0, f.zt(0))]); };

    // ---------- Wände ----------
    run("WL-1", () => quad("WL-1"));
    run("WL-10", () => quad("WL-10"));
    run("WL-3", () => { const f = fr["WL-3"], a = Math.max(0, Math.min(Dd, ay0)), b = Math.max(0, Math.min(Dd, ay1));
      [[0, a, s => g(Wd, s)], [a, b, aZ], [b, Dd, s => g(Wd, s)]].forEach(([s0, s1, zb]) => {
        if (s1 - s0 > EPS) wall("WL-3", [P(f, s0, zb(s0)), P(f, s1, zb(s1)), P(f, s1, ze), P(f, s0, ze)]); }); });
    run("WL-6", () => { const f = fr["WL-6"], a = Math.max(0, Wd - bx1), b = Math.min(Wd, Wd - bx0);
      [[0, a, s => g(Wd - s, Dd)], [a, b, () => zDeck], [b, Wd, s => g(Wd - s, Dd)]].forEach(([s0, s1, zb]) => {
        if (s1 - s0 > EPS) wall("WL-6", [P(f, s0, zb(s0)), P(f, s1, zb(s1)), P(f, s1, ze), P(f, s0, ze)]); }); });
    ["WL-2", "WL-4", "WL-5", "WL-7", "WL-8", "WL-9"].forEach(id => run(id, () => quad(id)));
    run("WL-5", () => { const hb = aZ(ay1) - gA(ax1, ay1), hm = num(W("WL-5").height_mm);
      if (hm && Math.abs(hb - hm) / hm > TOL) api.konflikt("WL-5", `Rückwand Anbau ${Math.round(hb)} mm hoch (Dach mit ${p9}° Gefälle, Gelände fällt), gemessen ${hm} mm`); });
    run("WL-4", () => { const hb = (aZ(ay0) + aZ(ay1)) / 2 - (gA(ax1, ay0) + gA(ax1, ay1)) / 2, hm = num(W("WL-4").height_mm);
      if (hm && Math.abs(hb - hm) / hm > TOL) api.konflikt("WL-4", `Seitenwand Anbau im Mittel ${Math.round(hb)} mm hoch, gemessen ${hm} mm`); });

    // ---------- Hauptdach, Untersicht, Stirnbrett ----------
    run("RF-1", () => roof("RF-1", [cFL, cFR, RR, RL]));
    run("RF-2", () => roof("RF-2", [cBR, cBL, RL, RR]));
    run("RF-3", () => roof("RF-3", [cBL, cFL, RL]));
    run("RF-4", () => roof("RF-4", [cFR, cBR, RR]));
    run("FC-1", () => {
      const fcA = num(T("FC-1").area_mm2), per = 2 * ((Wd + osl + osr) + (Dd + o + ob));
      const fh = fcA ? fcA / per : api.ergaenzt("stirnbrett_hoehe_mm", 300, "Höhe Stirnbrett", "Foto 1");
      const zF = zE - fh, f = p => [p[0], p[1], zF];
      const wFL = [0, 0, ze], wFR = [Wd, 0, ze], wBR = [Wd, Dd, ze], wBL = [0, Dd, ze];
      [[cFL, cFR, wFR, wFL], [cFR, cBR, wBR, wFR], [cBR, cBL, wBL, wBR], [cBL, cFL, wFL, wBL]].forEach(([a, b, c, d]) => trim("SF-1", [f(a), f(b), c, d]));
      [[cFL, cFR], [cFR, cBR], [cBR, cBL], [cBL, cFL]].forEach(([a, b]) => trim("FC-1", [f(a), f(b), b, a]));
    });

    // ---------- Anbau-Dach, Erker-Deck, Balkongeländer ----------
    const aR = [[ax0 - ovA("left"), ay0 - ovA("front")], [ax1 + ovA("right"), ay0 - ovA("front")], [ax1 + ovA("right"), ay1 + ovA("back")], [ax0 - ovA("left"), ay1 + ovA("back")]]
      .map(([x, y]) => [x, y, aZ(y)]);
    run("RF-9", () => roof("RF-9", aR));
    run("RF-10", () => roof("RF-10", [[bx0, by0, zDeck], [bx1, by0, zDeck], [bx1, by1, zDeck], [bx0, by1, zDeck]]));
    run("AT-3", () => {
      const hr = api.ergaenzt("AT-3_gelaender_mm", 300, "Geländer über der gemauerten Brüstung", "Foto 6");
      const t = api.ergaenzt("AT-3_gelaender_staerke_mm", 40, "Stärke des Geländers", "Foto 6");
      api.part("AT-3", "balkon", [...box(bx0, bx0 + t, by0, by1, zBt, zBt + hr), ...box(bx0, bx1, by1 - t, by1, zBt, zBt + hr), ...box(bx1 - t, bx1, by0, by1, zBt, zBt + hr)]);
      done.add("AT-3");
    });
    skip("AT-1", "gebaut als WL-2, WL-4, WL-5, RF-9");
    skip("AT-2", "gebaut als WL-7, WL-8, WL-9, RF-10");

    // ---------- Kanten Hauptkörper, Anbau, Erker ----------
    run("E-1", () => {
      edge("E-1", RL, RR); edge("E-2", cFL, RL); edge("E-3", cFR, RR); edge("E-4", cBL, RL); edge("E-5", cBR, RR);
      edge("E-6", cBL, cFL); edge("E-7", cFL, cFR); edge("E-8", cFR, cBR); edge("E-9", cBR, cBL);
      edge("E-10", [0, 0, g(0, 0)], [0, 0, ze]); edge("E-11", [Wd, 0, g(Wd, 0)], [Wd, 0, ze]);
      edge("E-12", [0, Dd, g(0, Dd)], [0, Dd, ze]); edge("E-13", [Wd, Dd, g(Wd, Dd)], [Wd, Dd, ze]);
    });
    run("E-14", () => {
      edge("E-14", aR[0], aR[1]); edge("E-15", aR[1], aR[2]); edge("E-16", aR[2], aR[3]);
      edge("E-17", [ax0, ay0, aZ(ay0)], [ax0, ay1, aZ(ay1)]);
      edge("E-18", [ax1, ay0, gA(ax1, ay0)], [ax1, ay0, aZ(ay0)]); edge("E-19", [ax1, ay1, gA(ax1, ay1)], [ax1, ay1, aZ(ay1)]);
      edge("E-20", [ax0, ay0, gA(ax0, ay0)], [ax0, ay0, aZ(ay0)]); edge("E-21", [ax0, ay1, gA(ax0, ay1)], [ax0, ay1, aZ(ay1)]);
    });
    run("E-22", () => {
      edge("E-22", [bx0, by0, zDeck], [bx1, by0, zDeck]);
      edge("E-23", [bx0, by0, zBt], [bx0, by1, zBt]); edge("E-24", [bx0, by1, zBt], [bx1, by1, zBt]); edge("E-25", [bx1, by0, zBt], [bx1, by1, zBt]);
      edge("E-26", [bx0, by1, gBm], [bx0, by1, zBt]); edge("E-27", [bx1, by1, gBm], [bx1, by1, zBt]);
      edge("E-28", [bx0, by0, gBm], [bx0, by0, zBt]); edge("E-29", [bx1, by0, gBm], [bx1, by0, zBt]);
    });

    // ---------- Gauben ----------
    const yAtB = z => Dd - (z - ze) / tb;
    const backDormer = (atId, mbId, wlId, rfId, eIds) => {
      const a = AT(atId), bo = body(mbId), wl = W(wlId), ro = bo.roof || {};
      const w = num(wl.width_mm), h = num(bo.dormer_front_height_mm) ?? num(wl.height_mm);
      const x1 = ori.back - num(wl.start_mm), x0 = x1 - w, yd = Dd - (num(a.y_mm) * cs(pb) - ob), zb = zBack(yd), zt = zb + h;
      const oh = num(ro.overhang_mm) ?? 0, td = tn(num(R(rfId).pitch_deg) ?? pb);
      F(wlId, [x1, yd], [-1, 0], w, cz(zb), cz(zt), { dormer: true });
      const f = fr[wlId];
      wall(wlId, [P(f, 0, zb), P(f, w, zb), P(f, w, zt), P(f, 0, zt)]);
      const zEd = zt - oh * td, ye = yd + oh;
      const E1 = [x0 - oh, ye, zEd], E2 = [x1 + oh, ye, zEd], A0 = [x0, yd, zb], A1 = [x1, yd, zb];
      if (ro.form === "shed") {
        const yT = (ze + Dd * tb - zt - yd * td) / (tb - td), zT = ze + (Dd - yT) * tb;
        const T1 = [x0 - oh, yT, zT], T2 = [x1 + oh, yT, zT], K0 = [x0, yT, zT], K1 = [x1, yT, zT];
        roof(rfId, [E1, E2, T2, T1]);
        api.deko("gaubenwange", [[A0, [x0, yd, zt], K0], [A1, [x1, yd, zt], K1]], wl.color && wl.color.hex);
        edge(eIds[0], E1, E2); edge(eIds[1], E1, T1); edge(eIds[2], E2, T2); edge(eIds[3], T1, T2);
        edge(eIds[4], A0, A1); edge(eIds[5], A0, K0); edge(eIds[6], A1, K1);
      } else { // Walmgaube: vorn abgewalmt, Grat läuft in das Hauptdach (Kehlen)
        const xc = (x0 + x1) / 2, zr2 = zt + (w / 2) * td;
        const Fp = [xc, yd - w / 2, zr2];
        let Bk = [xc, yAtB(zr2), zr2];
        if (Bk[1] > Fp[1]) { api.konflikt(rfId, "Gaubengrat kürzer als Walm - Grat auf Walmspitze gesetzt"); Bk = Fp; }
        const S1 = [x0 - oh, yAtB(zEd), zEd], S2 = [x1 + oh, yAtB(zEd), zEd], yc = yAtB(zt), K0 = [x0, yc, zt], K1 = [x1, yc, zt];
        roof(rfId, [E1, E2, Fp]); roof(rfId, [E1, Fp, Bk, S1]); roof(rfId, [E2, S2, Bk, Fp]);
        api.deko("gaubenwange", [[A0, [x0, yd, zt], K0], [A1, [x1, yd, zt], K1]], wl.color && wl.color.hex);
        edge(eIds[0], E1, Fp); edge(eIds[1], E2, Fp); edge(eIds[2], S1, Bk); edge(eIds[3], S2, Bk);
        edge(eIds[4], E1, E2); edge(eIds[5], A0, A1); edge(eIds[6], A0, K0); edge(eIds[7], A1, K1);
      }
      skip(atId, `gebaut als ${wlId}, ${rfId}`);
    };
    run("AT-5", () => backDormer("AT-5", "MB-5", "WL-12", "RF-6", ["E-32", "E-33", "E-34", "E-35", "E-36", "E-37", "E-38", "E-39"]));
    run("AT-6", () => backDormer("AT-6", "MB-6", "WL-13", "RF-7", ["E-40", "E-41", "E-42", "E-43", "E-44", "E-45", "E-46"]));
    run("AT-7", () => backDormer("AT-7", "MB-7", "WL-14", "RF-8", ["E-47", "E-48", "E-49", "E-50", "E-51", "E-52", "E-53", "E-54"]));
    run("AT-4", () => { // Fledermausgaube vorn: Bogenfront, Dachfläche läuft in das Hauptdach aus
      const a = AT("AT-4"), bo = body("MB-4"), wl = W("WL-11");
      const w = num(wl.width_mm), h = num(bo.dormer_front_height_mm) ?? num(wl.height_mm);
      const x0 = ori.front + num(wl.start_mm), yd = num(a.y_mm) * cs(pf) - o, zb = zFront(yd);
      const arcZ = s => zb + h * Math.sin(PI * s / w);
      F("WL-11", [x0, yd], [1, 0], w, cz(zb), arcZ, { arc: true, z0: zb, h, dormer: true });
      const f = fr["WL-11"], Ap = [], Bp = [];
      for (let i = 0; i <= N; i++) { const s = w * i / N, z = arcZ(s); Ap.push(P(f, s, z)); Bp.push([x0 + s, (z - ze) / tf, z]); }
      wall("WL-11", Ap);
      for (let i = 0; i < N; i++) roof("RF-5", [Ap[i], Ap[i + 1], Bp[i + 1], Bp[i]]);
      edge("E-30", Ap[0], Ap[N]); edge("E-31", Ap[0], Bp[N / 2]);
      skip("AT-4", "gebaut als WL-11, RF-5");
    });

    // ---------- Dachobjekte (Schornsteine, Rohr) ----------
    const facet = { "RF-1": "front", "RF-2": "back", "RF-3": "left", "RF-4": "right" };
    const pitchOf = { front: pf, back: pb, left: pl, right: pr };
    const roofPos = (side, x, y) => { const c = cs(pitchOf[side]);
      if (side === "front") return [-osl + x, y * c - o];
      if (side === "back") return [Wd + osr - x, Dd - (y * c - ob)];
      if (side === "left") return [y * c - osl, Dd + ob - x];
      return [Wd - (y * c - osr), -o + x]; };
    const zSide = (side, X, Y) => side === "front" ? zFront(Y) : side === "back" ? zBack(Y) : side === "left" ? zLeft(X) : zRight(X);
    const roofPart = (id, art) => {
      const a = AT(id), side = facet[a.parent];
      if (!side) return skip(id, "Dachfläche " + a.parent + " nicht im Hauptdach");
      const w = num(a.width_mm), d = num(a.depth_mm) ?? w, h = num(a.height_mm), x = num(a.x_mm), y = num(a.y_mm);
      const p0 = roofPos(side, x, y), p1 = roofPos(side, x + w, y + d / cs(pitchOf[side]));
      const x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]), y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]);
      const zs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => surf(u, v));
      api.part(id, art, box(x0, x1, y0, y1, Math.min(...zs), Math.max(...zs) + h)); done.add(id);
    };
    run("AT-8", () => roofPart("AT-8", "schornstein"));
    run("AT-9", () => roofPart("AT-9", "schornstein"));
    run("AT-10", () => roofPart("AT-10", "rohr"));
    run("AT-11", () => { // Wandlüfter
      const a = AT("AT-11"), f = fr[a.parent];
      if (!f) return skip("AT-11", "Wand " + a.parent + " nicht im Modell");
      const w = num(a.width_mm), h = num(a.height_mm), s0 = Math.max(0, Math.min(f.L - w, num(a.x_mm) - start(a.parent)));
      const pm = P(f, s0, 0), z0 = Math.min(gradeAt(pm[0], pm[1]) + num(a.y_mm), f.zt(s0) - h);
      const dv = api.ergaenzt("AT-11_auskragung_mm", 40, "Auskragung des Lüftungsgitters vor der Wand", "Foto 9");
      const n = [f.d[1], -f.d[0]], p1 = P(f, s0, z0), p2 = P(f, s0 + w, z0 + h);
      api.part("AT-11", "lueftung", box(p1[0], p2[0] + n[0] * dv, p1[1], p2[1] + n[1] * dv, p1[2], p2[2])); done.add("AT-11");
    });

    // ---------- Öffnungen ----------
    const roofOpening = (id, o) => {
      const side = facet[o.parent];
      if (!side) return skip(id, "Dachfläche " + o.parent + " nicht im Hauptdach");
      const x = num(o.x_mm), y = num(o.y_mm), w = num(o.width_mm), h = num(o.height_mm);
      api.opening(id, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => { const q = roofPos(side, a, b); return [q[0], q[1], zSide(side, q[0], q[1])]; }));
      done.add(id);
    };
    const arcWindow = (id, o, f) => {
      const k = Math.min(1, num(o.width_mm) / f.L, num(o.height_mm) / f.h), c = f.L / 2, pts = [];
      for (let i = 0; i <= N; i++) { const s = f.L * i / N; pts.push(P(f, c + k * (s - c), f.z0 + k * (f.zt(s) - f.z0))); }
      api.konflikt(id, `Rundbogenfenster in die Fledermausgaube eingepasst (Faktor ${k.toFixed(2)}); gemessene Brüstung ${num(o.sill_mm)} mm liegt über der Gaube`);
      api.opening(id, pts); done.add(id);
    };
    const place = id => {
      const o = MESS.openings[id], par = o.parent || "";
      if (/^RF-/.test(par)) return roofOpening(id, o);
      const f = fr[par];
      if (!f) return skip(id, "Wand " + par + " nicht im Modell");
      if (f.arc) return arcWindow(id, o, f);
      let w = num(o.width_mm), h = num(o.height_mm), s0 = num(o.x_mm) - start(par);
      const yy = num(o.y_mm) ?? num(o.sill_mm) ?? 0, msg = [];
      if (w > f.L) { msg.push(`Breite ${w} > Wandbreite ${Math.round(f.L)}`); w = f.L; }
      if (s0 < 0) { msg.push(`x um ${Math.round(-s0)} mm in die Wand geschoben`); s0 = 0; }
      if (s0 + w > f.L) { msg.push(`x um ${Math.round(s0 + w - f.L)} mm in die Wand geschoben`); s0 = f.L - w; }
      const pm = P(f, s0 + w / 2, 0); let z0 = gradeAt(pm[0], pm[1]) + yy;
      const ss = [0, 1, 2, 3, 4].map(i => s0 + w * i / 4);
      const zb = Math.max(...ss.map(s => f.zb(s))), zt = Math.min(...ss.map(s => f.zt(s)));
      if (h > zt - zb) { msg.push(`Höhe ${h} > Platz ${Math.round(zt - zb)}`); h = zt - zb; }
      if (z0 < zb) { msg.push(`Unterkante ${Math.round(z0)} unter Wandfuß ${Math.round(zb)}`); z0 = zb; }
      if (z0 + h > zt) { msg.push(`Oberkante ${Math.round(z0 + h)} über Wandoberkante ${Math.round(zt)}`); z0 = zt - h; }
      if (msg.length) api.konflikt(id, "Öffnung an " + par + " angepasst: " + msg.join("; "));
      const head = o.head || {}, r = num(head.rise_mm), c = [P(f, s0, z0), P(f, s0 + w, z0)];
      if (r && head.shape && head.shape !== "flat") {
        const zs = z0 + h - Math.min(r, h);
        for (let i = 0; i <= N; i++) { const t = 1 - i / N; c.push(P(f, s0 + w * t, zs + Math.min(r, h) * Math.sin(PI * t))); }
      } else c.push(P(f, s0 + w, z0 + h), P(f, s0, z0 + h));
      api.opening(id, c); done.add(id);
    };
    for (const id in (MESS.openings || {})) run(id, () => place(id));

    // ---------- Fallrohre ----------
    const dsp = id => {
      const d = MESS.downspouts[id], el = d.elevation, x = num(d.x_mm), Lm = num(d.length_mm);
      const ep = pick(MESS.edges, d.connects_edge_id).parent_attachment_id || null;
      let best = null;
      for (const k in fr) {
        const f = fr[k];
        if (f.dormer || f.el !== el || (W(k).parent_attachment_id || null) !== ep) continue;
        const s = el === "front" ? ori.front + x - f.p0[0] : el === "back" ? f.p0[0] - (ori.back - x) : el === "left" ? f.p0[1] - (ori.left - x) : ori.right + x - f.p0[1];
        if (s < -TOL || s > f.L + TOL) continue;
        const out = el === "front" ? -f.p0[1] : el === "back" ? f.p0[1] : el === "left" ? -f.p0[0] : f.p0[0];
        if (!best || out > best.out) best = { k, f, s: Math.max(0, Math.min(f.L, s)), out };
      }
      if (!best) return skip(id, "keine passende Wand an dieser Position");
      let pt = P(best.f, best.s, 0), zBot = best.f.zb(best.s);
      const zTop = ep === "AT-1" ? aZ(pt[1]) : ze;
      if (best.k === "WL-6" && pt[0] > bx0 && pt[0] < bx1) {
        const gr = gradeAt(pt[0], pt[1]);
        if (Math.abs(zTop - gr - Lm) < Math.abs(zTop - zDeck - Lm)) {
          const nx = (pt[0] - bx0 < bx1 - pt[0]) ? bx0 : bx1;
          api.konflikt(id, `Position ${Math.round(pt[0])} liegt über dem Wintergarten, Länge ${Lm} mm reicht bis zum Boden - an die Ecke x=${Math.round(nx)} gesetzt`);
          pt = [nx, pt[1], 0]; zBot = gr;
        }
      }
      if (Lm && Math.abs(zTop - zBot - Lm) / Lm > TOL) api.konflikt(id, `Fallrohr im Modell ${Math.round(zTop - zBot)} mm, gemessen ${Lm} mm`);
      api.downspout(id, [pt[0], pt[1], zTop], [pt[0], pt[1], zBot]); done.add(id);
    };
    for (const id in (MESS.downspouts || {})) run(id, () => dsp(id));

    // ---------- Schadstellen ----------
    const cond = id => {
      const c = MESS.condition_areas[id], f = fr[c.parent];
      if (!f) return skip(id, "Fläche " + c.parent + " nicht im Modell");
      const A = num(c.area_mm2), mm = String(c.note || "").match(/approx\.\s*(\d+)\s*x\s*(\d+)/);
      let w = mm ? api.ergaenzt(id + "_breite_mm", Number(mm[1]), "Form der Schadstelle laut Foto (Notiz in MESS)", "Foto " + c.photo_index) : Math.sqrt(A);
      let h = A / w, s0 = num(c.x_mm) - start(c.parent);
      const pm = P(f, s0 + w / 2, 0); let z0 = gradeAt(pm[0], pm[1]) + num(c.y_mm); const msg = [];
      if (w > f.L) { w = f.L; msg.push("Breite"); }
      if (s0 < 0) { s0 = 0; msg.push("links"); } if (s0 + w > f.L) { s0 = f.L - w; msg.push("rechts"); }
      const ss = [0, 1, 2, 3, 4].map(i => s0 + w * i / 4);
      const zb = Math.max(...ss.map(s => f.zb(s))), zt = Math.min(...ss.map(s => f.zt(s)));
      if (h > zt - zb) { h = zt - zb; msg.push("Höhe"); }
      if (z0 < zb) { z0 = zb; msg.push("unten"); } if (z0 + h > zt) { z0 = zt - h; msg.push("oben"); }
      if (msg.length) api.konflikt(id, "Schadstelle in die Fläche " + c.parent + " verschoben/beschnitten: " + msg.join(", "));
      api.condition(id, [P(f, s0, z0), P(f, s0 + w, z0), P(f, s0 + w, z0 + h), P(f, s0, z0 + h)]); done.add(id);
    };
    for (const id in (MESS.condition_areas || {})) run(id, () => cond(id));
  } catch (e) {
    api.konflikt("MB-1", "Hausmodell unvollständig: " + (e && e.message));
  }

  // ---------- jede ID bekommt einen Aufruf ----------
  for (const coll of ["walls", "roofs", "trim", "openings", "attachments", "edges", "downspouts", "condition_areas"])
    for (const id in (MESS[coll] || {})) if (!done.has(id)) { try { skip(id, "im Modell keiner Fläche zugeordnet"); } catch (e) { /* weiter */ } }
}
if (typeof module !== "undefined") module.exports = { buildHouse };
