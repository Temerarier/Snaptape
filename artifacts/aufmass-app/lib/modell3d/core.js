function SNAPTAPE_CORE() {
  "use strict";
  var VERSION = "A-2026-10-08";

  // ---------- Messung (Schema 1.8) -> MESS ----------
  function unwrap(v) {
    if (Array.isArray(v)) return v.map(unwrap);
    if (v && typeof v === "object") {
      if ("value" in v && ("confidence" in v || "source" in v)) return unwrap(v.value);
      var o = {};
      for (var k in v) {
        if (k === "confidence" || k === "source" || k === "reference_used" || k === "low_reason") continue;
        o[k] = unwrap(v[k]);
      }
      return o;
    }
    return v;
  }
  function hexOf(c) { return c && typeof c === "object" ? (c.hex || null) : (typeof c === "string" ? c : null); }
  function secOf(c) { return c && typeof c === "object" ? (c.secondary_hex || null) : null; }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }

  function measurementToMess(raw) {
    var j = unwrap(raw);
    var M = { walls: {}, roofs: {}, trim: {}, openings: {}, attachments: {}, downspouts: {}, edges: {}, condition_areas: {}, building: {}, massing: { bodies: [] }, notes: [] };
    (j.faces || []).forEach(function (f) {
      if (f.face_class === "wall") {
        M.walls[f.id] = { elevation: f.elevation || null, material: f.material || null, width_mm: num(f.width_mm), height_mm: num(f.height_mm),
          gable_height_mm: num(f.gable_height_mm), start_mm: num(f.start_mm), area_mm2: num(f.area_mm2), net_area_mm2: num(f.net_area_mm2),
          parent_attachment_id: f.parent_attachment_id || null, color: hexOf(f.color), secondary_hex: secOf(f.color) };
      } else if (f.face_class === "roof_face") {
        var p = f.pitch && typeof f.pitch === "object" ? f.pitch.degrees_original : f.pitch;
        M.roofs[f.id] = { elevation: f.elevation || null, material: f.material || null, pitch_deg: num(p), area_mm2: num(f.area_mm2),
          orientation_deg: num(f.orientation_deg), parent_attachment_id: f.parent_attachment_id || null, color: hexOf(f.color) };
      } else {
        M.trim[f.id] = { face_class: f.face_class || null, elevation: f.elevation || null, material: f.material || null,
          soffit_depth_mm: num(f.soffit_depth_mm), area_mm2: num(f.area_mm2), parent_attachment_id: f.parent_attachment_id || null, color: hexOf(f.color) };
      }
    });
    (j.openings || []).forEach(function (o) {
      var pos = o.position_mm || {};
      M.openings[o.id] = { type: o.type || null, parent: o.parent_face_id || null, elevation: o.elevation || null,
        width_mm: num(o.width_mm), height_mm: num(o.height_mm), sill_mm: num(o.sill_height_mm), x_mm: num(pos.x), y_mm: num(pos.y),
        area_mm2: num(o.area_mm2), head: o.head || null, divisions: o.divisions || null, group_id: o.group_id || null };
    });
    (j.attachments || []).forEach(function (a) {
      var pos = a.position_mm || {};
      M.attachments[a.id] = { type: a.type || null, subtype: a.subtype || null, parent: a.parent_face_id || null, elevation: a.elevation || null,
        width_mm: num(a.width_mm), height_mm: num(a.height_mm), depth_mm: num(a.depth_mm), x_mm: num(pos.x), y_mm: num(pos.y),
        attached: a.attached, dormer: a.dormer || null };
    });
    (j.downspouts || []).forEach(function (d) {
      var pos = d.position_mm || {};
      M.downspouts[d.id] = { elevation: d.elevation || null, length_mm: num(d.length_mm), x_mm: num(pos.x), connects_edge_id: d.connects_edge_id || null };
    });
    (j.edges || []).forEach(function (e) {
      M.edges[e.id] = { edge_class: e.edge_class || null, length_mm: num(e.length_mm), elevation: e.belongs_to_elevation || null,
        parent_attachment_id: e.parent_attachment_id || null };
    });
    M.condition_areas = {};
    (j.condition_areas || []).forEach(function (c) {
      var pos = c.position_mm || {};
      M.condition_areas[c.id] = { type: c.type || null, parent: c.parent_face_id || null, elevation: c.elevation || null, area_mm2: num(c.area_mm2),
        severity: c.severity || null, x_mm: num(pos.x), y_mm: num(pos.y), photo_index: c.photo_index == null ? null : c.photo_index, note: c.note || null };
    });
    var b = j.building || {}, h = b.heights || {}, fp = b.footprint || {};
    var pe = {};
    (Array.isArray(h.per_elevation) ? h.per_elevation : []).forEach(function (x) {
      if (x && x.elevation) pe[x.elevation] = { eave_height_mm: num(x.eave_height_mm), ridge_height_mm: num(x.ridge_height_mm), grade_offset_mm: num(x.grade_offset_mm) };
    });
    ["front", "back", "left", "right"].forEach(function (e) { if (!pe[e]) pe[e] = { eave_height_mm: null, ridge_height_mm: null, grade_offset_mm: 0 }; if (pe[e].grade_offset_mm == null) pe[e].grade_offset_mm = 0; });
    M.building = { building_type: b.building_type || null, stories: num(b.stories), roof_type: b.roof_type || null,
      footprint: { points: Array.isArray(fp) ? fp : (fp.points || null), width_mm: num(fp.width_mm), depth_mm: num(fp.depth_mm), area_mm2: num(fp.area_mm2), perimeter_mm: num(fp.perimeter_mm) },
      eave_height_mm: num(h.eave_height_mm), ridge_height_mm: num(h.ridge_height_mm), datum_note: h.datum_note || null, per_elevation: pe };
    M.massing = { bodies: ((j.massing || {}).bodies || []) };
    M.notes = (j.meta && j.meta.notes) ? [].concat(j.meta.notes) : [];
    return M;
  }

  // ---------- Vektor- und Ebenenrechnung (Werkzeugkasten api.geo) ----------
  function newell(p) {
    var n = [0, 0, 0];
    for (var i = 0; i < p.length; i++) { var a = p[i], c = p[(i + 1) % p.length];
      n[0] += (a[1] - c[1]) * (a[2] + c[2]); n[1] += (a[2] - c[2]) * (a[0] + c[0]); n[2] += (a[0] - c[0]) * (a[1] + c[1]); }
    return n;
  }
  function len(v) { return Math.hypot(v[0], v[1], v[2]); }
  var geo = {
    rad: function (d) { return d * Math.PI / 180; },
    // Ebene als z = a*x + b*y + c. Durch Punkt p (z.B. auf der Traufe), Neigung in Grad, steigend in Richtung "hoch" ([dx,dy], waagerecht).
    ebene: function (p, neigungDeg, hoch) {
      var L = Math.hypot(hoch[0], hoch[1]); if (!L) throw new Error("geo.ebene: Richtung 'hoch' ist null");
      var t = Math.tan(neigungDeg * Math.PI / 180), ux = hoch[0] / L, uy = hoch[1] / L;
      return { a: t * ux, b: t * uy, c: p[2] - t * (ux * p[0] + uy * p[1]) };
    },
    ebeneAus3: function (p, q, r) {
      var u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (Math.abs(n[2]) < 1e-9) throw new Error("geo.ebeneAus3: Ebene ist senkrecht");
      return { a: -n[0] / n[2], b: -n[1] / n[2], c: p[2] + (n[0] * p[0] + n[1] * p[1]) / n[2] };
    },
    z: function (E, x, y) { return E.a * x + E.b * y + E.c; },
    heben: function (E, pts) { return pts.map(function (p) { return [p[0], p[1], E.a * p[0] + E.b * p[1] + E.c]; }); },
    // Punkt auf der Schnittlinie zweier Ebenen bei gegebenem x ({x:..}) oder y ({y:..})
    schnitt: function (E1, E2, bei) {
      var da = E1.a - E2.a, db = E1.b - E2.b, dc = E1.c - E2.c, x, y;
      if (bei.x != null) { if (Math.abs(db) < 1e-12) throw new Error("geo.schnitt: Ebenen schneiden sich nicht bei x"); x = bei.x; y = -(da * x + dc) / db; }
      else if (bei.y != null) { if (Math.abs(da) < 1e-12) throw new Error("geo.schnitt: Ebenen schneiden sich nicht bei y"); y = bei.y; x = -(db * y + dc) / da; }
      else throw new Error("geo.schnitt: {x} oder {y} angeben");
      return [x, y, E1.a * x + E1.b * y + E1.c];
    },
    // Punkt, in dem sich drei Ebenen treffen
    punkt3: function (E1, E2, E3) {
      var A = [[E1.a, E1.b, -1], [E2.a, E2.b, -1], [E3.a, E3.b, -1]], r = [-E1.c, -E2.c, -E3.c];
      var det = function (m) { return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); };
      var D = det(A); if (Math.abs(D) < 1e-12) throw new Error("geo.punkt3: Ebenen haben keinen gemeinsamen Punkt");
      var out = [];
      for (var k = 0; k < 3; k++) { var m = A.map(function (row, i) { var c = row.slice(); c[k] = r[i]; return c; }); out.push(det(m) / D); }
      return out;
    },
    // Senkrechtes Prisma über einem Grundriss (2D-Punkte) von z0 bis z1 -> Liste von Flächen
    prisma: function (grund, z0, z1) {
      var f = [grund.map(function (p) { return [p[0], p[1], z0]; }), grund.map(function (p) { return [p[0], p[1], z1]; }).reverse()];
      for (var i = 0; i < grund.length; i++) { var a = grund[i], c = grund[(i + 1) % grund.length];
        f.push([[a[0], a[1], z0], [c[0], c[1], z0], [c[0], c[1], z1], [a[0], a[1], z1]]); }
      return f;
    },
    quader: function (x0, x1, y0, y1, z0, z1) { return geo.prisma([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1); },
    // Lokales, gedrehtes System in der Grundrissebene: ursprung [x,y], winkel in Grad (0 = x-Achse)
    system: function (ursprung, winkelDeg) {
      var w = winkelDeg * Math.PI / 180, cx = Math.cos(w), sx = Math.sin(w);
      return function (a, b, z) { return [ursprung[0] + a * cx - b * sx, ursprung[1] + a * sx + b * cx, z == null ? 0 : z]; };
    },
    // Lokales System auf einer senkrechten Fläche: s entlang der Wand von p0 nach p1, z nach oben, f nach außen (wenn aussen [dx,dy] gegeben)
    wand: function (p0, p1, aussen) {
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = uy, ny = -ux;
      if (aussen && nx * aussen[0] + ny * aussen[1] < 0) { nx = -nx; ny = -ny; }
      return function (s, z, f) { f = f || 0; return [p0[0] + ux * s + nx * f, p0[1] + uy * s + ny * f, z]; };
    }
  };

  // ---------- Bausteine für die KI ----------
  function makeApi(MESS) {
    var R = { format: "snaptape-a-modell", version: "1", einheit: "mm", flaechen: [], oeffnungen: [], anbauten: {}, deko: [],
      kanten: [], fallrohre: [], schaeden: [], ergaenzt: [], konflikte: [], nicht_gebaut: [], fehler: [], hinweise: [] };
    var DACH_ARTEN = ["dach"], TRIM_ARTEN = { soffit: "untersicht", fascia: "blende" };
    function ok(pts, wo) {
      if (!Array.isArray(pts) || pts.length < 3) { R.fehler.push(wo + ": weniger als 3 Ecken"); return null; }
      var out = [];
      for (var i = 0; i < pts.length; i++) { var p = pts[i];
        if (!Array.isArray(p) || p.length < 3 || !isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) { R.fehler.push(wo + ": Ecke " + i + " ist keine Zahl [x,y,z]"); return null; }
        out.push([+p[0], +p[1], +p[2]]); }
      var n = newell(out), L = len(n);
      if (L < 1e-6) { R.fehler.push(wo + ": Fläche hat keine Ausdehnung"); return null; }
      var nn = [n[0] / L, n[1] / L, n[2] / L], d0 = nn[0] * out[0][0] + nn[1] * out[0][1] + nn[2] * out[0][2], maxd = 0;
      out.forEach(function (p) { maxd = Math.max(maxd, Math.abs(nn[0] * p[0] + nn[1] * p[1] + nn[2] * p[2] - d0)); });
      if (maxd > 5) R.hinweise.push(wo + ": Fläche ist nicht eben (bis " + Math.round(maxd) + " mm)");
      return out;
    }
    function gruppe(id) { for (var g in { walls: 1, roofs: 1, trim: 1, openings: 1, attachments: 1, edges: 1, downspouts: 1, condition_areas: 1 }) if (MESS[g] && MESS[g][id]) return g; return null; }
    function pkt(p, wo) { if (!Array.isArray(p) || p.length < 3 || !isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) { R.fehler.push(wo + ": Punkt ist keine Zahl [x,y,z]"); return null; } return [+p[0], +p[1], +p[2]]; }
    function idOk(id, erwartet, wo) {
      var g = gruppe(id);
      if (!g) { R.fehler.push(wo + ": ID " + id + " gibt es in der Messung nicht"); return false; }
      if (erwartet && erwartet.indexOf(g) < 0) { R.fehler.push(wo + ": ID " + id + " ist " + g + ", nicht " + erwartet.join("/")); return false; }
      return true;
    }
    var api = {
      geo: geo,
      wall: function (id, ecken) { var w = "wall(" + id + ")"; if (!idOk(id, ["walls"], w)) return; var e = ok(ecken, w); if (e) R.flaechen.push({ id_1_7: id, art: "wand", ecken: e }); },
      roof: function (id, ecken) { var w = "roof(" + id + ")"; if (!idOk(id, ["roofs"], w)) return; var e = ok(ecken, w); if (e) R.flaechen.push({ id_1_7: id, art: "dach", ecken: e }); },
      trim: function (id, ecken) { var w = "trim(" + id + ")"; if (!idOk(id, ["trim"], w)) return; var e = ok(ecken, w); if (e) R.flaechen.push({ id_1_7: id, art: TRIM_ARTEN[MESS.trim[id].face_class] || "verkleidung", ecken: e }); },
      opening: function (id, ecken) { var w = "opening(" + id + ")"; if (!idOk(id, ["openings"], w)) return; var e = ok(ecken, w);
        if (e) { var o = MESS.openings[id]; R.oeffnungen.push({ id_1_7: id, art: ({ window: "fenster", door: "tuer", patio_door: "tuer", garage_door: "garagentor", skylight: "dachfenster" })[o.type] || "fenster", wand_id_1_7: o.parent, ecken: e }); } },
      part: function (id, art, flaechen, farbe) { var w = "part(" + id + ")"; if (!idOk(id, ["attachments"], w)) return;
        if (!Array.isArray(flaechen) || !flaechen.length) { R.fehler.push(w + ": keine Flächen"); return; }
        if (!Array.isArray(flaechen[0][0])) flaechen = [flaechen];
        var A = R.anbauten[id] || (R.anbauten[id] = { id_1_7: id, art: art || MESS.attachments[id].type, flaechen: [], farben: [] });
        flaechen.forEach(function (f, i) { var e = ok(f, w + " Fläche " + i); if (e) { A.flaechen.push(e); A.farben.push(typeof farbe === "string" ? farbe : null); } }); },
      deko: function (art, flaechen, farbe) { var w = "deko(" + art + ")";
        if (!Array.isArray(flaechen) || !flaechen.length) return; if (!Array.isArray(flaechen[0][0])) flaechen = [flaechen];
        var d = { art: String(art || "deko"), farbe: typeof farbe === "string" ? farbe : null, flaechen: [] };
        flaechen.forEach(function (f, i) { var e = ok(f, w + " Fläche " + i); if (e) d.flaechen.push(e); }); if (d.flaechen.length) R.deko.push(d); },
      edge: function (id, p0, p1) { var w = "edge(" + id + ")"; if (!idOk(id, ["edges"], w)) return; var a = pkt(p0, w), c = pkt(p1, w);
        if (a && c) { if (Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) < 1) { R.fehler.push(w + ": Anfang und Ende sind gleich"); return; } R.kanten.push({ id_1_7: id, art: MESS.edges[id].edge_class, von: a, bis: c }); } },
      downspout: function (id, oben, unten) { var w = "downspout(" + id + ")"; if (!idOk(id, ["downspouts"], w)) return; var a = pkt(oben, w), c = pkt(unten, w);
        if (a && c) R.fallrohre.push({ id_1_7: id, oben: a, unten: c }); },
      condition: function (id, ecken) { var w = "condition(" + id + ")"; if (!idOk(id, ["condition_areas"], w)) return; var e = ok(ecken, w);
        if (e) R.schaeden.push({ id_1_7: id, art: MESS.condition_areas[id].type, flaeche_id_1_7: MESS.condition_areas[id].parent, ecken: e }); },
      ergaenzt: function (name, value, grund, quelle) { R.ergaenzt.push({ name: String(name), value: value, grund: String(grund || ""), quelle: String(quelle || "") }); return value; },
      konflikt: function (id, text) { R.konflikte.push({ id: String(id), text: String(text || "") }); },
      nichtGebaut: function (id, grund) { R.nicht_gebaut.push({ id: String(id), grund: String(grund || "") }); }
    };
    return { api: api, result: function () { R.anbauten = Object.keys(R.anbauten).map(function (k) { return R.anbauten[k]; }); return R; } };
  }

  function runBuild(MESS, code) {
    var A = makeApi(MESS), t0 = Date.now(), err = null;
    try {
      var f = new Function("MESS", "api", code + "\n;if (typeof buildHouse !== 'function') throw new Error('Keine Funktion buildHouse gefunden'); return buildHouse(MESS, api);");
      f(JSON.parse(JSON.stringify(MESS)), A.api);
    } catch (e) { err = e; }
    var R = A.result();
    if (err) R.fehler.unshift("Abbruch in buildHouse: " + (err && err.message ? err.message : String(err)) + " (bis dahin gebaute Teile werden gezeigt)");
    R.laufzeit_ms = Date.now() - t0;
    return R;
  }

  // ---------- Prüfung gegen die Messung ----------
  // Stufen (Entscheidung 12.10.2026):
  //   STOPP  (status "fail")  -> kein 3D, ein neuer Versuch: Abbruch ohne Flächen, Hauptkörper fehlt,
  //                              Hauptmaße (Wände des Hauptkörpers, First) über 25 % daneben.
  //   MERKEN (status "warn")  -> 3D wird gezeigt, Meldung für die Admin-Ansicht: Abweichung über 10 %,
  //                              fehlende Nebenteile, Kanten an falscher Stelle, Fehler beim Bau einzelner Teile.
  //   INFO   (status "info")  -> alles bis 10 %, Hang-Auslegung, gemeldete Konflikte innerhalb 10 %.
  var TOL = 0.10, TOL_INFO = 0.005, TOL_MIN = 10, TOL_GRAD = 1, TOL_STOPP = 0.25;
  function pruefen(MESS, R) {
    var Z = [];
    var hatKonflikt = function (id) { return R.konflikte.some(function (k) { return (" " + String(k.id).replace(/[,;/]/g, " ") + " ").indexOf(" " + id + " ") >= 0; }); };
    var ng = {}; R.nicht_gebaut.forEach(function (n) { ng[n.id] = n.grund; });
    var gebaut = {};
    R.flaechen.forEach(function (f) { (gebaut[f.id_1_7] = gebaut[f.id_1_7] || []).push(f.ecken); });
    R.oeffnungen.forEach(function (o) { (gebaut[o.id_1_7] = gebaut[o.id_1_7] || []).push(o.ecken); });
    R.anbauten.forEach(function (a) { gebaut[a.id_1_7] = (gebaut[a.id_1_7] || []).concat(a.flaechen); });
    R.schaeden.forEach(function (c) { (gebaut[c.id_1_7] = gebaut[c.id_1_7] || []).push(c.ecken); });
    var kant = {}; R.kanten.forEach(function (k) { kant[k.id_1_7] = k; });
    var rohr = {}; R.fallrohre.forEach(function (d) { rohr[d.id_1_7] = d; });
    var add = function (id, pruefung, status, text) { Z.push({ id: id, pruefung: pruefung, status: status, text: text }); };
    var H = function (a, c) { return Math.hypot(a[0] - c[0], a[1] - c[1]); };
    var D3 = function (a, c) { return Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]); };
    var ext = function (polys) { var pts = [].concat.apply([], polys), e = 0, zmin = Infinity, zmax = -Infinity;
      for (var i = 0; i < pts.length; i++) { zmin = Math.min(zmin, pts[i][2]); zmax = Math.max(zmax, pts[i][2]); for (var k = i + 1; k < pts.length; k++) e = Math.max(e, H(pts[i], pts[k])); }
      return { breite: e, hoehe: zmax - zmin, zmin: zmin }; };
    var area = function (p) { var n = newell(p); return len(n) / 2; };
    // Fußlinie einer Wand: untere Ecken (untere Hälfte), entlang der Wand interpoliert
    function fussLinie(polys) {
      var pts = [].concat.apply([], polys), zmin = Infinity, zmax = -Infinity;
      pts.forEach(function (p) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); });
      var mid = zmin + (zmax - zmin) * 0.35, fuss = pts.filter(function (p) { return p[2] <= mid; });
      if (fuss.length < 2) return { schraeg: false, zmin: zmin, zmax: zmin, zAn: function () { return zmin; } };
      var a = fuss[0], b = fuss[0], dmax = 0;
      fuss.forEach(function (p) { fuss.forEach(function (q) { var d = H(p, q); if (d > dmax) { dmax = d; a = p; b = q; } }); });
      var fz = fuss.map(function (p) { return p[2]; }), lo = Math.min.apply(null, fz), hi = Math.max.apply(null, fz);
      var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      return { schraeg: hi - lo > 50, zmin: lo, zmax: hi, zAn: function (pt) { var t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); return a[2] + (b[2] - a[2]) * t; } };
    }
    // Rückgabe: 0 = innerhalb 0,5 %, 1 = Info, 2 = über 3 %
    var bewerte = function (id, was, soll, ist, einheit) {
      if (soll == null || !isFinite(ist)) return 0; einheit = einheit || "mm";
      var d = ist - soll, rel = Math.abs(d) / Math.max(Math.abs(soll), 1), abs = Math.abs(d);
      var txt = was + ": Messung " + (Math.round(soll * 10) / 10) + " " + einheit + ", Modell " + (Math.round(ist * 10) / 10) + " " + einheit + " (" + (d > 0 ? "+" : "") + (Math.round(rel * 1000) / 10) + " %)";
      if (abs <= TOL_MIN || rel <= TOL_INFO) return 0;
      if (rel <= TOL) { add(id, was, "info", txt + (hatKonflikt(id) ? " – als Konflikt gemeldet" : "")); return 1; }
      add(id, was, "warn", txt + (hatKonflikt(id) ? " – über 10 %, als Konflikt gemeldet" : " – über 10 %, ohne Konflikt-Eintrag")); return 2;
    };
    // 1. Abdeckung: Hauptteile (fehlend = Fehler)
    var cnt = { gebaut: 0, nicht_gebaut: 0, fehlt: 0 };
    // Hauptkörper: massing-Körper mit role "main", sonst alle Wände/Dächer ohne parent_attachment_id
    var haupt = {}, mainBody = (MESS.massing.bodies || []).filter(function (b) { return b && b.role === "main"; })[0];
    if (mainBody) [].concat(mainBody.wall_ids || [], mainBody.roof_face_ids || []).forEach(function (i) { haupt[i] = 1; });
    else { Object.keys(MESS.walls).forEach(function (i) { if (!MESS.walls[i].parent_attachment_id) haupt[i] = 1; }); Object.keys(MESS.roofs).forEach(function (i) { if (!MESS.roofs[i].parent_attachment_id) haupt[i] = 1; }); }
    ["walls", "roofs", "trim", "openings", "attachments"].forEach(function (g) {
      Object.keys(MESS[g]).forEach(function (id) {
        if (gebaut[id]) cnt.gebaut++;
        else if (ng[id] != null) { cnt.nicht_gebaut++; add(id, "Abdeckung", "info", "nicht gebaut: " + ng[id]); }
        else { cnt.fehlt++; add(id, "Abdeckung", haupt[id] ? "fail" : "warn", "fehlt im Modell und steht nicht in nichtGebaut" + (haupt[id] ? " (Hauptkörper)" : "")); }
      });
    });
    R.nicht_gebaut.forEach(function (n) { if (!gruppe(n.id)) add(n.id, "Abdeckung", "warn", "nichtGebaut mit unbekannter ID – bitte genau eine ID je Eintrag"); });
    function gruppe(id) { for (var g in { walls: 1, roofs: 1, trim: 1, openings: 1, attachments: 1, edges: 1, downspouts: 1, condition_areas: 1 }) if (MESS[g] && MESS[g][id]) return g; return null; }
    // 2. Wände
    var wOk = 0, wN = 0;
    Object.keys(MESS.walls).forEach(function (id) { var w = MESS.walls[id]; if (!gebaut[id]) return; wN++; var e = ext(gebaut[id]);
      var b1 = bewerte(id, "Wandbreite", w.width_mm, e.breite);
      var soll = w.height_mm == null ? null : w.height_mm + (w.gable_height_mm || 0), ist = e.hoehe;
      var fb = fussLinie(gebaut[id]);
      if (soll != null && fb.schraeg) { // Hang: Höhe ab örtlichem Gelände – am höchsten Fuß, in der Mitte oder am tiefsten Fuß
        var cand = [e.hoehe, e.hoehe - (fb.zmax - fb.zmin) / 2, e.hoehe - (fb.zmax - fb.zmin)];
        var best = cand.reduce(function (a, c) { return Math.abs(c - soll) < Math.abs(a - soll) ? c : a; });
        if (best !== e.hoehe && Math.abs(best - soll) <= Math.max(TOL_MIN, soll * TOL)) add(id, "Wandhöhe am Hang", "info", "Wandfuß fällt um " + Math.round(fb.zmax - fb.zmin) + " mm; gemessene Höhe passt zum örtlichen Gelände");
        ist = best; }
      var b2 = bewerte(id, "Wandhöhe inkl. Giebel", soll, ist);
      if (b1 < 2 && b2 < 2) wOk++; });
    // 3. Öffnungen
    var oOk = 0, oN = 0;
    R.oeffnungen.forEach(function (o) { var m = MESS.openings[o.id_1_7]; if (!m) return; oN++; var e = ext([o.ecken]);
      var gz = (MESS.building.per_elevation[m.elevation] || {}).grade_offset_mm || 0, s = m.type === "skylight";
      var b1 = s ? 0 : bewerte(o.id_1_7, "Öffnungsbreite", m.width_mm, e.breite);
      var b2 = s ? 0 : bewerte(o.id_1_7, "Öffnungshöhe", m.height_mm, e.hoehe);
      var b3 = 0; if (!s && m.y_mm != null) {
        var mitte = o.ecken.reduce(function (a, p) { return [a[0] + p[0] / o.ecken.length, a[1] + p[1] / o.ecken.length]; }, [0, 0]);
        var fl = gebaut[m.parent] ? fussLinie(gebaut[m.parent]) : null, lok = fl ? fl.zAn(mitte) : null;
        var kand = [m.y_mm + gz]; if (lok != null) kand.push(m.y_mm + lok);
        var tol3 = function (v) { return Math.max(30, Math.abs(v) * TOL); }; // 10 %
        var treffer = kand.filter(function (v) { return Math.abs(e.zmin - v) <= tol3(v); });
        if (!treffer.length) { add(o.id_1_7, "Unterkante", "warn", "Unterkante: Messung " + Math.round(m.y_mm) + " mm über Gelände (" + (lok != null ? "örtlich → " + Math.round(m.y_mm + lok) + " mm, " : "") + "Seite → " + Math.round(m.y_mm + gz) + " mm), Modell " + Math.round(e.zmin) + " mm"); b3 = 2; }
        else if (lok != null && Math.abs(lok - gz) > 50 && Math.abs(e.zmin - (m.y_mm + gz)) > tol3(m.y_mm + gz)) add(o.id_1_7, "Unterkante am Hang", "info", "Lage über dem örtlichen Gelände (" + Math.round(lok) + " mm) statt über dem Seitenmittel (" + gz + " mm)");
      }
      if (b1 < 2 && b2 < 2 && b3 < 2) oOk++; });
    // 4. Dachneigung (größte Teilfläche je ID) und Fläche (nur Info)
    var rOk = 0, rN = 0, aMod = 0, aMess = 0;
    Object.keys(MESS.roofs).forEach(function (id) { var r = MESS.roofs[id]; if (!gebaut[id]) return; rN++;
      var best = null, A = 0;
      gebaut[id].forEach(function (p) { var n = newell(p), a = len(n) / 2; A += a; if (!best || a > best.a) best = { a: a, n: n }; });
      aMod += A; if (r.area_mm2) aMess += r.area_mm2;
      var pitch = Math.acos(Math.abs(best.n[2]) / len(best.n)) * 180 / Math.PI;
      if (r.pitch_deg != null && Math.abs(pitch - r.pitch_deg) > TOL_GRAD) { var gross = Math.abs(pitch - r.pitch_deg) > Math.max(TOL_GRAD, r.pitch_deg * TOL);
        add(id, "Dachneigung", gross ? "warn" : "info", "Neigung: Messung " + r.pitch_deg + "°, Modell " + pitch.toFixed(1) + "°" + (hatKonflikt(id) ? " – als Konflikt gemeldet" : (gross ? " – über 10 %, ohne Konflikt-Eintrag" : ""))); }
      else rOk++;
      if (r.area_mm2 && Math.abs(A / r.area_mm2 - 1) > 0.2) add(id, "Dachfläche (nur Info)", "info", "Modellfläche weicht " + Math.round((A / r.area_mm2 - 1) * 100) + " % von der Messung ab – das Panel zeigt den Messwert");
    });
    // 5. Kanten: vorhanden, Länge, liegen am Modell
    var alleEcken = []; R.flaechen.forEach(function (f) { alleEcken.push.apply(alleEcken, f.ecken); }); R.anbauten.forEach(function (a) { a.flaechen.forEach(function (p) { alleEcken.push.apply(alleEcken, p); }); });
    var amModell = function (p) { for (var i = 0; i < alleEcken.length; i++) if (D3(p, alleEcken[i]) <= 50) return true; return false; };
    var kOk = 0, kN = Object.keys(MESS.edges).length, kGeb = 0;
    Object.keys(MESS.edges).forEach(function (id) { var m = MESS.edges[id], k = kant[id];
      if (!k) { if (ng[id] == null) add(id, "Kante", "warn", "Kante fehlt (" + (m.edge_class || "") + ", " + Math.round(m.length_mm || 0) + " mm) und steht nicht in nichtGebaut"); return; }
      kGeb++; var lk = D3(k.von, k.bis), b = 0;
      if (m.length_mm) { var rel = Math.abs(lk - m.length_mm) / m.length_mm;
        if (rel > TOL && Math.abs(lk - m.length_mm) > TOL_MIN) { b = 2; add(id, "Kantenlänge", "warn", (m.edge_class || "Kante") + ": Messung " + Math.round(m.length_mm) + " mm, Modell " + Math.round(lk) + " mm (" + (lk > m.length_mm ? "+" : "−") + (Math.round(rel * 1000) / 10) + " %)" + (hatKonflikt(id) ? " – als Konflikt gemeldet" : " – Panel zeigt den Messwert")); }
        else if (rel > TOL_INFO && Math.abs(lk - m.length_mm) > TOL_MIN) { b = 1; add(id, "Kantenlänge", "info", (m.edge_class || "Kante") + ": " + Math.round(lk) + " statt " + Math.round(m.length_mm) + " mm, innerhalb 3 %"); } }
      var lose = !amModell(k.von) || !amModell(k.bis);
      if (lose) add(id, "Kante", "warn", "Anfang oder Ende liegt an keiner Modellecke (falsch zugeordnet?)");
      if (b < 2 && !lose) kOk++; });
    // 6. Fallrohre
    var dGeb = 0, dN = Object.keys(MESS.downspouts).length;
    Object.keys(MESS.downspouts).forEach(function (id) { var m = MESS.downspouts[id], d = rohr[id];
      if (!d) { if (ng[id] == null) add(id, "Fallrohr", "warn", "Fallrohr fehlt und steht nicht in nichtGebaut"); return; }
      dGeb++; bewerte(id, "Fallrohrlänge", m.length_mm, D3(d.oben, d.unten)); });
    // 7. Schadensflächen: vorhanden, Größe, liegen auf ihrer Fläche
    var sGeb = 0, sN = Object.keys(MESS.condition_areas).length;
    Object.keys(MESS.condition_areas).forEach(function (id) { var m = MESS.condition_areas[id], c = R.schaeden.filter(function (x) { return x.id_1_7 === id; })[0];
      if (!c) { if (ng[id] == null) add(id, "Schadensfläche", "warn", "Schadensfläche fehlt und steht nicht in nichtGebaut"); return; }
      sGeb++; var A = area(c.ecken);
      if (m.area_mm2 && Math.abs(A / m.area_mm2 - 1) > 0.1) add(id, "Schadensfläche", "info", "Fleck " + (Math.round(A / 1e4) / 100) + " m², gemessen " + (Math.round(m.area_mm2 / 1e4) / 100) + " m²");
      var traeger = gebaut[m.parent];
      if (traeger && traeger.length) { var p0 = traeger[0], n = newell(p0), L = len(n); n = [n[0] / L, n[1] / L, n[2] / L];
        var d0 = n[0] * p0[0][0] + n[1] * p0[0][1] + n[2] * p0[0][2], maxd = 0;
        c.ecken.forEach(function (p) { maxd = Math.max(maxd, Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d0)); });
        if (maxd > 100) add(id, "Schadensfläche", "warn", "liegt bis " + Math.round(maxd) + " mm neben ihrer Fläche " + m.parent); } });
    // 8. Unter dem Gelände
    var zMin = Infinity; R.flaechen.forEach(function (f) { f.ecken.forEach(function (p) { zMin = Math.min(zMin, p[2]); }); });
    if (zMin < -50 && !Object.keys(MESS.building.per_elevation).some(function (e) { return (MESS.building.per_elevation[e].grade_offset_mm || 0) < -50; }))
      add("–", "Gelände", "warn", "Teile liegen bis " + Math.round(-zMin) + " mm unter z = 0");
    // 9. Fehler aus dem Bau
    R.fehler.forEach(function (f) { add("–", "Bau", "warn", f); });
    if (!R.flaechen.length) add("–", "Bau", "fail", "Es wurde keine Wand- oder Dachfläche gebaut");
    // Hauptmaße: Wände des Hauptkörpers und First über 25 % daneben = Stopp
    Object.keys(haupt).forEach(function (id) { var w = MESS.walls[id]; if (!w || !gebaut[id]) return; var e = ext(gebaut[id]);
      var fb = fussLinie(gebaut[id]), h = e.hoehe - (fb.schraeg ? (fb.zmax - fb.zmin) / 2 : 0), soll = w.height_mm == null ? null : w.height_mm + (w.gable_height_mm || 0);
      if (w.width_mm && Math.abs(e.breite / w.width_mm - 1) > TOL_STOPP) add(id, "Hauptmaß", "fail", "Hauptkörper-Wand: Breite " + Math.round(e.breite) + " statt " + w.width_mm + " mm (über 25 %)");
      if (soll && Math.abs(h / soll - 1) > TOL_STOPP) add(id, "Hauptmaß", "fail", "Hauptkörper-Wand: Höhe " + Math.round(h) + " statt " + soll + " mm (über 25 %)"); });
    var first = MESS.building.ridge_height_mm, zFirst = -Infinity;
    Object.keys(haupt).forEach(function (id) { if (MESS.roofs[id] && gebaut[id]) gebaut[id].forEach(function (p) { p.forEach(function (q) { zFirst = Math.max(zFirst, q[2]); }); }); });
    if (first && isFinite(zFirst) && Math.abs(zFirst / first - 1) > TOL_STOPP) add("–", "Hauptmaß", "fail", "First im Modell " + Math.round(zFirst) + " statt " + first + " mm (über 25 %)");
    R.hinweise.forEach(function (f) { add("–", "Bau", "warn", f); });
    var fails = Z.filter(function (z) { return z.status === "fail"; }).length, warns = Z.filter(function (z) { return z.status === "warn"; }).length;
    return {
      zeilen: Z, go: fails === 0, stufe: fails ? "stopp" : (warns ? "merken" : "ok"), toleranz: "Info bis 10 %, merken über 10 %, Stopp bei Hauptmaßen über 25 %",
      zahlen: { ids_gebaut: cnt.gebaut, ids_nicht_gebaut: cnt.nicht_gebaut, ids_fehlen: cnt.fehlt, waende_ok: wOk + "/" + wN, oeffnungen_ok: oOk + "/" + oN,
        neigung_ok: rOk + "/" + rN, kanten: kGeb + "/" + kN + " gebaut, " + kOk + " passend", fallrohre: dGeb + "/" + dN, schaeden: sGeb + "/" + sN,
        dachflaeche_modell_zu_messung: aMess ? Math.round((aMod / aMess - 1) * 1000) / 10 + " %" : "–",
        ergaenzt: R.ergaenzt.length, konflikte: R.konflikte.length, fehler: fails, warnungen: warns, laufzeit_ms: R.laufzeit_ms }
    };
  }

  return { VERSION: VERSION, unwrap: unwrap, measurementToMess: measurementToMess, geo: geo, makeApi: makeApi, runBuild: runBuild, pruefen: pruefen, newell: newell };
}
if (typeof module !== "undefined") module.exports = SNAPTAPE_CORE();
