# Measurement schema v1.7 - changes

Additive. v1.6 data stays readable; new runs write `schema_version: "1.7"`.

## Why
Leipzig plan run (22.09.2026): garage AT-2 (3520 x 6010, 2920 high) and its near-flat roof RF-5
(3.6 deg) were both measured correctly but nothing linked them, so the viewer gave the garage the
main roof's 12/12. The same run raised "eave total 18% off" and "roof area 35% off" although the
values matched the architect's plan: the checks compared the roof outline against the wall
footprint without overhang, and counted the garage roof as main roof. The photo-only run of the
same house measured the roof outline instead of the walls (+12% per side).

## Changes
1. Schema `shared/schema/measurement-v1.7.json`
   - `faces[].parent_attachment_id` (string AT-n | null): roof facet belongs to that attachment.
     null / absent = main roof.
   - `attachments[].subtype` (optional, null = not recognisable): pipe -> plumbing_stack | flue,
     vent -> static_vent | ridge_vent | turbine | power_vent | exhaust_cap | soffit_vent, or other.
   - Descriptions only: `attachments[].width_mm` = outside diameter for round penetrations,
     `attachments[].height_mm` = visible height above the roof for roof penetrations.
   - `meta.schema_version` const "1.7". `measurement-v1.6.json` is kept for reference.
2. Extraction prompts (photo, plan, mixed), identical wording
   - "Faces" deliverable line mentions `parent_attachment_id`.
   - New ATTACHMENT ROOF RULE (every roofed attachment gets its own RF-n with
     `parent_attachment_id`; flat roofs are roof faces; attached = touching the house).
   - New OVERHANG RULE (footprint and wall widths at the wall line; subtract 2 x soffit depth
     from eave-to-eave chains; report soffit_depth_mm).
   - PENETRATION RULE: diameter / visible height for round penetrations; subtype where
     recognisable, otherwise null (never guessed; the count stays the hard requirement).
3. Validation + checks (`berechnung.ts`, mirrored in `docs/pipeline/validate-assemble.js`)
   - `parent_attachment_id` must name an existing attachment and sit on a roof face.
   - `subtype` must fit its type (pipe subtypes on pipes, vent subtypes on vents).
   - Pitch statistics, roof-area sum and single-pitch geometry checks use main-roof facets only.
   - Eave total, hip total, rake total and roof area are derived from the roof outline
     (wall footprint + 2 x median soffit depth). Without a soffit depth nothing changes.
4. Fixture `fixtures/garage-house.json`: v1.7, garage roofs RF-5/RF-6 -> AT-7, pipes/vents with
   subtype, downspout
   lengths marked `source: "estimated"` (they are the eave heights, not measurements).

Not in v1.7 (parked): rake per gable,
front eave height investigation.

## Consumers still to update
The 3D viewer ignores `parent_attachment_id` until the viewer task builds attachment roofs from it
(with a side + area matching fallback for v1.6 data).

Open: whether the model tells vent types apart from ground photos is untested - check the
subtypes of the first real runs before quoting on them.
