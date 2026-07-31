COMPLETENESS CONTRACT: your JSON must enumerate EVERY individually visible face, edge, opening, attachment and downspout across ALL photos - a partial, sampled or summarized list is a WRONG answer. Count the openings you can see across all photos FIRST (during your reasoning), then emit exactly that many entries. Raw estimates must come from genuinely independent chains - never duplicate the same value twice. Take the time you need; do not stop early.

Analyze the attached construction drawings fully autonomously, no follow-up questions. All measurements in mm, unrounded.

0. COUNTRY PROFILE: determine the project country from the drawing conventions (unit system, DIN vs ANSI title block, dimension style) and state it in meta.notes. meta.country is a calculation profile: set "US" for imperial-convention plans, otherwise "DE". If the true country is neither, note it in meta.notes and add a quality.warnings entry.

1. CLASSIFY (per page): floor_plan / elevation / section / site_plan / detail. Identify the stated scale (title block or scale bar) and the unit system. State both per page in meta.notes.
2. WRITTEN DIMENSIONS FIRST: dimension chains and labeled heights are the primary source. A legible written dimension is NEVER overridden by anything scaled or estimated. Per value: source "measured", confidence high, reference_used "plan dimension, page X".
3. SCALE FALLBACK: for values without a written dimension, derive them via the stated scale. All scale-derived values get confidence low at most, with low_reason "derived via stated scale, not independently verified". If a page has neither usable dimensions nor a stated scale: null plus reason.
4. CHAINS AND CROSS-CHECK: transcribe EVERY dimension chain into quality.dimension_chains as page, label, values_mm array, stated_total_mm. Do not verify the sums yourself - that runs downstream in code. Cross-check floor plan widths vs elevations; contradictions -> quality.warnings, use the more plausible value, justify.
5. FULL MEASUREMENT. Map drawing labels to functional elevations: front = street-facing (use site plan or entrance position); if not determinable, keep the sheet labels and document the mapping in meta.notes.

FULL DELIVERABLE - a complete run covers ALL of these; a category that is genuinely not assessable from the inputs gets nulls plus one quality.warnings entry, never a silent omission:
- Building: building_type, stories, roof_type, shared_walls (duplex/townhouse).
- Footprint: width_mm, depth_mm, perimeter_mm, area_mm2 (and the points polygon where derivable).
- Heights: eave_height_mm, ridge_height_mm; parapet_height_mm only for parapet/flat roofs. On sloped sites or where eave/ridge differ per side, ALSO fill heights.per_elevation (eave/ridge/grade_offset per elevation) and heights.datum_note stating where grade zero was taken.
- Faces: every roof facet (RF-n) with sloped area_mm2 and pitch (degrees_original + degrees_rounded; rise_over_12_snapped only for US calc profile); every wall (WL-n) per elevation with gross area_mm2 and net_area_mm2; soffit (SF-n) and fascia (FC-n) with soffit_depth_mm where assessable; material where visible.
- Edges: every roofline and outline edge (E-n) with edge_class, length_mm and belongs_to_elevation. Report ridge, hip, valley, eave and rake edges individually - their per-class totals are the deliverable a roofer buys.
- Openings: every window, door, patio_door, garage_door and skylight (W/D/G/SK-n) with width_mm, height_mm, sill_height_mm, position_mm, area_mm2, perimeter_mm.
- Attachments: every dormer, bay, balcony, awning, addition and chimney with width/height/depth where assessable, PLUS placement so it can be modeled: position_mm (lower-left corner on the parent elevation, like openings; for roof objects x along the eave from its left end, y from the eave upward along the slope), parent_face_id (the WL-n/RF-n it sits on), attached (false for free-standing garages/outbuildings - never merge those into the house), include_in_footprint, and for dormers dormer.style plus dormer.face_pitch_deg.
Edge lengths, roof areas and heights are cross-checked downstream against footprint + pitch geometry. Keep them mutually consistent (e.g. a gable ridge equals the footprint side it runs along) instead of estimating each number in isolation.

MEASUREMENT DEFINITIONS (use exactly these):
- Eave height: ground line to the underside of the eave/soffit where it meets the wall, excluding the gutter.
- Ridge height: ground line to the topmost point of the roof covering at the ridge.
- Total width / depth: outer face of finished wall to outer face of finished wall, excluding roof overhangs.
- Footprint scope (building.footprint): the MAIN building body only - the principal volume, EXCLUDING attached annexes, garages, porches and bays; report those as attachments. ALSO fill building.footprint_overall with the envelope width/depth INCLUDING attached secondary volumes (excluding detached structures). Always fill both; they are equal when nothing is attached. Never silently mix the two scopes.
- Window size: visible outer frame dimensions as seen on the facade (not rough opening, not glass).
- Door size: visible outer frame dimensions including the frame, excluding decorative surrounds.
- Opening position: x/y of the lower-left corner of the opening, measured from the lower-left corner of its elevation as seen standing outside facing that elevation; x increases to the right in that view.
- Face area: area_mm2 is gross including openings; net_area_mm2 is gross minus all openings.
- Roof face area: the SLOPED (true) surface area, never the horizontal plan projection.
- Edge classes: ridge = horizontal top edge; hip = sloped external junction of two roof faces; valley = sloped internal junction; eave = horizontal lower roof edge; rake = sloped gable-end roof edge; outside_corner / inside_corner = vertical wall corners; head / sill / jamb = top / bottom / side edge of an opening (report only when individually relevant). Use "unclassified" instead of guessing.
- Soffit: the horizontal underside of the roof overhang; soffit_depth_mm = horizontal distance from wall face to fascia.
- Fascia: the vertical board capping the eave end of the overhang; its face area = fascia run length x fascia height.
- Footprint perimeter: total outline length including every jog and bay; footprint area is enclosed by the same outline.

VERTICAL ANCHOR RULE: eave/ridge/sill heights must be scaled from at least one VERTICAL reference chain (door height, storey height, vertically counted brick courses) - never purely from horizontal references. Produce raw estimates for eave_height from at least TWO different vertical chains when available. If the ground line is occluded (fence, vehicles, vegetation), state the assumed ground offset in low_reason, add one quality.warnings entry, and cap confidence at medium. Photos looking steeply upward compress verticals: cap height confidence at low and prefer chains from the most level photo available.

DEPTH BASIS RULE: if the TRIAGE FACTS (or the stage 1 result) report depth_basis "oblique_only", cap footprint depth confidence at low and add one quality.warnings entry naming the missing frontal side view.

OCCLUSION RULE: for any elevation whose photos are more than 30% occluded (see per-file occluded_percent in the TRIAGE FACTS), add one summary warning "openings likely undercounted on <elevation>" instead of silently omitting hidden openings.

PLAN SCALE RULES (these OVERRIDE the per-photo scale rule for plan/drawing sheets):
(a) SCALE TRANSFER: all sheets of one plan set share ONE drawing scale unless a sheet states otherwise. Derive the scale factor from any legible dimension chain (stated value / drawn length) and apply it to every undimensioned sheet of the same set and paper format; use ONE consistent scale for x and y per sheet. Mark such values source=scaled with reference 'plan scale from sheet N'.
(b) CROSS-SHEET CONSISTENCY: the same building edges appear on multiple elevations (eave line, ridge height, gable width): cross-check them across sheets; on >10% deviation add a quality.warnings entry and prefer the chain-derived value.
(c) NO-CHAIN FALLBACK: if NO dimension chain exists anywhere in the set and no scale is stated, derive the scale from DRAWN standard objects exactly like the photo reference table (entry door height, storey heights, brick coursing where drawn), reliability statistical, plus one quality.warnings entry naming the fallback. Only if no such object is drawn either, set the affected dimensions to null with low_reason 'no scale available'. NEVER assume a nominal scale (e.g. 1:100) without evidence on the sheet.
(d) ROTATED SCANS: sheets may be scanned rotated by 90 degrees - detect the reading orientation from the title text, interpret the drawing accordingly, and state the rotation in meta.notes.
(e) IMPERIAL SHEETS: on imperial drawings, dimension chains read as feet-and-inches - e.g. 25'-6 1/2" = 25 ft + 6.5 in = 7782 mm; NEVER read 12'-6" as 12.6 ft. Convert every value to mm before use. Architect's scale notes like 1/4" = 1'-0" (1:48) or 1/8" = 1'-0" (1:96) count as stated scales. Imperial dimension_chains example: {"page":1,"label":"front elevation 25'-6\" + 12'-0\"","values_mm":[7772,3658],"stated_total_mm":11430,"computed_sum_mm":11430,"deviation_percent":0}.

CHAIN-TO-FIELD RECONCILIATION (MANDATORY): every transcribed dimension chain must name the schema field it supports in its label (e.g. 'assigned_to: footprint.width_mm'). footprint.width_mm and footprint.depth_mm MUST equal the corresponding full-facade chain totals when such chains exist; if you deviate, add a quality.warnings entry explaining why. NEVER write a chain total only into footprint_overall while footprint carries a different, unexplained value.

AXIS RULE: a gable-end elevation (Giebelansicht) dimensions the building's SHORT side - normally the DEPTH when the street/garden elevations show the long side; check which axis a chain spans BEFORE assigning it. A partial chain that does not span the full facade (no stated total across the whole width) must NEVER be used as a building dimension.

SHEET SET RULE: all provided files are pages of ONE plan set unless they clearly show different projects. A sheet that duplicates another (e.g. the same elevation with a measuring-grid overlay) is a COPY - never count it as an additional elevation or a second gable.

USER REFERENCE RULE: a user-provided reference measurement overrides all photo-side assumptions (reference object sizes). It does NOT override a legible written plan dimension; if they disagree by 3% or more, keep the plan value and add a quality.warnings entry describing the disagreement. If a USER REFERENCE is provided, it is the PRIMARY scale: the reference object is described in free text - locate it yourself in the photo(s) where it is visible, anchor every chain in those photos on it, and transfer it to other photos via shared elements where possible (via_transfer=true). Table assumptions (door heights etc.) then serve only as cross-checks: report the door height IMPLIED by the user reference; if it deviates >5% from the table assumption, add a quality.warnings entry naming both values. Chains anchored on the USER REFERENCE must set reference_object to 'user_provided: <object>'.

ROOF COVERING RULE (v1.5): set roof-face material (shingle_asphalt / shingle_wood / metal / tile / slate / membrane) ONLY when the drawing states it (material legend, annotation, hatching key). Otherwise "unknown". Wall faces take wall substrates only (metal is valid for both classes).

FACE COLOR RULE (v1.4, plans): fill color ONLY when the drawing explicitly provides it - a colored elevation rendering, a color/material legend, or a written color annotation. Confidence for drawing-derived colors is capped at medium (renderings are stylized, print/scan shifts hues); state the source in color.note (e.g. "from colored elevation sheet 3"). If the drawing carries no color information, set color to null, without warnings.

CONDITION RULE (v1.4, plans): condition_areas cannot be read from drawings - always an empty array, without warnings. Downspouts: report drops (DS-n with elevation, length_mm, position_mm.x, connects_edge_id) only where the elevation drawings actually show them; otherwise leave the array empty.

PENETRATION RULE (v1.4): pipes and vents drawn on roof plans or elevations are attachments with type "pipe" / "vent" and position_mm on their parent face. Count what the drawings show; do not invent typical penetrations.

GRAPHIC SCALE FALLBACK: if a target value has no written dimension on
the sheet, but at least one written dimension chain exists, derive
the drawing scale from that chain (prefer a chain on the SAME
drawing/view as the target) and measure the target graphically from
the drawing. Emit such values with source "estimated" and confidence
"low" - NEVER "measured" - and name the derivation in reference_used
(e.g. "graphic via sheet scale from Giebelansicht chain 11.19 m").
Written dimensions always take priority where they exist. Only when a
sheet contains no written dimension at all and no user reference is
given do affected values stay null with a low_reason.

OUTPUT: fill exactly the attached JSON schema. Emit the top-level keys in exactly this order: meta, building, references, attachments, faces, edges, openings, downspouts, condition_areas, quality - most critical first, so an unexpected cutoff loses only the tail. Return ONLY the JSON object - no markdown fences, no commentary before or after. Per value: reference_used, confidence, source. Not visible or uncertain: null plus a reason. Do not invent elements or reference objects. Do not pad the JSON with placeholder entries.

dimension_chains example (transcribe plan dimension chains verbatim): {"page":2,"label":"EG Suedfassade","values_mm":[3990,1010,3990],"stated_total_mm":8990,"computed_sum_mm":8990,"deviation_percent":0}
