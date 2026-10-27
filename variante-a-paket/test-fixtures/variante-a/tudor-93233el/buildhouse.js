// SnapTape Variante A – Schritt 2 – Haus 93233EL (Tudor, Plan + Rendering)
// Messung: snaptape-v1-8-2-chattest-93233EL-ergebnis.json (Schema 1.8, Prompt v1.8.2)
function buildHouse(MESS, api) {
  const G = api.geo, done = {}, EP = {};
  const kon = (id, t) => { try { api.konflikt(id, t); } catch (e) {} };
  const run = (id, f) => { try { f(); } catch (e) { kon(id, "Fehler beim Bau: " + (e && e.message)); } };
  const W = id => MESS.walls[id], T = id => MESS.trim[id], pit = id => MESS.roofs[id].pitch_deg;
  const tan = d => Math.tan(G.rad(d)), cos = d => Math.cos(G.rad(d));
  const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  const wall = (id, c) => { if (MESS.walls[id]) { api.wall(id, c); done[id] = 1; } };
  const roof = (id, c) => { if (MESS.roofs[id]) { api.roof(id, c); done[id] = 1; } };
  const trim = (id, c) => { if (MESS.trim[id]) { api.trim(id, c); done[id] = 1; } };
  function edge(id, p, q) {
    const m = MESS.edges[id]; if (!m || !p || !q) return;
    api.edge(id, p, q); done[id] = 1; EP[id] = [p, q];
    const L = len(p, q);
    if (m.length_mm && Math.abs(L - m.length_mm) / m.length_mm > 0.03)
      kon(id, `Modellkante ${Math.round(L)} mm statt gemessen ${Math.round(m.length_mm)} mm`);
  }
  const gab = (id, apex, base) => {
    const g = W(id).gable_height_mm; if (!g || !apex) return; const m = apex[2] - base;
    if (Math.abs(m - g) / g > 0.03) kon(id, `Giebelhöhe im Modell ${Math.round(m)} mm statt gemessen ${Math.round(g)} mm (folgt aus Dachneigungen und Wandbreite)`);
  };
  const Bd = id => MESS.massing.bodies.find(b => b.id === id);
  const E = (p, d, u) => G.ebene(p, d, u), S = (a, b, o) => G.schnitt(a, b, o), P3 = (a, b, c) => G.punkt3(a, b, c);
  const h = (Pl, x, y) => [x, y, G.z(Pl, x, y)];

  // ---------- Grundriss aus massing + Wänden
  const mb1 = Bd("MB-1"), mb2 = Bd("MB-2"), mb3 = Bd("MB-3"), mb4 = Bd("MB-4");
  const XR = mb1.footprint_mm.width_mm, D = mb1.footprint_mm.depth_mm;
  const XE = XR + mb2.footprint_mm.width_mm, YE = mb2.attach.offset_mm;
  const X3 = mb3.attach.offset_mm, Yb = -mb3.footprint_mm.depth_mm;
  const X1 = W("WL-1").width_mm, wRL = W("WL-10").width_mm, x6a = XR - W("WL-8").width_mm;
  const yK0 = Yb + W("WL-14").start_mm;
  const hL = W("WL-5").height_mm, hG1 = W("WL-1").height_mm, hF = W("WL-2").height_mm, hG3 = W("WL-3").height_mm;
  const hR = W("WL-12").height_mm, hB = W("WL-9").height_mm, hB10 = W("WL-10").height_mm, hB8 = W("WL-8").height_mm, hK = W("WL-14").height_mm;
  const ovL = T("SF-1").soffit_depth_mm, ovF = T("SF-2").soffit_depth_mm, ovB = T("SF-3").soffit_depth_mm, ovC = T("SF-4").soffit_depth_mm;
  const ovR = api.ergaenzt("ueberstand_rechts_mm", ovB, "Dachüberstand rechts (SF-5/SF-7 ohne Tiefe), wie hinten angenommen", "Messung SF-3");
  const ovD = mb4.roof.overhang_mm;
  const fh = MESS.trim["FC-1"].area_mm2 / MESS.edges["E-12"].length_mm; // Blendenhöhe aus Messung

  // ---------- Dachebenen
  const PL = E([0, 0, hL], pit("RF-1"), [1, 0]), P2 = E([X1, 0, hG1], pit("RF-2"), [-1, 0]);
  const PF = E([0, 0, hF], pit("RF-3"), [0, 1]), PB = E([0, D, hB], pit("RF-4"), [0, -1]);
  const P5 = E([wRL, D, hB10], pit("RF-5"), [-1, 0]), P6 = E([x6a, D, hB8], pit("RF-6"), [1, 0]);
  const PR = E([XR, 0, hR], pit("RF-7"), [-1, 0]), P8 = E([X3, 0, hG3], pit("RF-8"), [1, 0]);
  const PC = E([XR, 0, hR], pit("RF-10"), [-1, 0]);
  const PK1 = E([XE, yK0, hK], pit("RF-11"), [0, 1]), PK2 = E([XE, D, hK], pit("RF-12"), [0, -1]);

  // ---------- gemeinsame Punkte (einmal berechnet)
  const yF = -ovF, yR = D + ovB, yF3 = Yb - ovF, xo = XE + ovC;
  const r1f = S(PL, P2, { y: yF }), A = P3(PL, P2, PF), Bp = P3(PL, PF, PB), C = P3(PL, P5, PB), r5b = S(PL, P5, { y: yR });
  const A2 = P3(P8, PR, PF), B2 = P3(PR, PF, PB), C2 = P3(P6, PR, PB), r6b = S(P6, PR, { y: yR }), r8f = S(P8, PR, { y: yF3 });
  const v2 = S(P2, PF, { y: yF }), v8 = S(P8, PF, { y: yF }), k8 = h(P8, v8[0], yF3);
  const v5 = S(P5, PB, { y: yR }), v6 = S(P6, PB, { y: yR });
  const e1f = h(PL, -ovL, yF), e1b = h(PL, -ovL, yR);
  const pYE = h(PR, XR, YE), pYEo = h(PR, XR + ovR, YE), pFo = h(PR, XR + ovR, yF3), c7b = h(PR, XR, yR);
  const V1 = S(PC, PK1, { x: xo }), V2 = S(PC, PK1, { x: XR }), K = P3(PK1, PK2, PR), G1 = S(PK1, PK2, { x: xo });
  const K2 = S(PK2, PR, { x: XR }), c12o = h(PK2, xo, yR), c12i = h(PK2, XR, yR), pCo = h(PC, xo, YE);
  const zPCXE = G.z(PC, XE, YE), vW = S(PC, PK1, { x: XE });
  const ap1 = S(PL, P2, { y: 0 }), ap8 = S(P8, PR, { y: Yb }), ap6 = S(P6, PR, { y: D }), ap5 = S(PL, P5, { y: D }), ap14 = S(PK1, PK2, { x: XE });

  // ---------- Hauptdach MB-1 / MB-3 / MB-2
  run("RF-1", () => roof("RF-1", [e1f, r1f, A, Bp, C, r5b, e1b]));
  run("RF-2", () => roof("RF-2", [r1f, v2, A]));
  run("RF-3", () => roof("RF-3", [v2, v8, A2, B2, Bp, A]));
  run("RF-4", () => roof("RF-4", [Bp, B2, C2, v6, v5, C]));
  run("RF-5", () => roof("RF-5", [C, v5, r5b]));
  run("RF-6", () => roof("RF-6", [C2, r6b, v6]));
  run("RF-7", () => roof("RF-7", [A2, B2, C2, r6b, c7b, K2, K, V2, pYE]));
  run("RF-8", () => roof("RF-8", [r8f, k8, v8, A2]));
  run("RF-9", () => { roof("RF-9", [r8f, A2, pYE, pYEo, pFo]);
    if (Math.abs(pit("RF-9") - pit("RF-7")) > 1) kon("RF-9", `liegt laut massing in der Ebene von RF-7: gebaut mit ${pit("RF-7")}° statt gemessen ${pit("RF-9")}°`); });
  run("RF-10", () => roof("RF-10", [pYE, pCo, V1, V2]));
  run("RF-11", () => roof("RF-11", [V1, G1, K, V2]));
  run("RF-12", () => roof("RF-12", [G1, c12o, c12i, K2, K]));
  run("ridge", () => { const m = MESS.building.ridge_height_mm; if (m && Math.abs(Bp[2] - m) / m > 0.03) kon("RF-3", `Firsthöhe im Modell ${Math.round(Bp[2])} mm statt gemessen ${Math.round(m)} mm`); });

  // ---------- Wände
  run("WL-1", () => { wall("WL-1", [[0, 0, 0], [X1, 0, 0], [X1, 0, hG1], ap1, [0, 0, hL]]); gab("WL-1", ap1, hG1); });
  run("WL-2", () => wall("WL-2", [[X1, 0, 0], [X3, 0, 0], [X3, 0, hF], [X1, 0, hF]]));
  run("WL-3", () => { wall("WL-3", [[X3, Yb, 0], [XR, Yb, 0], [XR, Yb, hR], ap8, [X3, Yb, hG3]]); gab("WL-3", ap8, hG3); });
  run("WL-4", () => wall("WL-4", [[XR, YE, 0], [XE, YE, 0], [XE, YE, zPCXE], [XR, YE, hR]]));
  run("WL-5", () => wall("WL-5", [[0, D, 0], [0, 0, 0], [0, 0, hL], [0, D, hL]]));
  run("WL-6", () => wall("WL-6", [[X3, 0, 0], [X3, Yb, 0], [X3, Yb, hG3], [X3, 0, hG3]]));
  run("WL-7", () => wall("WL-7", [[XE, D, 0], [XR, D, 0], [XR, D, hK], [XE, D, hK]]));
  run("WL-8", () => { wall("WL-8", [[XR, D, 0], [x6a, D, 0], [x6a, D, hB8], ap6, [XR, D, hR]]); gab("WL-8", ap6, hB8); });
  run("WL-9", () => wall("WL-9", [[x6a, D, 0], [wRL, D, 0], [wRL, D, hB], [x6a, D, hB]]));
  run("WL-10", () => { wall("WL-10", [[wRL, D, 0], [0, D, 0], [0, D, hL], ap5, [wRL, D, hB10]]); gab("WL-10", ap5, hB10); });
  run("WL-11", () => wall("WL-11", [[XR, Yb, 0], [XR, 0, 0], [XR, 0, hR], [XR, Yb, hR]]));
  run("WL-12", () => wall("WL-12", [[XR, 0, 0], [XR, YE, 0], [XR, YE, hR], [XR, 0, hR]]));
  run("WL-13", () => wall("WL-13", [[XE, YE, 0], [XE, yK0, 0], [XE, yK0, zPCXE], [XE, YE, zPCXE]]));
  run("WL-14", () => { wall("WL-14", [[XE, yK0, 0], [XE, D, 0], [XE, D, hK], ap14, vW, [XE, yK0, zPCXE]]); gab("WL-14", ap14, hK); });
  run("WL-15", () => wall("WL-15", [K2, [XR, D, hK], [XR, D, hR]]));

  // ---------- Gaube MB-4 / AT-1
  const at1 = MESS.attachments["AT-1"], pF = pit("RF-3");
  const x0 = v2[0] + at1.x_mm, yd0 = at1.y_mm * cos(pF) - ovF, zd0 = G.z(PF, x0, yd0);
  const x1 = x0 + W("WL-16").width_mm, zde = zd0 + mb4.dormer_front_height_mm, yDf = yd0 - ovD;
  const PD1 = E([x0, 0, zde], pit("RF-13"), [1, 0]), PD2 = E([x1, 0, zde], pit("RF-14"), [-1, 0]);
  const Rf = S(PD1, PD2, { y: yDf }), Rb = P3(PD1, PD2, PF), apD = S(PD1, PD2, { y: yd0 });
  const Lf = h(PD1, x0 - ovD, yDf), Lb = S(PD1, PF, { x: x0 - ovD }), Qf = h(PD2, x1 + ovD, yDf), Qb = S(PD2, PF, { x: x1 + ovD });
  const yC = yd0 + (zde - zd0) / tan(pF);
  const d0 = [x0, yd0, zd0], d1 = [x1, yd0, zd0];
  run("AT-1", () => {
    roof("RF-13", [Rf, Rb, Lb, Lf]); roof("RF-14", [Rf, Qf, Qb, Rb]);
    wall("WL-16", [d0, d1, [x1, yd0, zde], apD, [x0, yd0, zde]]); gab("WL-16", apD, zde);
    wall("WL-17", [[x0, yC, zde], [x0, yd0, zde], d0]); wall("WL-18", [d1, [x1, yd0, zde], [x1, yC, zde]]);
    api.nichtGebaut("AT-1", "gebaut als WL-16, WL-17, WL-18, RF-13, RF-14"); done["AT-1"] = 1;
  });

  // ---------- Öffnungen
  const plane = { "WL-1": ["front", 0], "WL-2": ["front", 0], "WL-3": ["front", Yb], "WL-4": ["front", YE], "WL-16": ["front", yd0],
    "WL-5": ["left", 0], "WL-6": ["left", X3], "WL-17": ["left", x0], "WL-7": ["back", D], "WL-8": ["back", D], "WL-9": ["back", D],
    "WL-10": ["back", D], "WL-11": ["right", XR], "WL-12": ["right", XR], "WL-15": ["right", XR], "WL-13": ["right", XE],
    "WL-14": ["right", XE], "WL-18": ["right", x1] };
  const toW = (el, c, s, z) => el === "front" ? [s, c, z] : el === "back" ? [XE - s, c, z] : el === "left" ? [c, D - s, z] : [c, Yb + s, z];
  Object.keys(MESS.openings || {}).forEach(id => run(id, () => {
    const o = MESS.openings[id], pl = plane[o.parent];
    if (!pl) { api.nichtGebaut(id, "Wand " + o.parent + " nicht im Modell"); done[id] = 1; return; }
    const s = o.x_mm, z0 = o.y_mm != null ? o.y_mm : o.sill_mm, w = o.width_mm, hh = o.height_mm;
    const rise = o.head && o.head.shape !== "flat" && o.head.rise_mm ? o.head.rise_mm : 0;
    const p = [[s, z0], [s + w, z0]];
    if (rise) { const hs = z0 + hh - rise; p.push([s + w, hs]);
      for (let i = 1; i < 12; i++) { const a = G.rad(180 * i / 12); p.push([s + w / 2 + w / 2 * Math.cos(a), hs + rise * Math.sin(a)]); }
      p.push([s, hs]);
    } else p.push([s + w, z0 + hh], [s, z0 + hh]);
    api.opening(id, p.map(q => toW(pl[0], pl[1], q[0], q[1]))); done[id] = 1;
  }));

  // ---------- Vordächer AT-2 / AT-3
  function awning(at, rf, ee, ef) {
    const a = MESS.attachments[at], yw = plane[a.parent][1], ax0 = a.x_mm, ax1 = ax0 + a.width_mm;
    const zb = a.y_mm, zt = zb + a.height_mm, d = a.depth_mm;
    roof(rf, [[ax0, yw, zt], [ax1, yw, zt], [ax1, yw - d, zb], [ax0, yw - d, zb]]);
    edge(ee, [ax0, yw - d, zb], [ax1, yw - d, zb]); edge(ef, [ax0, yw, zt], [ax1, yw, zt]);
    const pm = Math.atan(a.height_mm / d) * 180 / Math.PI;
    if (Math.abs(pm - pit(rf)) > 2) kon(rf, `Neigung aus Höhe/Tiefe ${pm.toFixed(1)}° statt gemessen ${pit(rf)}°`);
    api.nichtGebaut(at, "gebaut als " + rf + " (gerade Ebene statt Glockenform)"); done[at] = 1;
  }
  run("AT-2", () => awning("AT-2", "RF-15", "E-56", "E-57"));
  run("AT-3", () => awning("AT-3", "RF-16", "E-58", "E-59"));

  // ---------- Veranda AT-4
  run("AT-4", () => {
    const a = MESS.attachments["AT-4"];
    const ovP = api.ergaenzt("veranda_ueberstand_mm", ovB, "Dachüberstand der Veranda wie Hauptdach hinten", "Messung SF-3");
    const xr = XE - a.x_mm, xl = xr - a.width_mm, xc = (xl + xr) / 2, dep = a.depth_mm, zA = a.height_mm;
    const yo = D + dep + ovP, zE4 = zA - (dep + ovP) * tan(pit("RF-17"));
    const P0 = [xc, D, zA], BL = [xl - ovP, yo, zE4], BR = [xr + ovP, yo, zE4], SL = [xl - ovP, D, zE4], SR = [xr + ovP, D, zE4];
    roof("RF-17", [P0, BL, BR]); roof("RF-18", [P0, SL, BL]); roof("RF-19", [P0, BR, SR]);
    const ps = Math.atan((zA - zE4) / (xc - xl + ovP)) * 180 / Math.PI;
    if (Math.abs(ps - pit("RF-18")) > 2) kon("RF-18", `Seitenneigung aus Geometrie ${ps.toFixed(1)}° statt gemessen ${pit("RF-18")}°`);
    edge("E-60", P0, BL); edge("E-61", P0, BR); edge("E-62", SL, BL); edge("E-63", BL, BR); edge("E-64", BR, SR);
    edge("E-65", P0, SL); edge("E-66", P0, SR);
    const deckH = MESS.openings["D-4"].sill_mm; // Terrassenplatte = Schwelle der Terrassentüren
    const post = api.ergaenzt("veranda_stuetze_mm", 200, "Querschnitt der Verandastützen", "Zeichnung Rückansicht");
    const zTop = zA - dep * tan(pit("RF-17"));
    let faces = G.quader(xl, xr, D, D + dep, 0, deckH);
    for (let i = 0; i < 4; i++) { const px = xl + (a.width_mm - post) * i / 3; faces = faces.concat(G.quader(px, px + post, D + dep - post, D + dep, deckH, zTop)); }
    const kb = api.ergaenzt("aussenkamin_breite_mm", 900, "Breite des Außenkamins auf der Veranda", "Grundriss (Outdoor Living)");
    const kt = api.ergaenzt("aussenkamin_tiefe_mm", 1800, "Tiefe des Außenkamins", "Grundriss (Outdoor Living)");
    const ka = api.ergaenzt("aussenkamin_abstand_wand_mm", 1000, "Abstand des Kamins von der Rückwand", "Grundriss (Outdoor Living)");
    const E19 = G.ebeneAus3(P0, BR, SR), zk = G.z(E19, xr, D + ka);
    faces = faces.concat(G.quader(xr - kb, xr, D + ka, D + ka + kt, deckH, Math.min(zk, zTop)));
    api.part("AT-4", "veranda", faces); done["AT-4"] = 1;
    if (xr + ovP > XR) kon("AT-4", "Verandadach reicht über die Rückwand von MB-2 und überschneidet dort den Überstand von RF-12 (Zeichnung zeigt den Anschluss nicht genau)");
  });

  // ---------- Untersichten / Blenden
  const hz = (xa, xb, ya, yb, z) => [[xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z]];
  const fx = (xa, xb, y, z) => [[xa, y, z - fh], [xb, y, z - fh], [xb, y, z], [xa, y, z]];
  const fy = (x, ya, yb, z) => [[x, ya, z - fh], [x, yb, z - fh], [x, yb, z], [x, ya, z]];
  run("SF-1", () => { trim("SF-1", hz(-ovL, 0, yF, yR, e1f[2] - fh)); trim("FC-1", fy(-ovL, yF, yR, e1f[2])); });
  run("SF-2", () => { trim("SF-2", hz(v2[0], v8[0], yF, 0, v2[2] - fh)); trim("FC-2", fx(v2[0], v8[0], yF, v2[2])); });
  run("SF-3", () => { trim("SF-3", hz(v6[0], v5[0], D, yR, v5[2] - fh)); trim("FC-3", fx(v5[0], v6[0], yR, v5[2])); });
  run("SF-4", () => { trim("SF-4", hz(XE, xo, YE, V1[1], pCo[2] - fh)); trim("FC-4", fy(xo, YE, V1[1], pCo[2])); });
  run("SF-6", () => { trim("SF-6", hz(XR, xo, D, yR, c12o[2] - fh)); trim("FC-6", fx(XR, xo, yR, c12o[2])); });
  run("SF-7", () => { trim("SF-7", hz(XR, XR + ovR, yF3, YE, pFo[2] - fh)); trim("FC-7", fy(XR + ovR, yF3, YE, pFo[2])); });
  ["SF-5", "FC-5"].forEach(id => { if (T(id)) { api.nichtGebaut(id, "RF-7 hinten ohne Überstand gebaut (Anschluss an Quergiebel RF-12)"); done[id] = 1; } });

  // ---------- Kanten
  run("E-MB1", () => {
    edge("E-1", r1f, A); edge("E-2", C, r5b); edge("E-3", Bp, B2); edge("E-4", C2, r6b);
    edge("E-5", A, Bp); edge("E-6", Bp, C); edge("E-7", A2, B2); edge("E-8", B2, C2);
    edge("E-9", v2, A); edge("E-10", v5, C); edge("E-11", v6, C2);
    edge("E-12", e1f, e1b); edge("E-13", v2, v8); edge("E-14", v5, v6); edge("E-15", K2, c7b);
    edge("E-16", e1f, r1f); edge("E-17", e1b, r5b); edge("E-18", r1f, v2); edge("E-19", r5b, v5); edge("E-20", v6, r6b); edge("E-21", r6b, c7b);
    edge("E-22", [0, 0, 0], [0, 0, hL]); edge("E-23", [0, D, 0], [0, D, hL]);
  });
  run("E-MB2", () => {
    edge("E-24", K, G1); edge("E-25", V1, V2); edge("E-26", c12i, c12o); edge("E-27", pCo, V1); edge("E-28", pYE, pCo);
    edge("E-29", G1, V1); edge("E-30", G1, c12o); edge("E-31", K2, [XR, D, hK]); edge("E-32", pYE, V2);
    edge("E-33", [XR, YE, 0], [XR, YE, hR]); edge("E-34", [XE, YE, 0], [XE, YE, zPCXE]); edge("E-35", [XE, D, 0], [XE, D, hK]);
  });
  run("E-MB3", () => {
    edge("E-36", r8f, A2); edge("E-37", v8, A2); edge("E-38", pFo, pYEo); edge("E-39", k8, r8f); edge("E-40", r8f, pFo);
    edge("E-41", [X3, 0, 0], [X3, 0, hG3]); edge("E-42", [X3, Yb, 0], [X3, Yb, hG3]); edge("E-43", [XR, Yb, 0], [XR, Yb, hR]);
  });
  run("E-MB4", () => {
    edge("E-44", Rf, Rb); edge("E-45", Lb, Rb); edge("E-46", Qb, Rb); edge("E-47", Lf, Lb); edge("E-48", Qf, Qb);
    edge("E-49", Lf, Rf); edge("E-50", Rf, Qf); edge("E-51", d0, d1); edge("E-52", d0, [x0, yC, zde]); edge("E-53", d1, [x1, yC, zde]);
    edge("E-54", d0, [x0, yd0, zde]); edge("E-55", d1, [x1, yd0, zde]);
  });

  // ---------- Fallrohre
  Object.keys(MESS.downspouts || {}).forEach(id => run(id, () => {
    const d = MESS.downspouts[id], el = d.elevation, s = d.x_mm;
    const c = el === "front" ? (s < X3 ? 0 : s <= XR ? Yb : YE) : el === "back" ? D : el === "left" ? (D - s >= 0 ? 0 : X3) : (Yb + s < YE ? XR : XE);
    let b = toW(el, c, s, 0), zt = MESS.building.eave_height_mm;
    const e = EP[d.connects_edge_id];
    if (e) {
      const [p, q] = e, vx = q[0] - p[0], vy = q[1] - p[1], L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((b[0] - p[0]) * vx + (b[1] - p[1]) * vy) / L2));
      const cp = [p[0] + t * vx, p[1] + t * vy, p[2] + t * (q[2] - p[2])];
      b = (el === "front" || el === "back") ? [b[0], cp[1], 0] : [cp[0], b[1], 0]; zt = cp[2];
    }
    api.downspout(id, [b[0], b[1], zt], b); done[id] = 1;
    if (d.length_mm && Math.abs(zt - d.length_mm) / d.length_mm > 0.03) kon(id, `Länge im Modell ${Math.round(zt)} mm statt gemessen ${Math.round(d.length_mm)} mm`);
    if (id === "DS-7") kon(id, "Fallrohr an der Traufe E-15 läuft über das Dach RF-12 von MB-2; bis Gelände gezeichnet");
  }));

  // ---------- Schäden (keine) und Vollständigkeit
  Object.keys(MESS.condition_areas || {}).forEach(id => { if (!done[id]) { api.nichtGebaut(id, "Schadensfläche nicht platziert"); done[id] = 1; } });
  ["walls", "roofs", "trim", "openings", "attachments", "edges", "downspouts"].forEach(k =>
    Object.keys(MESS[k] || {}).forEach(id => { if (!done[id]) { try { api.nichtGebaut(id, "im Modell nicht zugeordnet"); } catch (e) {} } }));
}
