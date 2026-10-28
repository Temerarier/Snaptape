SNAPTAPE – STEP 2: WRITE THE HOUSE-BUILDING FUNCTION (VARIANTE A, PROMPT A-2026-10-12)

The measurement of this house (schema 1.8, called MEASUREMENT below) is given in the user message after the line "MEASUREMENT:". It has already been checked by our code. The photos and drawings of the house are attached to the user message, each with its marker. Now write ONE JavaScript function that builds the 3D geometry of this house. Work autonomously, no questions. All lengths in mm, angles in degrees.

HOW YOUR FUNCTION IS USED: our code converts MEASUREMENT into an object MESS, calls buildHouse(MESS, api) once, collects every face, line and patch you pass to api, checks them against MEASUREMENT and draws them in our fixed viewer. The viewer does everything else itself: camera, controls, selection, info box, colours, window frames and glazing bars, dimension lines, panel and export. You write NO HTML, NO three.js, NO DOM access, NO network access, NO random numbers - only plain JavaScript that computes coordinates and calls api.

GOAL: the model looks like the house on the photos AND every measured dimension in the model equals the measurement. The numbers come from MESS, the shape and arrangement come from you (using the photos and drawings).

RULE 1 - ALL NUMBERS FROM MESS (do NOT copy the measurement)
MESS is filled by our code from MEASUREMENT. Do not write a copy of it. Its structure (missing values are null):
- MESS.walls["WL-n"] = {elevation, material, width_mm, height_mm, gable_height_mm, start_mm, area_mm2, net_area_mm2, parent_attachment_id, color, secondary_hex}
- MESS.roofs["RF-n"] = {elevation, material, pitch_deg, area_mm2, orientation_deg, parent_attachment_id, color}
- MESS.trim["SF-n"/"FC-n"/...] = {face_class, elevation, material, soffit_depth_mm, area_mm2, parent_attachment_id, color}   (every face that is not wall or roof)
- MESS.openings["W-n"/"D-n"/"G-n"/"SK-n"] = {type, parent, elevation, width_mm, height_mm, sill_mm, x_mm, y_mm, area_mm2, head, divisions, group_id}   (parent = parent_face_id, x_mm/y_mm = position_mm.x/.y)
- MESS.attachments["AT-n"] = {type, subtype, parent, elevation, width_mm, height_mm, depth_mm, x_mm, y_mm, attached, dormer}
- MESS.edges["E-n"] = {edge_class, length_mm, elevation, parent_attachment_id}   (elevation = belongs_to_elevation)
- MESS.downspouts["DS-n"] = {elevation, length_mm, x_mm, connects_edge_id}
- MESS.condition_areas["CA-n"] = {type, parent, elevation, area_mm2, severity, x_mm, y_mm, photo_index, note}   (parent = parent_face_id)
- MESS.building = {building_type, stories, roof_type, footprint: {points, width_mm, depth_mm, area_mm2, perimeter_mm}, eave_height_mm, ridge_height_mm, datum_note, per_elevation: {front|back|left|right: {eave_height_mm, ridge_height_mm, grade_offset_mm}}}
- MESS.massing = {bodies: [...]} exactly as in MEASUREMENT (id, role, attachment_id, wall_ids, roof_face_ids, footprint_mm, attach, roof, dormer_front_height_mm, grade_mm, missing)
- MESS.notes = meta.notes
Every dimension in your code is read from MESS (e.g. MESS.walls["WL-1"].width_mm) or computed from MESS values. Literal numbers are allowed only for 0, 1, 2, 90/180 (angle math), loop counts and tolerances.
- A value the model needs that MESS does not contain (e.g. a porch post size, the order of walls along a side, the rotation of a wing, the size of a body that the measurement missed) is created with api.ergaenzt(name, value, grund, quelle), which returns the value: const post = api.ergaenzt("porch_post_mm", 200, "Querschnitt der Verandastützen", "Foto 3"). grund and quelle in German. Never type such a number directly into the geometry.
- If MESS values do not fit together geometrically, keep the measured value where the geometry allows; where it does not, use the needed value via api.ergaenzt and call api.konflikt(id, text) naming both values. Never change a measured value silently.
- Wall height: height_mm is the height of the wall face from its bottom edge to the eave line. If a value clearly means something else (e.g. a dormer wall whose height_mm equals its height above grade), build the face height that is geometrically right (area_mm2 / width_mm is a good check) and call api.konflikt with both values.

RULE 2 - EVERY PART CARRIES ITS MEASUREMENT ID
- Every id in MESS.walls, roofs, trim, openings, attachments, edges, downspouts and condition_areas is either built with its own api call (see RULE 5) or reported with api.nichtGebaut(id, grund).
- One id per call. Never ranges or lists like "SF-1 ... SF-4" or "E-3, E-4".
- An attachment that you build entirely from its WL/RF faces (e.g. a dormer or bay whose walls and roof are WL-n/RF-n) is reported as api.nichtGebaut("AT-n", "gebaut als WL-5, WL-21, RF-10") - always with the ids it was built from.
- api.deko(...) is only for purely visual parts that belong to no measured element (e.g. a plinth band in the secondary colour). Deko is not clickable and never counts. Never use a measurement id for a filler body or a helper part.

RULE 3 - SAME GEOMETRY RULES AS THE MEASUREMENT
REFERENCE FRAME (binding for every number):
- Sides: front = street-facing side (elevation "front"), back, left and right as seen FROM the street - also for anything on the back side.
- Origin (0, 0, 0): front-left outer wall corner of the main body MB-1, at grade. x to the right along the front, y to the back (away from the street), z up. Other parts may have negative coordinates.
- position (x_mm, y_mm) is the lower-left corner of an item, measured from the lower-left corner of its ELEVATION seen from outside (the outermost bottom corner of all walls on that elevation, main building and attachments together). Seen from outside that corner is: front - the smallest x; back - the largest x; left - the largest y; right - the smallest y. Subtract the distance from that corner to the start of the wall you place the item on.
- Height of wall openings and damage patches on walls (y_mm, sill_mm) is measured above the ground directly below the item (local grade). On a sloping site take it from massing grade_mm of the body or from heights.per_elevation, interpolated along the wall.
- Roof objects (dormer, chimney, pipe, vent) and patches on roof faces: x_mm runs along the eave from its left end seen from outside (the eave is the roof edge including the overhang), y_mm runs from the eave up the slope. Horizontal distance from the wall = y x cos(pitch) - overhang; height above the eave edge = y x sin(pitch).
- Heights: grade zero as in building.datum_note; ground offsets from building.per_elevation[...].grade_offset_mm and massing grade_mm. z = 0 stays the ground at the origin corner.

RULE 4 - PHOTOS DECIDE SHAPE AND EXISTENCE, MESS DECIDES SIZE
- BEFORE you write code, compare the bodies in MESS.massing with the photos and drawings, side by side and body by body: Is every visible body, wing, garage, porch, bay and dormer in MESS? Does each body have the shape the photos show (depth, roof form at each end, where it sits)?
- Read every text in MESS.massing.missing and in each body's missing (e.g. "back end: hip, not gable", "rotated approx. 20 deg clockwise against MB-1") and build accordingly; values you need for it go through api.ergaenzt.
- If the photos or drawings clearly show a body that MESS misses or describes wrongly (e.g. a garage that is missing, a wing that is shown as full depth but is only a short bay), build it as the photos show. Take every size you can from MESS (walls, heights, pitches, other bodies) and drawings; create the rest with api.ergaenzt (quelle = photo or drawing). Report it with api.konflikt naming what MESS says and what you built. Do not invent anything that is not visible.
- Use the photos and drawings for everything the numbers do not fix: how the bodies sit, roof forms and how roofs meet (valleys, hips, mixed ends), porch roofs and posts, dormers, chimneys, rotated wings.
- Photos win on existence, count and shape; MESS wins on dimensions. If a photo contradicts a measured number, keep the number and call api.konflikt.
- Compute shared points once and reuse the same variable in every face, edge and patch that uses them (ridge, hip and valley points, eave corners). Never type a computed coordinate as a number.
- Build roofs as real intersecting planes: no gaps, no faces through walls, every wall top meets its roof. Nothing floats, nothing sinks below the ground.
- Never throw. If something cannot be placed, call api.konflikt and api.nichtGebaut for it and continue with the rest of the house.

RULE 5 - THE BUILDING BLOCKS (api)
A face is an array of corners [[x,y,z], ...] in world coordinates: one closed planar loop, at least 3 corners, first corner not repeated, no holes (split a face instead). A point is [x,y,z].
- api.wall(id, corners)            wall face WL-n. A gable wall has 5 corners. Several calls with the same id are allowed (wall split by another body).
- api.roof(id, corners)            roof face RF-n, ending at the overhang edge. Several calls with the same id are allowed.
- api.trim(id, corners)            soffit/fascia/other face from MESS.trim.
- api.opening(id, corners)         outline of an opening (W/D/G/SK) lying IN the plane of its wall (or roof for skylights), not offset in front of it. Rectangle = 4 corners; an arched head (head.shape) = rectangle plus the arc as 8-16 points. The viewer adds frame, glass and glazing bars (divisions) itself.
- api.part(id, art, faces, colour?) parts of an attachment AT-n (porch deck, posts, steps, chimney, awning, bay box), faces = array of faces. art in German (veranda, vordach, schornstein, erker, gaube, balkon, ...). colour optional "#RRGGBB".
- api.edge(id, from, to)           the measured edge E-n as a straight line between two model points. Use the same point variables as the faces it belongs to: ridge, hip, valley along the roof lines; eave and rake along the outer roof edge including the overhang; outside_corner and inside_corner vertical at the wall corner from grade to the eave; flashing and step_flashing along the wall-roof junction; base, head, sill and jamb along the wall or opening edge. Pick the model edge whose class, side (elevation, parent_attachment_id) and length match MESS.edges best. If no model edge matches, api.nichtGebaut(id, grund). If the matching model edge is more than 3 % longer or shorter than length_mm, keep it and call api.konflikt(id, reason).
- api.downspout(id, top, bottom)   downspout DS-n as a vertical line on its elevation at x_mm (rule 3 position), from the eave/gutter of connects_edge_id down to grade. If the geometry gives a length that differs from length_mm by more than 3 %, call api.konflikt.
- api.condition(id, corners)       damage patch CA-n lying ON its parent face (parent), lower-left corner at x_mm/y_mm (wall: like an opening; roof face: like a roof object). Default shape: a square with side = sqrt(area_mm2); if the photo (photo_index) clearly shows another shape, set its width with api.ergaenzt and keep the area. The patch must stay inside its face; clip it if needed and say so in api.konflikt.
- api.deko(art, faces, colour?)    purely visual, see RULE 2.
- api.ergaenzt(name, value, grund, quelle) -> value;  api.konflikt(id, text);  api.nichtGebaut(id, grund)
Toolbox api.geo (use it, or write your own math):
- geo.ebene(point, pitchDeg, upDir)  plane z = a*x + b*y + c through point [x,y,z], rising with pitchDeg in horizontal direction upDir [dx,dy]
- geo.ebeneAus3(p, q, r)             plane through three points
- geo.z(E, x, y)                     height of plane E at x, y
- geo.heben(E, points2D)             lift [[x,y],...] onto plane E -> [[x,y,z],...]
- geo.schnitt(E1, E2, {x:..} or {y:..})  point on the intersection line of two planes at a given x or y
- geo.punkt3(E1, E2, E3)             point where three planes meet
- geo.prisma(base2D, z0, z1)         vertical prism over a 2D outline -> array of faces
- geo.quader(x0, x1, y0, y1, z0, z1) box -> array of faces
- geo.system(origin2D, angleDeg)     rotated local system in plan: returns (a, b, z) -> [x, y, z]
- geo.wand(p0, p1, outwardDir)       local system on a vertical face from p0 to p1: returns (s, z, f) -> [x, y, z], s along the face, z up, f outward
- geo.rad(deg)

ANSWER FORMAT
- ONE fenced code block ```js containing function buildHouse(MESS, api) { ... } (helper functions inside it or above it in the same block). No other code blocks, no copy of MESS, no HTML.
- Keep the code compact; short comments only where they help. If the answer would be too long, shorten comments, never the model.
- Under the code at most three short lines in German: what you simplified, what you corrected against MESS (RULE 4) and what you were unsure about.

BEFORE YOU ANSWER, CHECK (do not output the check):
1. You compared every body in MESS.massing with the photos; missing or wrong bodies are built from the photos and reported with api.konflikt.
2. No dimension is typed in directly; everything comes from MESS or api.ergaenzt.
3. Every id in MESS.walls, roofs, trim, openings, attachments, edges, downspouts and condition_areas has its own api call or api.nichtGebaut - one id per call.
4. Shared ridge, hip and valley points are computed once and reused by faces and edges.
5. Roofs are closed, walls meet roofs, nothing floats, every patch lies on its face.
6. The function cannot throw and uses no THREE, document, window, fetch or Math.random.
