function buildHouse(MESS, api) {
  try { bau(MESS, api); } catch (e) { api.konflikt("BUILD", "Abbruch im Hausbau: " + (e && e.message)); }
}
function bau(MESS, api) {
  const W = MESS.walls || {}, R = MESS.roofs || {}, T = MESS.trim || {}, O = MESS.openings || {}, A = MESS.attachments || {}, B = MESS.building || {};
  const ED = MESS.edges || {}, DS = MESS.downspouts || {};
  const n = v => (typeof v === "number" && isFinite(v)) ? v : 0;
  const TOL = 5; // Toleranz gegen z-Fighting (mm)
  const P = (x, y, z) => [x, y, z];
  const pe = B.per_elevation || {};
  const grd = el => n(pe[el] && pe[el].grade_offset_mm && (pe[el].grade_offset_mm.value !== undefined ? pe[el].grade_offset_mm.value : pe[el].grade_offset_mm));
  const bodies = (MESS.massing && MESS.massing.bodies) || [];
  const body = id => bodies.find(b => b.id === id) || {};
  const ovh = (id, side) => { const o = body(id).roof && body(id).roof.overhang_mm; return o == null ? 0 : (typeof o === "number" ? o : n(o[side])); };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const quader = (x0, x1, y0, y1, z0, z1) => [
    [P(x0,y0,z0),P(x1,y0,z0),P(x1,y1,z0),P(x0,y1,z0)], [P(x0,y0,z1),P(x0,y1,z1),P(x1,y1,z1),P(x1,y0,z1)],
    [P(x0,y0,z0),P(x0,y0,z1),P(x1,y0,z1),P(x1,y0,z0)], [P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)],
    [P(x0,y0,z0),P(x0,y1,z0),P(x0,y1,z1),P(x0,y0,z1)], [P(x1,y0,z0),P(x1,y0,z1),P(x1,y1,z1),P(x1,y1,z0)]];

  // ---------- Hauptkörper MB-1 ----------
  const gF = grd("front"), gB = grd("back"), gL = grd("left"), gR = grd("right");
  const Wm = n(W["WL-1"].width_mm), zE = gF + n(W["WL-1"].height_mm);
  const Dm = n(W["WL-2"].width_mm), gab = n(W["WL-2"].gable_height_mm);
  const Yr = Dm / 2, zR = zE + gab, tm = gab / Yr;
  const ov = n(T["SF-2"].soffit_depth_mm), ovRake = n(T["SF-5"].soffit_depth_mm);
  const ML = -ovRake, MR = Wm;
  const zMF = y => zE + tm * y, zMB = y => zE + tm * (Dm - y);
  if (R["RF-1"] && Math.abs(Math.atan(tm) * 180 / Math.PI - n(R["RF-1"].pitch_deg)) > 1)
    api.konflikt("RF-1", "Neigung aus WL-2 (Giebel/halbe Tiefe) weicht von pitch_deg ab; gebaut aus Wandmaßen");

  // ---------- Flügel MB-2 (AT-2) ----------
  const Ww = n(W["WL-10"].width_mm), fwd = n(W["WL-11"].width_mm), Dw = n(W["WL-12"].width_mm), gw = n(W["WL-12"].gable_height_mm);
  const zEw = gF + n(W["WL-10"].height_mm), XW = Wm + Ww, tw = gw / (Dw / 2);
  const yWr = -fwd + Dw / 2, zWr = zEw + gw;
  if (Math.abs(Dw - (Dm + fwd)) > 2 * TOL) api.konflikt("WL-12", "Flügeltiefe " + Dw + " ≠ Haupttiefe + Vorsprung " + (Dm + fwd) + "; Rückwand bündig gebaut");
  const ovWF = ovh("MB-2", "front"), ovWB = ovh("MB-2", "back"), ovWR = ovh("MB-2", "right");
  const XR = XW + ovWR, yWf = -fwd - ovWF, yWb = Dm + ovWB;
  const zWF = y => zEw + tw * (y + fwd), zWB = y => zEw + tw * (Dm - y);
  const y0 = (zEw - zE + tw * fwd) / (tm - tw); // Flügeldach schneidet Hauptdach-Vorderfläche an x = Wm

  // ---------- Veranda AT-1 ----------
  const porchD = n(A["AT-1"].depth_mm), hP = gF + n(A["AT-1"].height_mm), ovP = n(T["SF-1"].soffit_depth_mm);
  const yP = -(porchD + ovP), tp = (zE - hP) / (-yP), zP = y => zE + tp * y;

  // ---------- Gaube MB-3 (AT-3) ----------
  const dx0 = n(W["WL-14"].start_mm), dw = n(W["WL-14"].width_mm), dx1 = dx0 + dw, xc = dx0 + dw / 2;
  const fh = n(body("MB-3").dormer_front_height_mm) || n(W["WL-14"].height_mm), dg = n(W["WL-14"].gable_height_mm);
  const zDE = zE + fh, zDR = zDE + dg, td = dg / (dw / 2);
  const cD = fh / tm, yRd = (zDR - zE) / tm;
  const ohs = ovh("MB-3", "left"), ohf = ovh("MB-3", "front");
  const zDv = zDE - td * ohs, yDv = (zDv - zE) / tm;

  // ---------- Kanten-Helfer ----------
  const EL = {};
  const ed = (id, a, b) => {
    if (!ED[id]) return;
    api.edge(id, a, b); EL[id] = [a, b];
    const L = dist(a, b), m = n(ED[id].length_mm);
    if (m && Math.abs(L - m) / m > 0.03) api.konflikt(id, "Modellkante " + Math.round(L) + " mm statt gemessen " + Math.round(m) + " mm");
  };

  // ---------- Wände ----------
  const sys = {}; // Wandsystem: ll = unteres linkes Ende (Grundriss), d = Richtung, g = Gelände
  const Xmax = XW;
  sys["WL-1"] = { ll: [0, 0], d: [1, 0], g: gF };
  api.wall("WL-1", [P(0,0,gF), P(Wm,0,gF), P(Wm,0,zE), P(0,0,zE)]);
  sys["WL-2"] = { ll: [0, Dm], d: [0, -1], g: gL };
  api.wall("WL-2", [P(0,Dm,gL), P(0,0,gL), P(0,0,zE), P(0,Yr,zR), P(0,Dm,zE)]);
  const pA = P(Wm, y0, zMF(y0)), pWr = P(Wm, yWr, zWr), pCr = P(Wm, Dm, zE), pMr = P(Wm, Yr, zR);
  if (y0 > 0 && y0 < yWr && yWr < Yr) { api.wall("WL-3", [pA, pWr, pMr]); api.wall("WL-3", [pWr, pCr, pMr]); }
  else { api.konflikt("WL-3", "Dachverschneidung Flügel/Haupt passt nicht zur erwarteten Reihenfolge"); api.nichtGebaut("WL-3", "Geometrie der freien Giebelfläche nicht konsistent"); }
  const backWall = (id, yp, zb, zt) => {
    const x1 = Xmax - n(W[id].start_mm), x2 = x1 - n(W[id].width_mm);
    sys[id] = { ll: [x1, yp], d: [-1, 0], g: gB };
    api.wall(id, [P(x1,yp,zb), P(x2,yp,zb), P(x2,yp,zt), P(x1,yp,zt)]);
    return [x1, x2];
  };
  const zEr = gB + n(W["WL-4"].height_mm);
  if (Math.abs(zEr - zE) > 2 * TOL) api.konflikt("WL-4", "Traufe hinten " + zEr + " ≠ vorne " + zE + " (über grade_offset); Dach mit vorderer Traufe gebaut");
  backWall("WL-4", Dm, gB, zEr);
  backWall("WL-5", Dm, gB, zEr);
  backWall("WL-6", Dm, zEr - n(W["WL-6"].height_mm), zEr);
  const rd = n(W["WL-8"].width_mm), hRec = gB + n(W["WL-7"].height_mm);
  const [rx1, rx2] = backWall("WL-7", Dm - rd, gB, hRec);
  api.wall("WL-8", [P(rx1,Dm-rd,gB), P(rx1,Dm,gB), P(rx1,Dm,gB + n(W["WL-8"].height_mm)), P(rx1,Dm-rd,gB + n(W["WL-8"].height_mm))]);
  api.wall("WL-9", [P(rx2,Dm,gB), P(rx2,Dm-rd,gB), P(rx2,Dm-rd,gB + n(W["WL-9"].height_mm)), P(rx2,Dm,gB + n(W["WL-9"].height_mm))]);
  api.deko("decke_ruecksitzplatz", [[P(rx2,Dm-rd,hRec), P(rx1,Dm-rd,hRec), P(rx1,Dm,hRec), P(rx2,Dm,hRec)]], "#F4F4F1");
  const floorB = gB + n(O["D-2"] && O["D-2"].y_mm);
  api.deko("boden_ruecksitzplatz", quader(rx2, rx1, Dm - rd, Dm, gB, floorB), "#9A9890");
  sys["WL-10"] = { ll: [Wm, -fwd], d: [1, 0], g: gF };
  api.wall("WL-10", [P(Wm,-fwd,gF), P(XW,-fwd,gF), P(XW,-fwd,zEw), P(Wm,-fwd,zEw)]);
  api.wall("WL-11", [P(Wm,0,gL), P(Wm,-fwd,gL), P(Wm,-fwd,zEw), P(Wm,0,zEw)]);
  api.wall("WL-12", [P(XW,-fwd,gR), P(XW,Dm,gR), P(XW,Dm,zEw), P(XW,yWr,zWr), P(XW,-fwd,zEw)]);
  backWall("WL-13", Dm, gB, gB + n(W["WL-13"].height_mm));
  // Giebelfüllung Flügel über Veranda/Hauptdach (nicht gemessen)
  api.deko("giebelfuellung_fluegel", [[P(Wm,-fwd,zEw), P(Wm,0,zE), pA]], "#F1F1EC");
  sys["WL-14"] = { ll: [dx0, 0], d: [1, 0], g: gF };
  api.wall("WL-14", [P(dx0,0,zE), P(dx1,0,zE), P(dx1,0,zDE), P(xc,0,zDR), P(dx0,0,zDE)]);
  api.wall("WL-15", [P(dx0,cD,zDE), P(dx0,0,zE), P(dx0,0,zDE)]);
  api.wall("WL-16", [P(dx1,0,zE), P(dx1,cD,zDE), P(dx1,0,zDE)]);

  // ---------- Dächer ----------
  const F = (x, y) => P(x, y, zMF(y)), Bk = (x, y) => P(x, y, zMB(y));
  if (yRd < Yr) {
    api.roof("RF-1", [F(ML,0), F(dx0,0), F(dx0,Yr), F(ML,Yr)]);
    api.roof("RF-1", [F(dx1,0), F(MR,0), F(MR,Yr), F(dx1,Yr)]);
    api.roof("RF-1", [F(dx0,cD), F(xc,yRd), F(xc,Yr), F(dx0,Yr)]);
    api.roof("RF-1", [F(xc,yRd), F(dx1,cD), F(dx1,Yr), F(xc,Yr)]);
  } else { api.konflikt("RF-1", "Gaubenfirst über Hauptfirst"); api.roof("RF-1", [F(ML,0), F(MR,0), F(MR,Yr), F(ML,Yr)]); }
  api.roof("RF-2", [Bk(ML,Yr), Bk(MR,Yr), Bk(MR,Dm+ov), Bk(ML,Dm+ov)]);
  const Pp = (x, y) => P(x, y, zP(y));
  api.roof("RF-3", [Pp(ML,yP), Pp(MR,yP), Pp(MR,0), Pp(ML,0)]);
  const Wf = (x, y) => P(x, y, zWF(y)), Wb = (x, y) => P(x, y, zWB(y));
  api.roof("RF-4", [Wf(Wm,yWf), Wf(XR,yWf), Wf(XR,yWr), Wf(Wm,yWr)]);
  api.roof("RF-5", [Wb(Wm,yWr), Wb(XR,yWr), Wb(XR,yWb), Wb(Wm,yWb)]);
  const dL0 = P(dx0-ohs,-ohf,zDv), dR0 = P(xc,-ohf,zDR), dR1 = P(xc,yRd,zDR), dLv = P(dx0-ohs,yDv,zDv);
  const dRr0 = P(dx1+ohs,-ohf,zDv), dRrv = P(dx1+ohs,yDv,zDv);
  api.roof("RF-6", [dL0, dR0, dR1, dLv]);
  api.roof("RF-7", [dR0, dRr0, dRrv, dR1]);

  // ---------- Untersichten / Blenden ----------
  const fH = (id, run) => { const h = n(T[id] && T[id].area_mm2) / run; return h > 0 ? h : api.ergaenzt("blendenhoehe_" + id, 200, "Blendenhöhe fehlt", "Foto 2"); };
  const fasciaSeg = (id, segs, h, off) => segs.forEach(([a, b]) => {
    const a2 = [a[0]+off[0], a[1]+off[1], a[2]], b2 = [b[0]+off[0], b[1]+off[1], b[2]];
    api.trim(id, [P(a2[0],a2[1],a2[2]-h), P(b2[0],b2[1],b2[2]-h), b2, a2]);
  });
  const segLen = segs => segs.reduce((s, [a, b]) => s + dist(a, b), 0);
  api.trim("SF-1", [P(ML,yP,hP), P(MR,yP,hP), P(MR,-porchD,hP), P(ML,-porchD,hP)]);
  fasciaSeg("FC-1", [[Pp(ML,yP), Pp(MR,yP)]], fH("FC-1", MR - ML), [0, 0]);
  const zRe = zMB(Dm + ov);
  api.trim("SF-2", [P(ML,Dm,zRe), P(ML,Dm+ov,zRe), P(MR,Dm+ov,zRe), P(MR,Dm,zRe)]);
  fasciaSeg("FC-2", [[Bk(ML,Dm+ov), Bk(MR,Dm+ov)]], fH("FC-2", MR - ML), [0, 0]);
  const zWfe = zWF(yWf), zWbe = zWB(yWb);
  api.trim("SF-3", [P(Wm,yWf,zWfe), P(XR,yWf,zWfe), P(XR,-fwd,zWfe), P(Wm,-fwd,zWfe)]);
  api.trim("SF-4", [P(Wm,Dm,zWbe), P(XR,Dm,zWbe), P(XR,yWb,zWbe), P(Wm,yWb,zWbe)]);
  fasciaSeg("FC-3", [[Wf(Wm,yWf), Wf(XR,yWf)]], fH("FC-3", XR - Wm), [0, 0]);
  fasciaSeg("FC-4", [[Wb(Wm,yWb), Wb(XR,yWb)]], fH("FC-4", XR - Wm), [0, 0]);
  const low = p => P(p[0], p[1], p[2] - TOL);
  api.trim("SF-5", [low(Pp(ML,yP)), low(Pp(0,yP)), low(Pp(0,0)), low(Pp(ML,0))]);
  api.trim("SF-5", [low(F(ML,0)), low(F(0,0)), low(F(0,Yr)), low(F(ML,Yr))]);
  api.trim("SF-5", [low(Bk(ML,Yr)), low(Bk(0,Yr)), low(Bk(0,Dm+ov)), low(Bk(ML,Dm+ov))]);
  const s5 = [[Pp(ML,yP), Pp(ML,0)], [F(ML,0), F(ML,Yr)], [Bk(ML,Yr), Bk(ML,Dm+ov)]];
  fasciaSeg("FC-5", s5, fH("FC-5", segLen(s5)), [-TOL, 0]);
  const s6 = [[Wf(XR,yWf), Wf(XR,yWr)], [Wb(XR,yWr), Wb(XR,yWb)]];
  fasciaSeg("FC-6", s6, fH("FC-6", segLen(s6)), [TOL, 0]);
  const s7 = [[dL0, dR0], [dR0, dRr0]];
  fasciaSeg("FC-7", s7, fH("FC-7", segLen(s7)), [0, -TOL]);
  const s8 = [[F(MR,y0), F(MR,Yr)], [Bk(MR,Yr), Bk(MR,Dm+ov)]];
  fasciaSeg("FC-8", s8, fH("FC-8", segLen(s8)), [TOL, 0]);

  // ---------- Kanten (Reihenfolge wie Messung) ----------
  const ridgeL = F(ML,Yr), ridgeR = F(MR,Yr), rEL = Bk(ML,Dm+ov), rER = Bk(MR,Dm+ov);
  ed("E-1", ridgeL, ridgeR); ed("E-2", rEL, rER);
  ed("E-3", F(ML,0), ridgeL); ed("E-4", ridgeL, rEL);
  ed("E-5", pA, ridgeR); ed("E-6", ridgeR, rER);
  ed("E-7", F(ML,0), F(MR,0));
  ed("E-8", P(0,0,gF), P(0,0,zE)); ed("E-9", P(0,Dm,gB), P(0,Dm,zEr));
  ed("E-10", P(rx2,Dm,gB), P(rx2,Dm,hRec)); ed("E-11", P(rx2,Dm-rd,gB), P(rx2,Dm-rd,hRec));
  ed("E-12", P(rx1,Dm-rd,gB), P(rx1,Dm-rd,hRec)); ed("E-13", P(rx1,Dm,gB), P(rx1,Dm,hRec));
  ed("E-14", P(Wm,0,gF), P(Wm,0,zE));
  ed("E-15", Pp(ML,yP), Pp(MR,yP)); ed("E-16", Pp(ML,yP), Pp(ML,0));
  ed("E-17", Pp(MR,yP), Pp(MR,-fwd)); ed("E-18", Pp(MR,-fwd), Pp(MR,0));
  const wrL = P(Wm,yWr,zWr), wrR = P(XR,yWr,zWr);
  ed("E-19", wrL, wrR); ed("E-20", Wf(Wm,yWf), Wf(XR,yWf)); ed("E-21", Wb(Wm,yWb), Wb(XR,yWb));
  ed("E-22", Wf(Wm,yWf), pA); ed("E-23", Wf(XR,yWf), wrR); ed("E-24", wrR, Wb(XR,yWb));
  ed("E-25", pA, wrL); ed("E-26", wrL, P(Wm,Dm,zWB(Dm)));
  ed("E-27", P(Wm,-fwd,gF), P(Wm,-fwd,zEw)); ed("E-28", P(XW,-fwd,gF), P(XW,-fwd,zEw)); ed("E-29", P(XW,Dm,gB), P(XW,Dm,zEw));
  const cL = P(dx0,cD,zDE), cR = P(dx1,cD,zDE);
  ed("E-30", dR0, dR1); ed("E-31", cL, dR1); ed("E-32", cR, dR1);
  ed("E-33", dL0, dLv); ed("E-34", dRr0, dRrv);
  ed("E-35", dL0, dR0); ed("E-36", dR0, dRr0);
  ed("E-37", P(dx0,0,zE), P(dx1,0,zE));
  ed("E-38", P(dx0,0,zE), cL); ed("E-39", P(dx1,0,zE), cR);
  ed("E-40", P(dx0,0,zE), P(dx0,0,zDE)); ed("E-41", P(dx1,0,zE), P(dx1,0,zDE));
  Object.keys(ED).forEach(id => { if (!EL[id]) api.nichtGebaut(id, "keine passende Modellkante"); });

  // ---------- Öffnungen ----------
  Object.keys(O).forEach(id => {
    const o = O[id], s0 = sys[o.parent], w = W[o.parent];
    if (!s0 || !w) { api.konflikt(id, "Trägerwand " + o.parent + " nicht im Modell"); api.nichtGebaut(id, "Trägerwand fehlt"); return; }
    const s = n(o.x_mm) - n(w.start_mm), ww = n(o.width_mm), hh = n(o.height_mm);
    if (s < 0 || s + ww > n(w.width_mm) + TOL) api.konflikt(id, "Öffnung ragt über Wand " + o.parent + " hinaus");
    const a = [s0.ll[0] + s0.d[0] * s, s0.ll[1] + s0.d[1] * s], b = [a[0] + s0.d[0] * ww, a[1] + s0.d[1] * ww];
    const z0 = s0.g + n(o.y_mm);
    api.opening(id, [P(a[0],a[1],z0), P(b[0],b[1],z0), P(b[0],b[1],z0+hh), P(a[0],a[1],z0+hh)]);
  });

  // ---------- Anbauteile ----------
  const floorF = gF + n(O["D-1"] && O["D-1"].y_mm);
  const post = api.ergaenzt("verandastuetze_mm", 140, "Querschnitt einer Verandastütze (je Paar zwei Stützen)", "Foto 1 und 4");
  const pgap = api.ergaenzt("stuetzenpaar_abstand_mm", 80, "Lichter Abstand zwischen den Stützen eines Paares", "Foto 1 und 4");
  const beamH = api.ergaenzt("verandabalken_hoehe_mm", 250, "Höhe des Verandabalkens unter der Traufe", "Foto 1");
  const vx = [300, 3000, 5600, 8300].map((v, i) => api.ergaenzt("stuetzenpaar_" + (i + 1) + "_x_mm", v, "Mitte Stützenpaar " + (i + 1) + " (massing missing, ca.)", "Foto 4"));
  const stepW = api.ergaenzt("verandatreppe_breite_mm", 1800, "Breite der Vordertreppe", "Foto 1 und 4");
  const tread = api.ergaenzt("verandatreppe_auftritt_mm", 300, "Auftrittstiefe der Vordertreppe", "Foto 1");
  const yPost0 = -porchD, yPost1 = -porchD + post, zBeam = zP(yPost1) - beamH;
  const vf = [].concat(quader(0, Wm, -porchD, 0, gF, floorF));
  vx.forEach(c => { [c - pgap / 2 - post, c + pgap / 2].forEach(x0 => vf.push(...quader(x0, x0 + post, yPost0, yPost1, floorF, zBeam))); });
  vf.push(...quader(0, Wm, yPost0, yPost1, zBeam, zP(yPost1)));
  const dC = n(O["D-1"].x_mm) + n(O["D-1"].width_mm) / 2, stepsN = 3, rise = (floorF - gF) / stepsN;
  for (let i = 0; i < stepsN; i++) vf.push(...quader(dC - stepW / 2, dC + stepW / 2, -porchD - (stepsN - i) * tread, -porchD, gF, gF + rise * (i + 1)));
  api.part("AT-1", "veranda", vf);
  const v4 = A["AT-4"], vs = sys[v4 && v4.parent];
  if (vs) {
    const dep = api.ergaenzt("giebelluefter_tiefe_mm", 50, "Vorstand des Giebellüfters", "Foto 3");
    const s = n(v4.x_mm) - n(W[v4.parent].start_mm), ya = vs.ll[1] - s, yb = ya - n(v4.width_mm), z0 = vs.g + n(v4.y_mm);
    api.part("AT-4", "giebelluefter", quader(-dep, 0, yb, ya, z0, z0 + n(v4.height_mm)), "#E8E8E4");
  } else { api.konflikt("AT-4", "Trägerwand fehlt"); api.nichtGebaut("AT-4", "Trägerwand fehlt"); }
  api.nichtGebaut("AT-2", "gebaut als WL-10, WL-11, WL-12, WL-13, RF-4, RF-5");
  api.nichtGebaut("AT-3", "gebaut als WL-14, WL-15, WL-16, RF-6, RF-7");

  // ---------- Sockel (Deko, Höhe = Fußbodenhöhe aus Türschwellen) ----------
  const sk = (a, b, g0, h, off) => api.deko("sockel_naturstein", [[P(a[0]+off[0],a[1]+off[1],g0), P(b[0]+off[0],b[1]+off[1],g0), P(b[0]+off[0],b[1]+off[1],g0+h), P(a[0]+off[0],a[1]+off[1],g0+h)]], "#9A9890");
  const hF = floorF - gF, hB = floorB - gB;
  sk([0,Dm], [0,0], gL, hF, [-TOL,0]); sk([Wm,0], [Wm,-fwd], gL, hF, [-TOL,0]);
  sk([Wm,-fwd], [XW,-fwd], gF, hF, [0,-TOL]); sk([XW,-fwd], [XW,Dm], gR, hF, [TOL,0]);
  sk([XW,Dm], [rx1,Dm], gB, hB, [0,TOL]); sk([rx2,Dm], [0,Dm], gB, hB, [0,TOL]);

  // ---------- Fallrohre ----------
  Object.keys(DS).forEach(id => {
    const d = DS[id], e = EL[d.connects_edge_id];
    if (!e) { api.konflikt(id, "Traufkante " + d.connects_edge_id + " fehlt"); api.nichtGebaut(id, "keine Traufkante"); return; }
    const x = n(d.x_mm), k = (x - e[0][0]) / ((e[1][0] - e[0][0]) || 1), top = P(x, e[0][1] + k * (e[1][1] - e[0][1]), e[0][2] + k * (e[1][2] - e[0][2]));
    const bot = P(x, top[1], grd(d.elevation));
    api.downspout(id, top, bot);
    const L = top[2] - bot[2], m = n(d.length_mm);
    if (m && Math.abs(L - m) / m > 0.03) api.konflikt(id, "Fallrohr " + Math.round(L) + " mm bis zur Rinne statt gemessen " + Math.round(m) + " mm");
  });
  Object.keys(MESS.condition_areas || {}).forEach(id => api.nichtGebaut(id, "keine Schadensfläche gemessen"));
}
