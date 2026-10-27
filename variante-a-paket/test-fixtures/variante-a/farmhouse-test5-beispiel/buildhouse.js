function buildHouse(MESS, api) {
  // Farmhouse Test 5 – Geometrie aus dem V4-Lauf, umgeschrieben auf die Bausteine von Variante A.
  const B = MESS.building, FP = B.footprint, PT = FP.points, E = B.eave_height_mm, D = FP.depth_mm;
  const minX = Math.min(...PT.map(p => p[0])), maxX = Math.max(...PT.map(p => p[0]));
  const minY = Math.min(...PT.map(p => p[1])), maxY = Math.max(...PT.map(p => p[1]));

  // Grundrisskanten -> lokales Wandsystem (s entlang der Wand von außen links nach rechts, z hoch, f nach außen)
  const elevC = { front: p => p[0] - minX, right: p => p[1] - minY, back: p => maxX - p[0], left: p => maxY - p[1] };
  const EDGES = PT.map((a, i) => {
    const b = PT[(i + 1) % PT.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const el = dy === 0 ? (dx > 0 ? "front" : "back") : (dy > 0 ? "right" : "left");
    return { a, el, u: [dx / L, dy / L], n: [dy / L, -dx / L], ca: elevC[el](a), cb: elevC[el](b) };
  });
  function frameOf(wid) {
    const w = MESS.walls[wid];
    for (const e of EDGES) {
      if (e.el !== w.elevation) continue;
      if (w.start_mm >= e.ca - 1 && w.start_mm + w.width_mm <= e.cb + 1) {
        const s0 = w.start_mm - e.ca, o = [e.a[0] + e.u[0] * s0, e.a[1] + e.u[1] * s0], gz = B.per_elevation[w.elevation].grade_offset_mm;
        return (s, z, f) => [o[0] + e.u[0] * s + e.n[0] * (f || 0), o[1] + e.u[1] * s + e.n[1] * (f || 0), z + gz];
      }
    }
    api.konflikt(wid, "Keine passende Grundrisskante für start_mm " + w.start_mm + " / Breite " + w.width_mm);
    return null;
  }
  const rect = (s0, z0, s1, z1) => [[s0, z0], [s1, z0], [s1, z1], [s0, z1]];
  const prismW = (P, c, f0, f1) => {
    const A = c.map(p => P(p[0], p[1], f0)), Bv = c.map(p => P(p[0], p[1], f1)), out = [Bv, A.slice().reverse()];
    for (let i = 0; i < c.length; i++) { const j = (i + 1) % c.length; out.push([A[i], A[j], Bv[j], Bv[i]]); }
    return out;
  };

  // Wände (Ziegelsockel als Deko-Streifen davor)
  const PL = api.ergaenzt("plinth_height_mm", MESS.attachments["AT-3"].height_mm, "Höhe des Ziegelsockels an allen Wänden", "Foto 1: Sockeloberkante = Verandaboden = AT-3.height_mm");
  for (const id in MESS.walls) {
    const w = MESS.walls[id], P = frameOf(id);
    if (!P) { api.nichtGebaut(id, "keine Grundrisskante gefunden"); continue; }
    const c = [[0, 0], [w.width_mm, 0], [w.width_mm, w.height_mm]];
    if (w.gable_height_mm) c.push([w.width_mm / 2, w.height_mm + w.gable_height_mm]);
    c.push([0, w.height_mm]);
    api.wall(id, c.map(p => P(p[0], p[1], 0)));
    if (w.secondary_hex) api.deko("sockel", [rect(0, 0, w.width_mm, PL).map(p => P(p[0], p[1], 5))], w.secondary_hex);
  }

  // Dächer: Ebenen aus Trauf- und Firsthöhen, Kehlen und Grate gerechnet
  const WL = MESS.walls, RF = MESS.roofs, PE = B.per_elevation, o = MESS.trim["SF-1"].soffit_depth_mm;
  const fH = api.ergaenzt("fascia_height_mm", 200, "Höhe des Traufbretts; Untersicht SF-1 liegt darunter waagerecht", "Foto 1/4");
  const zRM = B.ridge_height_mm, kM = (zRM - E) / (D / 2), yR = minY + D / 2, y0 = minY, yD = minY + D;
  const x1 = minX + WL["WL-2"].start_mm, x2 = x1 + WL["WL-2"].width_mm, dP = MESS.attachments["AT-3"].depth_mm, zMe = E - o * kM;
  const WINGS = [
    { wall: "WL-1", el: "left", out: "RF-3", inn: "RF-4", back: "RF-9", hip: "RF-7", dir: -1 },
    { wall: "WL-3", el: "right", out: "RF-6", inn: "RF-5", back: "RF-10", hip: "RF-8", dir: 1 }
  ];
  WINGS.forEach(wg => {
    const xa = minX + WL[wg.wall].start_mm, xb = xa + WL[wg.wall].width_mm, xc = (xa + xb) / 2, half = (xb - xa) / 2;
    const xo = wg.dir < 0 ? xa : xb, xi = wg.dir < 0 ? xb : xa, xoo = xo + wg.dir * o, zRW = PE[wg.el].ridge_height_mm, tW = (zRW - E) / half, zWe = E - o * tW;
    const yH = yD - (zRW - E) / Math.tan(RF[wg.back].pitch_deg * Math.PI / 180), yVF = y0 + (zRW - E) / kM, yVB = yD - (zRW - E) / kM;
    const xr = xc - wg.dir * (zRM - zRW) / Math.tan(RF[wg.hip].pitch_deg * Math.PI / 180);
    Object.assign(wg, { xc, xr, yVF, yVB, zRW, xo, xoo, xi, zWe, yH });
    api.roof(wg.out, [[xc, y0, zRW], [xc, yH, zRW], [xoo, yD + o, zWe], [xoo, y0, zWe]]);
    api.roof(wg.inn, [[xc, y0, zRW], [xi, y0, E], [xc, yVF, zRW]]);
    api.roof(wg.inn, [[xc, yVB, zRW], [xi, yD, E], [xc, yH, zRW]]);
    api.roof(wg.back, [[xc, yH, zRW], [xoo, yD + o, zWe], [xi, yD + o, zWe], [xi, yD, E]]);
    api.roof(wg.hip, [[xc, yVF, zRW], [xr, yR, zRM], [xc, yVB, zRW]]);
    const zS = zWe - fH;
    api.trim("SF-1", [[xo, y0, zS], [xoo, y0, zS], [xoo, yD + o, zS], [xo, yD + o, zS]]);
    api.trim("SF-1", [[xo, yD, zS], [xi, yD, zS], [xi, yD + o, zS], [xo, yD + o, zS]]);
    api.trim("FC-1", [[xoo, y0, zS], [xoo, yD + o, zS], [xoo, yD + o, zWe], [xoo, y0, zWe]]);
    api.trim("FC-1", [[xoo, yD + o, zS], [xi, yD + o, zS], [xi, yD + o, zWe], [xoo, yD + o, zWe]]);
  });
  const [L, R] = WINGS;
  api.roof("RF-1", [[x1, y0, E], [x1, y0 + dP, E + dP * kM], [x2, y0 + dP, E + dP * kM], [x2, y0, E], [R.xc, R.yVF, R.zRW], [R.xr, yR, zRM], [L.xr, yR, zRM], [L.xc, L.yVF, L.zRW]]);
  api.roof("RF-11", [[x1, y0, E], [x2, y0, E], [x2, y0 + dP, E + dP * kM], [x1, y0 + dP, E + dP * kM]]);
  api.roof("RF-2", [[x1, yD, E], [x1, yD + o, zMe], [x2, yD + o, zMe], [x2, yD, E], [R.xc, R.yVB, R.zRW], [R.xr, yR, zRM], [L.xr, yR, zRM], [L.xc, L.yVB, L.zRW]]);
  api.trim("SF-1", [[x1, yD, zMe - fH], [x2, yD, zMe - fH], [x2, yD + o, zMe - fH], [x1, yD + o, zMe - fH]]);
  api.trim("FC-1", [[x1, yD + o, zMe - fH], [x2, yD + o, zMe - fH], [x2, yD + o, zMe], [x1, yD + o, zMe]]);

  // Kanten: Endpunkte aus denselben Variablen wie die Dächer
  const ridgeMain = [[L.xr, yR, zRM], [R.xr, yR, zRM]];
  api.edge("E-1", ...ridgeMain);
  api.edge("E-2", [L.xc, y0, L.zRW], [L.xc, L.yH, L.zRW]);
  api.edge("E-3", [R.xc, y0, R.zRW], [R.xc, R.yH, R.zRW]);
  api.edge("E-4", [L.xc, L.yVF, L.zRW], [L.xr, yR, zRM]);
  api.edge("E-5", [L.xc, L.yVB, L.zRW], [L.xr, yR, zRM]);
  api.edge("E-6", [R.xc, R.yVF, R.zRW], [R.xr, yR, zRM]);
  api.edge("E-7", [R.xc, R.yVB, R.zRW], [R.xr, yR, zRM]);
  api.edge("E-8", [L.xc, L.yH, L.zRW], [L.xoo, yD + o, L.zWe]);
  api.edge("E-9", [L.xc, L.yH, L.zRW], [L.xi, yD, E]);
  api.edge("E-10", [R.xc, R.yH, R.zRW], [R.xi, yD, E]);
  api.edge("E-11", [R.xc, R.yH, R.zRW], [R.xoo, yD + o, R.zWe]);
  api.edge("E-12", [L.xc, y0, L.zRW], [L.xoo, y0, L.zWe]);
  api.edge("E-13", [L.xc, y0, L.zRW], [L.xi, y0, E]);
  api.edge("E-14", [R.xc, y0, R.zRW], [R.xi, y0, E]);
  api.edge("E-15", [R.xc, y0, R.zRW], [R.xoo, y0, R.zWe]);
  api.edge("E-16", [L.xi, y0, E], [L.xc, L.yVF, L.zRW]);
  api.edge("E-17", [R.xi, y0, E], [R.xc, R.yVF, R.zRW]);
  api.edge("E-18", [L.xi, yD, E], [L.xc, L.yVB, L.zRW]);
  api.edge("E-19", [R.xi, yD, E], [R.xc, R.yVB, R.zRW]);
  api.edge("E-20", [x1, y0, E], [x2, y0, E]);
  api.edge("E-21", [x1, yD + o, zMe], [x2, yD + o, zMe]);
  api.edge("E-22", [L.xoo, y0, L.zWe], [L.xoo, yD + o, L.zWe]);
  api.edge("E-23", [R.xoo, y0, R.zWe], [R.xoo, yD + o, R.zWe]);
  api.edge("E-24", [L.xoo, yD + o, L.zWe], [L.xi, yD + o, L.zWe]);
  api.edge("E-25", [R.xi, yD + o, R.zWe], [R.xoo, yD + o, R.zWe]);
  // Hausecken senkrecht: außen und innen aus dem Grundriss
  const area2 = PT.reduce((s, p, i) => { const q = PT[(i + 1) % PT.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const ecken = PT.map((p, i) => { const a = PT[(i + PT.length - 1) % PT.length], c = PT[(i + 1) % PT.length];
    const cr = (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]); return { p, aussen: cr * area2 > 0 }; });
  const vorneA = ecken.filter(e => e.aussen && e.p[1] < (minY + maxY) / 2).sort((a, b) => a.p[0] - b.p[0]);
  const hintenA = ecken.filter(e => e.aussen && e.p[1] >= (minY + maxY) / 2).sort((a, b) => a.p[0] - b.p[0]);
  const innen = ecken.filter(e => !e.aussen).sort((a, b) => a.p[0] - b.p[0]);
  const senk = (e, id) => api.edge(id, [e.p[0], e.p[1], 0], [e.p[0], e.p[1], E]);
  if (vorneA.length === 4 && hintenA.length === 2 && innen.length === 2) {
    senk(vorneA[0], "E-26"); senk(vorneA[3], "E-27"); senk(hintenA[0], "E-28"); senk(hintenA[1], "E-29");
    senk(vorneA[1], "E-30"); senk(vorneA[2], "E-31"); senk(innen[0], "E-32"); senk(innen[1], "E-33");
  } else ["E-26", "E-27", "E-28", "E-29", "E-30", "E-31", "E-32", "E-33"].forEach(id => api.nichtGebaut(id, "Hausecke nicht eindeutig zuzuordnen"));

  // Öffnungen: Umriss in der Wandebene, Rahmen und Sprossen zeichnet der Viewer
  for (const id in MESS.openings) {
    const op = MESS.openings[id], P = frameOf(op.parent);
    if (!P) { api.nichtGebaut(id, "Wand " + op.parent + " nicht platzierbar"); continue; }
    const s0 = op.x_mm - MESS.walls[op.parent].start_mm, z0 = op.y_mm;
    api.opening(id, rect(s0, z0, s0 + op.width_mm, z0 + op.height_mm).map(p => P(p[0], p[1], 0)));
  }

  // Anbauten
  for (const id in MESS.attachments) {
    const at = MESS.attachments[id];
    if (at.type !== "awning") continue;
    const P = frameOf(at.parent), s0 = at.x_mm - MESS.walls[at.parent].start_mm, s1 = s0 + at.width_mm, zb = at.y_mm, zt = zb + at.height_mm, d = at.depth_mm;
    api.part(id, "vordach", [[P(s0, zt, 0), P(s1, zt, 0), P(s1, zb, d), P(s0, zb, d)]], RF["RF-1"].color);
  }
  {
    const id = "AT-3", at = MESS.attachments[id], P = frameOf(at.parent), s0 = at.x_mm - MESS.walls[at.parent].start_mm, w = at.width_mm, d = at.depth_mm, h = at.height_mm;
    const brick = MESS.walls[at.parent].secondary_hex;
    const ps = api.ergaenzt("porch_post_size_mm", 200, "Querschnitt der 4 Holzstützen der Veranda", "Foto 1/3 (Stütze ca. 1/10 der Türbreite 1746)");
    const po = api.ergaenzt("porch_post_center_offset_mm", 1365, "Abstand der 2 mittleren Stützen von der Verandamitte", "Foto 1 (Stützen bei ~35 % und ~63 % der Verandabreite)");
    const n = api.ergaenzt("porch_step_count", 4, "Anzahl Steigungen der Treppe vor D-1", "datum_note (4 risers)");
    const tr = api.ergaenzt("porch_step_tread_mm", 280, "Auftrittstiefe je Stufe", "Foto 1/3, US-Standard 11 in");
    const sw = api.ergaenzt("porch_step_width_mm", 1900, "Treppenbreite", "Foto 1 (Treppe etwas breiter als Tür D-1)");
    api.part(id, "veranda", prismW(P, rect(s0, 0, s0 + w, h), 0, d), brick);
    api.part(id, "veranda", [[P(s0, E, 0), P(s0 + w, E, 0), P(s0 + w, E, d), P(s0, E, d)]], MESS.trim["SF-1"].color);
    [s0 + ps / 2, s0 + w / 2 - po, s0 + w / 2 + po, s0 + w - ps / 2].forEach(sc => api.part(id, "veranda", prismW(P, rect(sc - ps / 2, h, sc + ps / 2, E), d - ps, d), "#A9733F"));
    const sm = s0 + w / 2;
    for (let k = 1; k < n; k++) api.part(id, "veranda", prismW(P, rect(sm - sw / 2, 0, sm + sw / 2, k * h / n), d, d + (n - k) * tr), brick);
  }

  // Konflikte aus dem V4-Lauf (Urteil der KI)
  api.konflikt("RF-1", "Fläche gemessen 63,7 m², Modell größer: Ebene aus Traufe 3250 und First 6300 über die volle Tiefe. Höhen und Neigung behalten, Fläche nicht.");
  api.konflikt("RF-2", "Fläche gemessen 94,8 m², Modell größer (gleiche Konstruktion wie RF-1, hinten mit Überstand 560).");
  api.konflikt("RF-4 RF-5", "Gemessen ist je die volle Flügel-Dachseite; sichtbar ist nur ein Teil, der Rest liegt unter dem Hauptdach.");
  api.konflikt("RF-3 RF-6", "Giebel vorn bündig ohne Überstand, damit Firstlänge und Ortganglänge exakt bleiben (−1,7 %).");
  api.konflikt("E-9 E-10 E-13 E-14", "Innere Grate und Ortgänge der Flügel enden ohne Überstand an der Haupttraufe; gemessen inkl. Überstand.");
  api.konflikt("E-22 E-23 E-24 E-25", "Flügel-Traufen: vorne Giebel bündig ohne Überstand (siehe RF-3/RF-6), daher 560 mm kürzer als gemessen.");
  api.konflikt("AT-1 AT-2", "Vordach-Oberkante 3550 liegt am äußeren Ende 85 mm über der Ortganglinie. Messwerte behalten.");
  api.konflikt("AT-3", "Grundriss zeigt Verandatiefe ca. 1727 mm, Messung 2440 mm. Messwert behalten.");
}
