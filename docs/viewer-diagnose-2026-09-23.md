# Why the viewer draws houses incorrectly

**Date:** 2026-09-23. **Scope:** analysis only; current workspace source and stored development measurements, not a historical reconstruction of a previous deployed viewer.

## 1. Summary

The main problem is in the **MODEL BUILDER**: it reconstructs a rectangular, fixed-direction gable template rather than the building's connected walls, roofs, and volumes.
It reduces footprint outlines to width and depth, places walls on four standard planes, and assigns roofs using area, approximate dimensions, and even identifiers instead of explicit ownership.
The **MEASUREMENT** already supplies useful information that is ignored—including roof-to-attachment links, per-side heights and grade offsets, precise pitch, and dormer style—but it still lacks enough boundary and adjacency information for reliable general reconstruction.
Leipzig's ten walls all survive the builder, yet several overlap or are placed inconsistently, so fewer visible walls does not mean fewer wall records.
Braamheide's measured gables retain their height, but the generated roof ridge runs in the wrong direction for them.
Attachments preserve usable supplied dimensions and parent positions, but generic boxes, guessed missing depth, and independent roof placement prevent coherent annexes, garages, and dormers.
The supplied 100 mm solar-panel thickness is preserved in the current data, while the awning's absent depth becomes 5 m.
The **CALCULATION** layer can retain quantities for surfaces and edges that the model does not place correctly, and it exposes only one global eave dimension.
The **RENDERING** layer adds unmeasured closure surfaces and translucent secondary-color triangles, so it can magnify geometric errors or produce misleading appearances.
The gap is architectural, not a handful of house-specific defects: a shared spatial contract, explicit uncertainty, and connected surface construction must precede further shape-specific fixes.

### Evidence and reproduction

- All four requested project IDs were found with measurements in the development database using parameterized SELECT-only queries; no production query was needed. Only ID and measurement JSON were retrieved. No measurements, paid APIs, sessions, stored records, schema, prompts, dependencies, or product code were changed.
- **29 synthetic v1.7 fixtures** cover every requested shape; **9 existing inputs** cover the four projects, every export, and the garage fixture. The manifest documents what each fixture can and cannot express.
- The isolated harness imports the actual current preparation, calculation, model builder, and ViewerViewport. Materials, lights, and tokens are unchanged. CSS is a hybrid: viewer rules are loaded from globals.css, the Tailwind import is removed, @theme is rewritten to :root, and a minimal hand-written utility subset supplies the shell layout. Next font loading is absent, so text uses a system fallback. These are viewport geometry/material captures, not exact full-product layout comparisons; warning/card visibility is not visually tested. Both initial and orbited views were captured at 1200×900 with actual software WebGL; render evidence records renderer, draw calls, triangles, pixels, and camera.
- A separate normal app-preview screenshot could not initialize WebGL. It is not used as geometry evidence. The isolated software-WebGL captures are the report figures.
- Full raw/prepared models, warnings, diagnostics, ID comparisons, and browser evidence: [results.json](../scripts/diagnose/results.json). Numerical causal tests and input hashes: [causal-results.json](../scripts/diagnose/causal-results.json). Input snapshots are under scripts/diagnose/real; canonical exports/fixture were read in place.
- Reproduce fixtures: `pnpm exec tsx scripts/diagnose/generate-fixtures.ts`; causal checks: `pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json scripts/diagnose/causal-probes.ts`; screenshots: `node scripts/diagnose/browser-harness.mjs`; report: `node scripts/diagnose/assemble-report.mjs`; validation: `pnpm exec tsx scripts/diagnose/validate-deliverables.ts`; scope guard: `node scripts/diagnose/scope-check.mjs`.
- An initial screenshot attempt timed out because analysis instrumentation incorrectly intercepted a prototype method instead of Three's per-instance renderer method. That harness defect was corrected without product edits; the failed attempts are not rated as application crashes. The final results replace those attempts and contain 38 successful inputs.
- Static claims have source citations; runtime claims have model coordinates and screenshots. Photographic ground truth, earlier deployed revisions, real-GPU/mobile rendering, and temporal flicker are not established by this run. An observed overlap establishes a z-fighting risk, not the frequency of visible flicker.

## 2. Assumptions inventory

Preparation is identified separately where it sits between MEASUREMENT and CALCULATION/MODEL BUILDER. “Other shapes” are general consequences inferred from the source; Section 4 identifies which were executed.

| Key | Repository path |
|---|---|
| B | `artifacts/aufmass-app/lib/viewer-next/model/buildModel.ts` |
| I | `artifacts/aufmass-app/lib/viewer-next/model/input.ts` |
| T | `artifacts/aufmass-app/lib/viewer-next/model/types.ts` |
| C | `artifacts/aufmass-app/lib/viewer-next/model/closure.ts` |
| P | `artifacts/aufmass-app/lib/viewer-next/projectMeasurement.ts` |
| D | `lib/measurement/src/computeDerived.ts` |
| R | `artifacts/aufmass-app/lib/viewer-next/renderResources.ts` |
| V | `artifacts/aufmass-app/components/viewer-next/ViewerViewport.tsx` |
| O | `artifacts/aufmass-app/lib/viewer-next/overlayLayout.ts` |
| W | `artifacts/aufmass-app/components/viewer-next/warningPresentation.ts` |
| S | `shared/schema/measurement-v1.7.json` |

`B:301–353`, for example, means that exact file and inclusive line range. Stations are measurement/schema, preparation, calculation, builder, and rendering/presentation. Preparation is separately named because raw JSON and the actual builder input are not interchangeable.

Consequences in the last columns are **static predictions** unless corroborated by the separate runtime report.

### Preparation and calculation

| Assumption (ID / station) | file:line | Symptoms it causes | OTHER shapes it would break |
|---|---|---|---|
| P1 / preparation — Only record objects with required nonempty string identity/class/type survive; duplicate IDs are removed within each collection, first retained. | P:43–76,215–301 | Missing elements may originate before geometry. A duplicated valid wall is not evidence of unsupported wall placement. | Any building with malformed identities; repeated-volume exports reusing IDs can lose otherwise distinct faces. |
| P2 / preparation — Measurement-value fields must be objects or null here; a bare number accepted by the builder's `valueOf` is discarded by preparation. | P:87–102,123–168,171–183; B:88–92 | Missing dimensions and fallback sizing can differ between direct-builder fixtures and the application. | Any shape imported with bare numeric values rather than measurement objects; no shape-specific restriction. |
| P3 / preparation — Invalid points/nested records are stripped and one aggregate omission warning is used; per-item reasons/IDs are not preserved in that warning. | P:104–120,185–199,211–214,342–359 | Warning cannot identify which wall disappeared, and can mean a nested field rather than an element was omitted. | Any partial export, especially segmented plans whose outline loses vertices; provenance is obscured even if geometry survives. |
| P4 / preparation — Unsupported version/meta prevents viewing; any exception during normalization/calculation/cards becomes “unreadable.” | P:461–494 | Entire viewer unavailable; distinct from a builder crash or individual geometric omission. | Any topology with unsupported metadata or an exceptional record; no shape-specific failure implied. |
| D1 / calculation — Footprint dimensions use explicit scalar when present, including authoritative null; only an omitted scalar can fall back to polygon axis extents. Builder null handling differs. | D:154–172; B:322–329 | Model can have a width but no permanent width label. | Outline-only or partial measurements with explicit unknown scalars, regardless of footprint shape. |
| D2 / calculation — Only one global eave height is derived. Per-elevation heights do not feed permanent dimensions. | D:197–202,307–312 | One eave label despite multiple measured side heights. | Sloped sites, split-level buildings and unequal-height connected wings. |
| D3 / calculation — Wall reconstruction is rectangle plus centered-triangle area formula; stored gross area wins; >3% mismatch warns. Missing gable differs from explicit null. | D:174–180,229–244 | Quantities may be correct while rendered shape is wrong; area agreement does not verify gable placement. | Nontriangular gables, stepped parapets and irregular wall profiles cannot be reconstructed by this formula. |
| D4 / calculation — Openings deduct only from an existing exact parent wall, never by elevation. Builder can reparent by elevation. | D:205–225,245–252; B:897–915 | The face shown containing an opening may not be the face receiving the deduction. | Multiple volumes or recessed façades sharing an elevation with missing/broken parent links. |
| D5 / calculation — Opening area is width×height, trim is rectangular perimeter; stored opening area/perimeter and stored wall net area do not control these calculations. | D:174–180,205–225,245–259 | Nonrectangular opening quantities can disagree with their true shape; not a direct cause of a missing annex window. | Arched, circular, triangular and trapezoidal openings. |
| D6 / calculation — Roof area sums measured areas; edges sum measured lengths independent of their geometric placement; complex roof waste is a low-confidence 10%/15% heuristic. | D:262–283,307–320 | Omitted hip/valley geometry can coexist with complete hip/valley quantities. | Multi-ridge, intersecting and mixed roof systems; quantity completeness alone cannot establish topology coverage. |
| D7 / calculation/preparation — Unknown collections invalidate dependent totals; missing operands propagate null, not partial sums. Incomplete opening dimensions exclude only identical-size grouping, not all opening quantities. | P:376–459; D:43–55,130–151,330 | “Unknown” in panel is not evidence that geometry was absent, or vice versa. | Any partially measured shape; this is conservative quantity handling, not itself a topology failure. |

### Footprint, wall, and geometric representation

| Assumption (ID / station) | file:line | Symptoms it causes | OTHER shapes it would break |
|---|---|---|---|
| B1 / builder — Ordered footprint points are reduced to min/max extents; explicit width/depth take priority. Polygon segments, concavity, translation and orientation are not used as walls. | B:301–329,1273–1314 | Misplaced/overlapping walls and gables; measured outline does not locate their own boundaries. | L/T/U plans, courtyards, angled façades and stepped plans collapse to an envelope. |
| B2 / builder — Missing width/depth use largest wall width in the relevant elevation pair, not summed contiguous segments; unresolved dimensions become 1 mm. | B:314–329,343–351 | Under-sized/degenerate envelope, apparently missing surfaces and incorrect dimension anchors. | Multi-segment elevations and required-fields-only inputs without a usable footprint. |
| B3 / builder — Overall fallback adds only the first positive right-addition width and first side-addition depth; attached/include-in-footprint are not consulted. | B:330–342 | Incorrect overall extent can feed wrong extension placement and roof sizing. | Multiple additions, left additions, front/back extensions and detached outbuildings. |
| B4 / builder — There are four axis-aligned wall normals/tangents; missing/unknown elevation is an ID-character hash into these four sides. | B:178–204,289–294,1208–1211 | Wrong-side walls/gables; renaming an unknown-elevation record changes its physical side. | Rotated/diagonal walls, chamfered corners and polygonal bays. |
| B5 / builder — Every recognized wall is built; normally its start is 0, front y=0, back y=main depth, left x=0, right x=main width. Back/left local x directions are reversed. | B:355–367,1273–1314 | Multiple same-elevation walls overlap, not necessarily disappear; coincident faces can flicker. | Recesses, bays, interior courts and multiple wall segments on one elevation. |
| B6 / builder — Extension placement is guessed from width/depth equality within 1 mm against a left/right `addition`, only when wall span is smaller than the main dimension. | B:1281–1300 | Coincidental equal lengths misassign unrelated walls, detaching annex walls/gables from their intended volume. | Full-width extensions, repeated equal-span façades and multiple wings. |
| B7 / builder — Front/back extension walls shift left or right; right side extension uses overall width; left side walls always remain x=0. | B:355–366,1291–1300 | Disconnected outer extension walls and apparent missing attachment sides. | Left-hand extensions and mirrored versions of otherwise identical right-hand wings. |
| B8 / builder — Wall bases are always zero. Face height overrides global eave; negatives clamp to zero; missing gable becomes zero. | B:1301–1313,370–388 | Wrong grounding/eave relationship and omitted-looking gable profiles; missing information appears as certainty. | Sloped grade, split levels, raised volumes and partially buried structures. |
| B9 / builder — Any positive per-wall gable height adds a centered apex to that wall, regardless of roof type or roof intersection. | B:370–388 | Floating/misaligned gables and vertical triangles conflicting with the roof. | Hip/half-hip roofs, off-center ridges and shed end walls. |
| B10 / builder — Global eave defaults to maximum wall height and ridge to that eave plus maximum wall gable, across all walls. | B:1266–1271 | Wrong main roof height can result from unrelated attachment wall heights/gables. | Connected higher/lower wings and buildings with several independent roof systems. |
| B11 / builder — Polygon triangulation is a corner-0 fan; no holes, boolean subtraction, concavity test, manifold or intersection validation. | B:240–286,484–495,617–641 | Openings are overlays rather than wall holes; overlapping surfaces are not resolved. | Arbitrary concave faces, courtyard boundaries and perforated façades. |
| B12 / builder — Nonfinite coordinates become zero and zero vectors receive fallback directions. Quantity confidence does not suppress dubious dimensions. | B:84–103,138–145 | Malformed/overflow values can become origin geometry rather than explicit errors. | Any shape with invalid/extreme dimensions; confidence alone does not protect uncertain reconstructions. |
| B13 / builder — Color is neutral for low confidence or invalid hex; valid secondary hex is retained. Face material does not drive geometry or physically different surfaces. | B:152–175,617–640 | Missing material appearance is distinct from missing walls. | Mixed-material façades and roofs requiring material-specific appearance; geometry is not necessarily broken by neutral color. |
| B14 / builder — Main bounds select parts by max-x only, then force main XY bounds to (0,0)–(width,depth); overall bounds include attachments, openings, conditions and edges. | B:1547–1594 | Misplaced patches/edges alter framing; left additions can affect main height while right ones are filtered. | Asymmetric or mirrored additions, off-origin plans and buildings with remote outbuildings. |

### Roof reconstruction

| Assumption (ID / station) | file:line | Symptoms it causes | OTHER shapes it would break |
|---|---|---|---|
| B15 / builder — Largest two measured roof areas become main roof facets; roof `parent_attachment_id` is not consulted. | B:1321–1327; I:19–34 | Wrong garage roof ownership/size: a large garage can become main roof, or one main facet and one annex can be paired. | Large secondary volumes, unequal main slopes and multiple connected roof systems. |
| B16 / builder — Main ridge is always parallel to X/width at y=depth/2; it is **not** selected by longest side. | B:1360–1381 | Roof ridge misses measured gable walls, leaving apparently floating triangles. | Depth-aligned ridges, asymmetric gables and nonrectangular main roofs. |
| B17 / builder — Main roles prefer front/back then stable ID order; each main facet spans the whole width and half depth. One facet covers only half the plan. | B:1213–1235,1360–1381 | Missing-looking roof coverage and incorrect hip facet placement. | Single-facet shed/flat roofs and four-facet hips. |
| B18 / builder — Positive ridge–eave rise overrides pitch. Otherwise only snapped rise/12 is read; original/rounded degrees are ignored; missing pitch becomes zero rise. | B:567–576,1364–1366 | Wrong roof slope despite own pitch; not literally “copies main pitch,” but shared height can override each face's pitch. | Shallow-pitch roofs, asymmetric slopes and roofs with inconsistent height/pitch measurements. |
| B19 / builder — Only the first side `addition` is considered the garage/secondary roof volume; up to two remaining facets are selected by pitch proximity to a width/depth-matched gable wall. | B:1328–1358 | Attachment receives the wrong roof facets; other secondary roofs are misplaced as cross facets. | Multiple garages, front/back annexes, separate volumes and larger cross-wings. |
| B20 / builder — Garage width/depth derive from addition or envelope; matched gable wall is selected by span and ID rather than ownership. | B:1329–1349 | Unrelated equal-width walls can orient or elevate a secondary roof. | Repeated-span connected volumes, narrow façades and multiple equal-sized annexes. |
| B21 / builder — Garage eave is maximum height of **all** walls whose span ≤ garage width+1; absent candidates use main eave. Addition height is not used here. | B:1420–1437 | Measured one-storey garage roof can be raised to a taller narrow main wall. | Low wings attached to tall buildings and stepped-height collections of volumes. |
| B22 / builder — Garage roof is always paired half-slopes; side is inferred from gable orientation/elevation or ID parity. Two facets can select the same half. | B:1438–1478 | Overlapping facets, flicker and apparently missing opposite slope; incorrect secondary roof form. | Flat, shed and unequal-slope attachment roofs. |
| B23 / builder — All remaining facets are centered front cross-roof halves; width uses square root of maximum area, depth uses area/width, side uses ID hash. | B:1383–1414 | Wrong roof location/size and overlapping halves; IDs can change physical placement. | Rear/offset/lower wings, dormers, hip facets and valley-connected roofs; equal areas do not determine topology. |
| B24 / builder — Non-gable roof type only emits an internal model note after the same reconstruction. There is no hip, half-hip, flat, shed, mansard or gambrel topology branch. | B:1496–1498; B:1321–1479; B:1164–1192; W:23–48 | Wrong roof form despite retained facets. The note says “not a supported topology,” not “unsupported”; it becomes `general`/`model_note` and produces no model UI warning by itself. | Entire non-gable roof families, not merely the two reported houses; a flat roof can be wrong without any model UI warning. |
| B25 / builder — Roof facet area is metadata/ranking or a cross/fallback size heuristic, not a constraint enforcing polygon area. Roof edges are built only after roofs and do not constrain them. | B:578–614,1321–1414,1483–1494,1522–1524 | Correct measured roof areas/ridge lengths coexist with incorrect sizes, intersections or placement. | Arbitrary intersecting/multi-ridge roofs whose topology must be constrained by edges and planes. |
| B26 / builder — Degenerate roof facets are retained with a note. Fallback uncovered roof record becomes square area-derived plane at eave. | B:595–597,1481–1494 | IDs may survive but be invisible or topologically wrong; final fallback is normally redundant because earlier buckets cover records. | Partial or degenerate roof measurements and unsupported roof boundaries requiring more than an area-derived square. |

### Attachments, openings, conditions and edges

| Assumption (ID / station) | file:line | Symptoms it causes | OTHER shapes it would break |
|---|---|---|---|
| B27 / builder — All attachments are boxes: supplied positive width/height/depth respected; missing/nonpositive height/depth substitute width. No 100-mm minimum thickness and no storey-based size rule exist here. | B:447–466,983–1089 | Missing depth can yield a cube; supplied positive 100-mm depth is preserved. Distinct attachment forms become boxes. | Canopies, panels, awnings, balconies, pipes, bays, chimneys and dormers. |
| B28 / builder — Positive width is required; missing height/depth warn only when null, not when zero/negative triggers width fallback. | B:1015–1023 | Silent thickening for nonpositive values; absent width drops the whole attachment. | Any partially dimensioned component, especially thin slabs/panels represented with zero or unknown thickness. |
| B29 / builder — Exact parent wall/roof is preferred. Missing positions center horizontally on walls and set base to 0; roof positions center within spans. | B:1024–1049 | Floating/grounded attachments when mounting height is absent; available parent position is not universally ignored. | Off-center dormers, raised balconies, canopies and wall-mounted components without complete positions. |
| B30 / builder — Wall attachment origin is x-clamped by parent surface helper, but its box width is not clamped. Local y becomes world z directly. | B:355–367,1032–1039 | Overhanging boxes and negative-y below-grade placement; side-specific grade offsets do not affect mounting. | Sloped sites, raised wall bases and wide attachments near short-wall corners. |
| B31 / builder — Roof boxes use roof U and V as base axes and vertical world Z extrusion, not a roof-normal thickness or a flat footprint. | B:441–466,1040–1049 | Wrong panel/roof-attachment geometry; sloped base plus vertical extrusion is not an ordinary upright cuboid. | Roof-normal solar plates, upright chimneys and roof-mounted equipment with distinct base/extrusion semantics. |
| B32 / builder — Parentless left/right additions are positioned at a main corner, ignoring position; all other unsupported placements start at (0,0,0), even if a named elevation is available. | B:1050–1078 | Awnings/entrances can sit at the origin or penetrate the building instead of mounting on the named side. | Detached garages, rear/side objects and offset additions lacking a usable parent. |
| B33 / builder — `attached` and `include_in_footprint` never distinguish placement; dormer style/pitch and subtype are not represented. | I:55–66; B:983–1089 | Incorrect attachment placement and roof form despite supplied semantic fields. | Detached structures, differing dormer styles and specialized pipe/vent subtypes. |
| B34 / builder — A side addition proxy is suppressed if two small wall spans match width/depth and some roof lies right of main width, without explicit ownership. | B:996–1013 | Missing attachment proxy and omission warning from false deduplication; matched walls/roof may be unrelated. | Multiple equal-span volumes and mirrored left/right additions with asymmetric heuristic results. |
| B35 / builder — Attachment proxies have fixed type colors and no child wall/roof face collection. Openings can parent only to walls/roofs, not attachment boxes. | B:966–980,897–915,1080–1089; T:94–102 | Annex box has no windows/material even when an independent face record is colored/opened elsewhere. | Any enclosed bay, garage or multi-storey addition requiring its own materialized and perforated façades. |
| B36 / builder — Missing/invalid opening dimensions drop the opening. Invalid parent is replaced by matching-elevation wall, then first wall by ID; roof opening uses roof/front/first roof. | B:680–687,893–915 | Missing annex windows or openings visible on the wrong component; fallback is not spatial nearest despite note wording. | Recessed façades, multiple same-elevation volumes and multifacet roofs with unresolved opening parents. |
| B37 / builder — Missing opening x spaces siblings in ID order on one row; z uses position then sill then ground for doors or 35% of wall height. | B:400–438,878–887,917–926 | Misplaced windows can make the intended annex wall appear bare; inferred locations are not measured layout. | Multi-storey window grids, grouped windows and staggered façade openings without positions. |
| B38 / builder — Opening bounds clamp using gable height at opening center, not all four corners; oversized openings/roof patches clamp their corners independently. | B:419–444,938–952 | Distorted opening geometry and overlap beyond gable sides; stored dimensions can differ from polygon extent. | Wide gable windows, oversized skylights and openings near sloping or short face boundaries. |
| B39 / builder — Every condition patch is an area-equivalent square, defaults to lower-left, and clamps to the parent. | B:1103–1140 | Misplaced/distorted damage patches; invalid supplied parent drops patch instead of elevation-fallback. | Long cracks, irregular damage outlines and narrow face-local damage bands. |
| B40 / builder — Edge placement matches elevation and expected wall span/height/rake within 20 mm, rejects near-tied candidates within 1 mm. | B:708–744 | Valid edges omitted and generic omission warning; hard tolerance can reject otherwise plausible placement. | Repeated equal-span façades, multiple similar wings and noisy measured edge lengths. |
| B41 / builder — Ridge matching uses longest highest horizontal edge of synthesized roof, length only; coincident duplicate ridges may pick deterministic first. | B:690–706,746–781 | Missing or incorrectly associated ridge lines; roof error can prevent matching authentic edge lengths. | Hip/shed/cross-ridge systems and roofs with several equal-length ridges. |
| B42 / builder — Eave/base start at wall local 0; rake is only the ascending half toward centered apex; corner is local 0 vertical; measured length sets endpoint. | B:783–860 | Opposite rakes/corners cannot be disambiguated; matched lengths can overshoot/undershoot actual vertices. | Off-center gables, repeated corner edges and elevations with multiple eave/base segments. |
| B43 / builder — Hip, valley, flashing, step flashing, head, sill, jamb, unclassified have no geometric placement branch. | B:801–839 | Measured edges may be counted yet never shown, triggering omission warnings. | Hip/valley roof networks, stepped flashing and opening-trim geometry; schema preservation alone does not make edges drawable. |

### Rendering, closure and labels

| Assumption (ID / station) | file:line | Symptoms it causes | OTHER shapes it would break |
|---|---|---|---|
| R1 / rendering — Base wall/roof material is opaque, double-sided and depth-writing. Secondary color alternates triangles and uses transparent opacity 0.42. | R:68–114 | See-through triangles depend on secondary hex, not universal wall alpha; triangle appearance is not a measured material boundary. | Any multicolored wall/roof, especially large surfaces with unlike triangulation patterns; no topology restriction. |
| R2 / rendering — Glazing is a transparent overlay, not a cutout; surface openings get outward displacement and polygon depth bias. | R:5–19,81–101; V:627–630 | Windows do not open the shell; offsets mitigate decal fighting but not duplicate wall/roof meshes. | Through-visible glazing, courtyards and façades requiring actual apertures or reveals. |
| R3 / rendering — Conditions and selection add transparent depth-biased overlays with separate offsets/orders. | R:29–65,127–162 | Highlight/condition appearance can be mistaken for wall transparency; not evidence base walls are translucent. | Any shape with overlapping selection/damage overlays; a presentation risk, not a demonstrated topology failure. |
| R4 / presentation — Closure uses roof projections plus only ground-level addition/bay/garage proxies; source footprint is not used, and wall-only geometry yields no source unless massing exists. | C:127–154,311–320 | Wrong roofs generate wrong closure; otherwise retained volumes may remain visually open. | Raised/other-type volumes and wall-only partial buildings. `garage` is accepted here but is not a schema attachment enum. |
| R5 / presentation — Projected union is sampled on axis-aligned coordinate cells at midpoints. Ground is single global minimum Z. | C:311–350 | Incorrect underside/closure outline or grounding can compound missing-wall and below-grade appearances. | Diagonal polygons, holes lost from source geometry, split-grade buildings and stepped slabs; rectilinear exactness does not generalize. |
| R6 / presentation — Closure wall top samples roof height; bottom samples existing wall top or global base. Missing wall coverage can yield a tall unmeasured vertical seam from grade up to roof. | C:167–226,239–302,352–376 | Apparent roof-to-ground surfaces or unexpected vertical gables may be seams rather than measured roof facets. | Overhanging roofs, incompletely located walls and open-sided canopies whose projections must not become enclosing walls. |
| R7 / presentation — Closure picks highest overlapping roof over the region; no roof valley/intersection trimming. Bottom cap and seams are not measurement IDs. | C:177–192,344–376 | Overlapping roof errors can be hidden or magnified; caps do not validate reconstruction. | Intersecting roofs, lower wings under higher roofs and valley-connected volumes. |
| R8 / rendering — All model walls/roofs/openings/attachments are added without a wall-count limit; closure/massing are noninteractive. Closure can block source picking. | V:627–640,744–747 | Fewer visible faces ≠ fewer records; closure/overlap can hide and prevent selecting retained walls. | Nested, recessed or intersecting volumes; no renderer-imposed four-wall limit exists. |
| R9 / rendering — Camera uses overall bounds, fixed perspective near/far 1–1,000,000 and fixed proportional diagonal start; span also controls interaction distances. | V:577–609,725 | Misplaced elements affect framing; depth precision may aggravate coplanar flicker, not independently proven here. | Very small/large buildings, remote detached structures and scenes mixing thin parts with large extents. |
| R10 / builder/overlay — Permanent labels are exactly length, depth and one eave, from derived values; anchors always start at world origin. They do not reference actual wall corner IDs. | B:1596–1611; T:117–128 | Dimension anchors miss intended corners and only one eave height is shown. | Nonrectangular and multi-height buildings needing per-side/per-segment dimensions. |
| R11 / overlay — Only first dimension segment is projected; ground rails are offset beyond convex model silhouette and eave rail is screen-vertical on right; dashed extensions connect anchors. | V:326–346; O:167–259 | Rails intentionally do not lie on mesh edges; wrong source anchors do not prove extensions were omitted. | Segmented dimensions, concave silhouettes and multiple-volume scenes whose convex hull spans empty space. |
| R12 / overlay — Layout scores collisions, silhouette overlap and region preference; no guaranteed collision-free solution. Displaced labels gain additional connectors; constrained-layout status is shown. | O:87–130; V:395–425 | Crowded short screens can have detached-looking/overlapping labels despite connectors. | Tall/narrow or sprawling projected shapes with many labels; risk depends on viewport space as well as topology. |
| R13 / diagnostics — Model categories are extracted from note substrings and deduplicated by code+ID; presentation maps `unsupported`/`ambiguity` categories to “omitted” and limits model warning categories to three. The non-gable roof-type note instead becomes `general`. | B:1164–1205,1496–1498; W:16–55 | Warning wording cannot prove a dropped wall: omitted edges/proxies or unsupported attachment placement can trigger it. The roof-type note itself is ignored by UI warning mapping. | Any complex/partial shape generating several failure categories; non-gable roofs can lack a model UI warning despite incorrect topology. |

## 3. Field usage table

The table includes all geometry/placement fields and adjacent metadata in the requested five schema roots. “Read” is not equivalent to “used correctly”; notes and copied metadata are distinguished from coordinate generation. Short file names below resolve to the full paths in Section 2 or the introductory path list.


### Scope and method

This is a static diagnosis of the complete v1.7 schema and the live viewer path:

1. preparation: `artifacts/aufmass-app/lib/viewer-next/projectMeasurement.ts`
2. calculation: `lib/measurement/src/computeDerived.ts`
3. model input boundary: `artifacts/aufmass-app/lib/viewer-next/model/input.ts`
4. geometry builder: `artifacts/aufmass-app/lib/viewer-next/model/buildModel.ts`
5. render resources/painter: `artifacts/aufmass-app/lib/viewer-next/renderResources.ts` and `components/viewer-next/ViewerViewport.tsx`

“Geometric” means that a value can change a generated point, span, plane, box, line, bounds, camera framing, or decal placement. “Metadata” means identity, grouping, styling, labels, takeoff arithmetic, diagnostics, or values merely copied onto the model. A field marked unused may still survive preparation because preparation spreads the original records before replacing selected fields (`projectMeasurement.ts:129-134,144-168,176-182,190-198,342-359`).

Citation notation is `file:line-line`. Schema citations refer to `shared/schema/measurement-v1.7.json`.

### Measurement-object expansion used below

`MV` means the schema’s nested measurement object:

| Nested path | Preparation | Calculation | Builder/render | Classification |
|---|---|---|---|---|
| `MV.value` | The enclosing dimensional record is retained only when it is an object or null (`projectMeasurement.ts:97-102,171-182`). | `read` requires a finite, nonnegative `value`; invalid/missing becomes unknown (`computeDerived.ts:32-40`). | Builder `valueOf` accepts only a finite value and otherwise returns null (`buildModel.ts:88-92`). | **Geometric** when the enclosing field is geometric; otherwise quantitative metadata. |
| `MV.confidence` | Preserved inside the record. | Propagates `high`/`medium`; anything else becomes `low` (`computeDerived.ts:38-40,43-51`). | Geometry ignores it. Face color confidence is separate. | **Metadata only**. |
| `MV.source` | Preserved. | Not read. | Not read. | **Metadata only / unused**. |
| `MV.reference_used` | Preserved. | Not read. | Not read. | **Metadata only / unused**. |
| `MV.low_reason` | Preserved. | Not read. | Not read. | **Metadata only / unused**. |

The schema defines these five children at `measurement.{value,confidence,source,reference_used,low_reason}` (`schema:1073-1112`) and permits either that object or null for `measurement_or_null` (`schema:1114-1122`). Every `…: MV` entry below includes all five nested paths; this expansion makes their coverage explicit without repeating identical rows dozens of times.

### Building fields

Schema inventory source: `building` and all nested properties are declared at `schema:82-236`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `building` | Yes | Preparation accepts an object, sanitizes selected children, or drops malformed input (`projectMeasurement.ts:137-168`). Builder defaults absent input to `{}` (`buildModel.ts:1242-1247`). **Container.** | Absent input becomes `{}`. |
| `building.building_type` | No | Preserved by preparation spread; no calculation, input-interface, builder, or renderer read. **Metadata only / unused by live viewer.** | Nothing; building massing is inferred from dimensions/faces. |
| `building.stories` | No | Preserved; never read downstream. **Metadata only / unused.** | Nothing; vertical geometry comes from heights and wall fields. |
| `building.roof_type` | Partial | Input boundary declares it (`input.ts:89-91`). Calculation reads `hip` only to select 15% rather than 10% suggested waste, also considering hip/valley/ridge edges (`computeDerived.ts:276-283`). Builder reads it only to emit a degradation note when present and not `gable` (`buildModel.ts:1496-1498`). **Metadata/calculation, not a topology selector.** | Supported roof construction is generated independently from facet rank, dimensions, heights, pitch, elevation, and IDs. |
| `building.footprint` | Yes | Preparation sanitizes it (`projectMeasurement.ts:123-134,144-147`); input declares it (`input.ts:79-83,89-93`). Missing footprint triggers reconstruction notes and possibly fallback massing (`buildModel.ts:1251-1254,1514-1519`). **Geometric container.** | Face spans/areas and 1 mm safety dimensions when absent. |
| `building.footprint.points[]` | Yes, fallback | Preparation accepts arrays of at least two finite coordinates (`projectMeasurement.ts:104-120,129-134`). Calculation derives an omitted width/depth from x/y extents, but explicit null blocks reconstruction (`computeDerived.ts:154-171,184-196`). Builder reads only coordinates 0 and 1 and computes extents (`buildModel.ts:296-329`). **Geometric fallback; extra accepted coordinates have no effect.** | Scalar footprint width/depth take precedence; wall spans then 1 mm follow if neither exists. |
| `building.footprint.points[][0]` | Yes, fallback | x is used for minimum/maximum width extent (`computeDerived.ts:164-170`; `buildModel.ts:307-325`). **Geometric.** | `footprint.width_mm`, then front/back wall widths. |
| `building.footprint.points[][1]` | Yes, fallback | y is used for minimum/maximum depth extent (`computeDerived.ts:164-170`; `buildModel.ts:307-329`). **Geometric.** | `footprint.depth_mm`, then left/right wall widths. |
| `building.footprint.width_mm: MV` | Yes | Sanitized (`projectMeasurement.ts:131-134`). Calculation uses it for permanent length, falling back to points only when omitted (`computeDerived.ts:154-171,185-190`). Builder prefers it for main width (`buildModel.ts:314-325,343-350`). **Primary geometric main width and dimension metadata.** | If missing/nonpositive: points extent, maximum front/back wall width, then 1 mm. |
| `building.footprint.depth_mm: MV` | Yes | Calculation creates permanent depth (`computeDerived.ts:191-196`). Builder prefers it for main depth (`buildModel.ts:318-329,343-350`). **Primary geometric main depth and dimension metadata.** | If missing/nonpositive: points extent, maximum left/right wall width, then 1 mm. |
| `building.footprint.perimeter_mm: MV` | No | Preserved but never declared at the input boundary or read by calculation/builder/render. **Quantitative metadata / unused.** | Nothing; rendered perimeter follows generated geometry. |
| `building.footprint.area_mm2: MV` | No | Preserved but never declared/read. **Quantitative metadata / unused.** | Nothing; dimensions/points generate the footprint. |
| `building.heights` | Yes | Preparation sanitizes selected values (`projectMeasurement.ts:143-168`); input declares only eave/ridge (`input.ts:93-96`). **Geometric container only for two scalar children.** | Wall height/gable fields supply fallbacks. |
| `building.heights.eave_height_mm: MV` | Yes | Sanitized (`projectMeasurement.ts:154-157`). Calculation reads it for permanent eave height with no fallback (`computeDerived.ts:197-202`). Builder sets roof eaves, default edge start, fallback bounds, and wall fallback height (`buildModel.ts:1266-1269,1273-1314,1360-1380,1571-1574`). **Primary geometric vertical datum.** | Maximum positive wall `height_mm`, then 1 mm. |
| `building.heights.ridge_height_mm: MV` | Yes | Sanitized (`projectMeasurement.ts:158-161`). Builder uses it for main ridge rise (`buildModel.ts:1267-1271,1364-1366`); it overrides pitch because `roofRise` returns a positive supplied fallback first (`buildModel.ts:572-575`). Calculation does not expose it. **Primary geometric main-ridge height.** | Eave height plus maximum positive wall gable height. |
| `building.heights.parapet_height_mm: MV` | No | Sanitized (`projectMeasurement.ts:162-165`) but absent from input interface and never read later. **Quantitative metadata / unused.** | Nothing; no parapet geometry is built. |
| `building.heights.datum_note` | No | Preserved, not read. **Metadata only / unused.** | Builder assumes its own z=0 datum. |
| `building.heights.per_elevation` | No | Preserved as-is; not declared at input boundary or read downstream. **Geometry-bearing schema data completely unused.** | Global eave/ridge plus wall height/gable fields. |
| `building.heights.per_elevation[].elevation` | No | Exists in the schema (`schema:168-199`) but is not read. **Placement metadata unused.** | Face elevations and global heights. |
| `building.heights.per_elevation[].eave_height_mm: MV` | No | Exists in the schema, is not sanitized individually, and is not read. **Geometry-bearing data unused.** | Global eave height, then wall heights. |
| `building.heights.per_elevation[].ridge_height_mm: MV` | No | Exists in the schema, is not sanitized individually, and is not read. **Geometry-bearing data unused.** | Global ridge height, then eave plus wall gable rise. |
| `building.heights.per_elevation[].grade_offset_mm: MV` | No | **Already exists in v1.7** (`schema:168-199`) but is not sanitized individually or read; wall bases are hard-coded to z=0 (`buildModel.ts:1303-1313`). **Geometry-bearing data unused.** | Hard-coded zero grade for every wall. Future topology work should **use/extend this existing field**, not describe grade offsets as wholly missing. |
| `building.shared_walls[]` | No | Preserved, not read. **Metadata/visibility semantics unused.** | All supplied wall faces are treated as exterior geometry. |
| `building.footprint_overall` | Yes | Schema allows width, depth, note only (`schema:214-235`). Preparation nevertheless uses the generic footprint sanitizer (`projectMeasurement.ts:147-150`); input types it as `MeasurementFootprintLike` (`input.ts:89-93`). **Geometric container for scalar width/depth.** | Narrow addition-based inference when scalars are absent. |
| `building.footprint_overall.width_mm: MV` | Yes | Builder uses it as overall width and expands overall bounds/camera framing, not permanent main dimension (`buildModel.ts:330-340,1577-1594`). Calculation ignores it. **Geometric overall envelope.** | `max(main width, main width + first right-side addition width)`. |
| `building.footprint_overall.depth_mm: MV` | Yes | Builder uses it as overall depth (`buildModel.ts:335-342`). **Geometric overall envelope.** | `max(main depth, first left/right addition depth)`. |
| `building.footprint_overall.note` | No | Preserved, never read. **Metadata only / unused.** | Nothing; inclusion is inferred from generated geometry. |

### Face fields

Schema inventory source: `faces[]` and conditionals at `schema:447-673`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `faces` | Yes | Preparation requires unique nonempty string `id` and `face_class`; malformed/duplicate records are omitted (`projectMeasurement.ts:43-75,215-236`). Calculation rejects duplicate IDs if called directly (`computeDerived.ts:203-204`). Builder tolerates absent/malformed direct input (`buildModel.ts:543-565,1248-1251`). **Geometry source collection.** | Missing collection yields no per-face geometry and may leave only safety bounds. |
| `faces[].id` | Yes | Calculation keys parents/source IDs/diagnostics/counts (`computeDerived.ts:203-227,229-268`). Builder uses identity for parent lookup, stable sorting/role assignment, stable fallback placement, and selection (`buildModel.ts:1213-1234,1274-1276,1321-1358,1412-1413`). **Metadata with placement effects.** | Generated stable display ID only when builder is invoked outside preparation. |
| `faces[].face_class` | Yes | Calculation selects wall/roof/fascia/soffit arithmetic (`computeDerived.ts:229-275`). Builder constructs only `wall` and `roof_face`; other classes are omitted in detailed geometry and only affect fallback conditions (`buildModel.ts:1248-1251,1500-1519`). **Primary geometric classifier.** | Unsupported/missing classes are omitted or contribute only to whole-building fallback massing. |
| `faces[].elevation` | Yes | Calculation reports/groups it but never uses it for wall deductions (`computeDerived.ts:101-127,245-259`). Builder maps walls to planes and uses roof elevation for role/fallback choices (`buildModel.ts:178-203,1213-1234,1274-1314,1360-1380,1465-1477`). **Geometric placement plus metadata.** | Missing/unsupported wall elevation is assigned front/back/left/right by ID hash (`buildModel.ts:289-293`). |
| `faces[].material` | No | Survives preparation; not declared by input boundary and not read by calculation, builder, or render. **Metadata only / unused by viewer.** | Face color tokens/material defaults drive appearance; geometry is unaffected. |
| `faces[].area_mm2: MV` | Yes | Calculation sums roof/fascia/soffit area and prefers stored wall gross area (`computeDerived.ts:229-275`). Builder copies wall/roof area as metadata, ranks main facets, sizes cross/fallback roofs, and derives fallback massing (`buildModel.ts:598-604,631-666,1321-1327,1383-1414,1481-1494`). **Geometric for roof heuristics/fallback massing; quantitative metadata for ordinary walls.** | Missing roof area becomes zero for ranking and 1 mm² minima for heuristic planes/massing. |
| `faces[].net_area_mm2: MV` | Yes, metadata only | Calculation deliberately recomputes net wall area (`computeDerived.ts:174-181,245-259`). Builder copies it to `ModelWall.netAreaMm2` only (`buildModel.ts:631-639`); render geometry does not use it. **Quantitative metadata only.** | Calculation uses gross area minus parent-assigned reconstructed opening areas. |
| `faces[].width_mm: MV` | Yes | Calculation reconstructs wall areas (`computeDerived.ts:229-259`). Builder uses wall span, footprint fallback inference, attachment/addition matching, and edge matching (`buildModel.ts:314-329,708-744,1274-1317`). **Primary wall geometry and placement matching.** | Main footprint width for front/back or depth for left/right when absent/nonpositive. |
| `faces[].height_mm: MV` | Yes | Calculation reconstructs rectangular area (`computeDerived.ts:229-259`). Builder sets wall height and participates in opening clamp/edge matching (`buildModel.ts:423-433,720-729,1266-1271,1301-1314`). **Primary wall geometry.** | Global eave height. |
| `faces[].gable_height_mm: MV` | Yes | Calculation treats null as zero and omission as unknown (`computeDerived.ts:174-180,232-239`). Builder maps null/omission to zero; positive values add apex and influence ridge/garage roof (`buildModel.ts:370-389,1267-1271,1301-1314,1332-1349`). **Geometric; calculation and builder null semantics differ.** | Zero in builder when absent/null. |
| `faces[].soffit_depth_mm: MV` | No | Sanitized (`projectMeasurement.ts:223-231`) and declared (`input.ts:33`), but never read; soffit/fascia geometry is omitted (`buildModel.ts:1505-1513`). **Geometry-bearing data unused.** | Nothing; no soffit/fascia geometry is built. |
| `faces[].parent_attachment_id` | No | Preserved but absent from input interface and never read. **Explicit placement relationship unused.** | Garage/addition roof ownership is guessed from area rank, pitch, dimensions, wall spans, and ordering (`buildModel.ts:1321-1358`). |
| `faces[].pitch` | Partial | Preparation accepts object/null (`projectMeasurement.ts:185-198,220-235`); input declares only original and snapped children (`input.ts:28-31`). **Nested geometric metadata.** | Only `rise_over_12_snapped` is consumed. |
| `faces[].pitch.degrees_original` | No | Declared at input boundary but never read. **Geometry-bearing data unused.** | Snapped rise-over-12, or supplied ridge/gable rise. |
| `faces[].pitch.degrees_rounded` | No | Not declared at input boundary and never read. **Geometry-bearing data unused.** | Snapped rise-over-12, or supplied ridge/gable rise. |
| `faces[].pitch.rise_over_12_snapped` | Yes | Builder accepts finite nonnegative values, computes rise only without a height/gable fallback, drives cross/some garage roofs, and copies it as metadata (`buildModel.ts:567-575,598-604,1364-1366,1397-1399,1429-1436`). **Geometric but subordinate to supplied ridge/gable rise.** | Zero rise when absent and no positive supplied fallback. |
| `faces[].orientation_deg` | No | Preserved; absent from input and never read. **Placement/orientation metadata unused.** | Hard-coded front/back/side axes and elevation/ID role inference. |
| `faces[].color` | Yes, styling | Sanitized as object/null (`projectMeasurement.ts:220-235`); input declares selected children (`input.ts:13-17,32`). **Styling container, not geometry.** | Neutral viewer token when usable color is absent. |
| `faces[].color.hex` | Yes, styling | Builder accepts six-digit hex only when confidence is not low; renderer uses model color (`buildModel.ts:152-175`; `renderResources.ts:92-113`). **Visual metadata, no placement effect.** | Neutral model color token. |
| `faces[].color.secondary_hex` | Yes, styling | Valid hex becomes alternating triangle material groups for non-glazing polygons (`buildModel.ts:166-175`; `renderResources.ts:68-78,102-113`). **Visual metadata.** | Single primary material. |
| `faces[].color.confidence` | Yes, styling | `low` forces neutral; missing is treated as sufficiently confident when hex is valid (`buildModel.ts:152-175`). **Visual metadata.** | Missing confidence does not trigger a fallback; literal `low` uses neutral. |
| `faces[].color.name` | No | Preserved, not declared/read. **Metadata only / unused.** | Nothing. |
| `faces[].color.note` | No | Preserved, not declared/read. **Metadata only / unused.** | Nothing. |

### Edge fields

Schema inventory source: `edges[]` at `schema:675-723`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `edges` | Yes | Preparation requires unique string `id` and `edge_class`, sanitizing length (`projectMeasurement.ts:252-258`). Calculation aggregates every class (`computeDerived.ts:262-266`). Builder attempts placement after walls/roofs (`buildModel.ts:1522-1524`). **Geometry/takeoff collection.** | Missing/malformed collection yields no edge models. |
| `edges[].id` | Yes, metadata | Builder uses it for model identity and tie diagnostics, not coordinates (`buildModel.ts:791-796`). **Metadata.** | Generated fallback only when builder is invoked outside preparation. |
| `edges[].edge_class` | Yes | Calculation groups lengths and derives drip edge/corners/base/gutters/waste (`computeDerived.ts:262-299,316-345`). Builder defaults to `unclassified` and geometrically supports only `eave`, `rake`, `ridge`, `base`, `outside_corner`, `inside_corner` (`buildModel.ts:800-840`). **Geometric classifier for six classes; takeoff metadata for all.** | Unsupported classes are omitted from geometry rather than substituted. |
| `edges[].length_mm: MV` | Yes | Calculation sums it (`computeDerived.ts:262-266,296-299`). Builder uses it as segment length and requires a candidate geometry match within 20 mm without ambiguity (`buildModel.ts:708-780,791-859`). **Primary line geometry and placement discriminator.** | Null/invalid becomes zero with a note; unmatched/ambiguous edge is omitted. |
| `edges[].belongs_to_elevation` | Yes, except ridge | Calculation reports it for gutters (`computeDerived.ts:296-299`). Builder restricts wall candidates by it; ridge placement ignores it (`buildModel.ts:708-780,791-839`). **Geometric wall-edge placement; metadata for calculation/ridge.** | Ridge uses reconstructed roof-ridge length; missing/wrong wall elevation generally causes omission. |

No schema edge field identifies a parent face or supplies endpoints. Consequently, the builder can only length-match its own reconstructed wall/ridge candidates; valley, hip, flashing, step flashing, head, sill, jamb, and unclassified lengths have no render placement.

### Opening fields

Schema inventory source: `openings[]` at `schema:725-815`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `openings` | Yes | Preparation requires unique string `id` and `type`, sanitizing dimensions/position (`projectMeasurement.ts:237-251`). Calculation derives quantities (`computeDerived.ts:205-227`). Builder groups/places records (`buildModel.ts:871-964`). **Geometry/takeoff collection.** | Missing collection yields no opening models. |
| `openings[].id` | Yes | Calculation uses it for diagnostics/groups/counts (`computeDerived.ts:205-227,304-334`). Builder sorts IDs to distribute unpositioned siblings (`buildModel.ts:878-887,917-920`). **Metadata with deterministic placement effect.** | Generated fallback only outside preparation. |
| `openings[].type` | Yes | Calculation counts/groups and chooses J-channel treatment (`computeDerived.ts:63-70,205-227,284-305`). Builder chooses sill fallback, roof/skylight fallback, and color (`buildModel.ts:426-429,862-868,900-907,927-960`). **Geometric fallback/classification and metadata.** | Missing direct-builder type defaults to `other` or `skylight`. |
| `openings[].elevation` | Yes, fallback | Calculation reports/groups it; deductions require parent ID (`computeDerived.ts:90-127,205-227,245-247`). Builder uses it only when parent lookup fails (`buildModel.ts:680-688,897-915`). **Fallback placement, not authoritative assignment.** | Exact `parent_face_id` takes precedence; otherwise first matching ID-sorted wall/preferred roof. |
| `openings[].parent_face_id` | Yes | Calculation resolves assignment/deductions and diagnoses missing parents (`computeDerived.ts:203-227,245-259`). Builder resolves exact wall/roof (`buildModel.ts:878-883,897-917`). **Primary placement/assignment relationship.** | Type/elevation fallback; omit if no face is found. |
| `openings[].width_mm: MV` | Yes | Calculation derives area/perimeter/united inches (`computeDerived.ts:205-226`). Builder requires positive width for polygon span, sibling distribution, and clamp (`buildModel.ts:400-438,889-895,919-960`). **Primary geometry.** | No dimensional fallback; geometry is omitted. |
| `openings[].height_mm: MV` | Yes | Calculation derives area/sides; builder requires positive height and creates/clamps polygon (`computeDerived.ts:205-226`; `buildModel.ts:423-438,889-960`). **Primary geometry.** | No dimensional fallback; geometry is omitted. |
| `openings[].sill_height_mm: MV` | Yes, fallback | Builder uses it only when `position_mm.y` is not finite; roof openings ignore it (`buildModel.ts:423-433`). Calculation ignores it. **Wall vertical placement fallback.** | Doors use 0; other wall openings use 35% of wall height. |
| `openings[].group_id` | No | Preserved but absent from input and ignored. Identical groups use exact type/width/height instead (`computeDerived.ts:130-151`). **Metadata only / unused.** | Exact type/width/height grouping; placement siblings use parent/elevation key. |
| `openings[].position_mm` | Yes | Preparation accepts object/null (`projectMeasurement.ts:242-250`); builder reads children. **Placement container.** | Sibling spacing/centering and sill/type defaults. |
| `openings[].position_mm.x` | Yes | Wall: local parent x, clamped; absent distributes siblings by ID/equal gaps (`buildModel.ts:400-421`). Roof: axis U, clamped; absent centers (`buildModel.ts:938-946`). **Primary horizontal placement.** | Equal-gap wall distribution or roof centering. |
| `openings[].position_mm.y` | Yes | Wall: z/sill, clamped under wall/gable (`buildModel.ts:423-438`). Roof: axis V, clamped (`buildModel.ts:938-946`). **Primary vertical/slope placement.** | Sill height, then type/35%-wall fallback; roof centering. |
| `openings[].area_mm2: MV` | Yes, metadata only | Calculation ignores stored area and recomputes width × height (`computeDerived.ts:174-181,205-226`). Builder copies it to model metadata (`buildModel.ts:928-935,954-961`). **Quantitative metadata only.** | Width × height in calculation and polygon geometry. |
| `openings[].perimeter_mm: MV` | No | Preserved but not sanitized/declared/read; calculation recomputes perimeter (`computeDerived.ts:174-181,205-226`). **Quantitative metadata unused.** | Width/height-derived top, sill, sides, and total. |
| `openings[].note` | No | Preserved, not read; schema default is not materialized (`schema:808-811`; `projectMeasurement.ts:176-182`). **Metadata only / unused.** | Nothing; default text is inert in this path. |

### Attachment fields

Schema inventory source: `attachments[]` at `schema:315-446`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `attachments` | Yes | Preparation requires unique string `id` and `type`, sanitizing dimensions/position (`projectMeasurement.ts:259-273`). Calculation never reads it. Builder creates proxies and addition heuristics (`buildModel.ts:983-1092,1258-1264`). **Geometry collection only in builder.** | Missing collection yields no attachment models/addition inference. |
| `attachments[].id` | Yes, metadata | Builder uses it for identity/selection/diagnostics (`buildModel.ts:991-993`). **Metadata.** | Generated fallback only outside preparation. |
| `attachments[].type` | Yes | Controls color, detailed-addition proxy suppression, side-addition fallback, and closure eligibility (`buildModel.ts:966-980,991-1014,1050-1079`; `closure.ts:135-145`). **Geometric classifier/fallback plus visual metadata.** | Missing direct-builder type defaults to `other`. |
| `attachments[].subtype` | No | Preserved but absent from input and never read. **Metadata only / unused.** | Generic attachment `type`; penetration subtypes do not alter geometry. |
| `attachments[].elevation` | Yes | Used for overall-envelope inference, extension matching, side-addition placement, and model/fallback elevation (`buildModel.ts:330-342,996-1010,1030-1078,1281-1300`). **Geometric placement/fallback.** | Resolved parent elevation; otherwise unsupported context defaults to front. |
| `attachments[].width_mm: MV` | Yes | Positive width is mandatory; it sets box width, defaults height/depth, and aids envelope/extension matching (`buildModel.ts:330-340,991-1023,1032-1089,1281-1285`). **Primary geometry.** | No width fallback; attachment is omitted. |
| `attachments[].height_mm: MV` | Yes | Positive value sets vertical box size (`buildModel.ts:1019-1023`). **Primary geometry.** | Width when missing/nonpositive; only null emits the missing-height note. |
| `attachments[].depth_mm: MV` | Yes | Sets box depth and participates in overall-depth/addition/garage inference (`buildModel.ts:335-342,995-1023,1032-1089,1286-1289,1329-1346`). **Primary geometry.** | Width when missing/nonpositive. |
| `attachments[].position_mm` | Yes, conditional | Preparation accepts object/null (`projectMeasurement.ts:264-271`). **Placement container used only with a resolved parent.** | Parent-centered/ground fallback placement. |
| `attachments[].position_mm.x` | Yes, conditional | Parent wall: local x; parent roof: roof-U (`buildModel.ts:1032-1048`). Ignored without resolved parent (`buildModel.ts:1050-1079`). **Primary placement only when parent resolves.** | Center on parent; no-parent addition/generic branches use fixed origins. |
| `attachments[].position_mm.y` | Yes, conditional | Parent wall: z; parent roof: roof-V (`buildModel.ts:1032-1048`). Ignored without parent. **Primary placement only when parent resolves.** | Wall z=0 or centered roof-V; no-parent branches use fixed ground origins. |
| `attachments[].parent_face_id` | Yes | Resolves exact wall/roof; wall boxes use tangent/normal and roof boxes use U/V (`buildModel.ts:1024-1049`). Bad/missing links enter fallback while original bad ID is copied (`buildModel.ts:1050-1088`). **Primary placement relationship.** | Side-addition placement or generic front massing block. |
| `attachments[].attached` | No | Declared at input boundary (`input.ts:64`) but never read. **Placement/semantics unused.** | Type/elevation/dimensions and generated bounds; detached status is ignored. |
| `attachments[].include_in_footprint` | No | Declared at input boundary (`input.ts:65`) but never read. **Envelope semantics unused.** | Overall dimensions, type/elevation addition inference, and generated bounds (`buildModel.ts:330-342,1572-1594`; `closure.ts:127-153`). |
| `attachments[].dormer` | No | **Already exists in v1.7** (`schema:418-443`) but is not sanitized as a nested record, typed, or read. Dormers become generic boxes (`buildModel.ts:966-980,983-1092`). **Geometry-bearing data unused.** | Generic attachment width/depth/height box. Future topology work should **use/extend this existing object**, not describe dormer topology as wholly missing. |
| `attachments[].dormer.style` | No | **Already exists** (`schema:425-435`) but is not read. **Topology metadata unused.** | Generic rectangular dormer box; future work should use/extend the field. |
| `attachments[].dormer.face_pitch_deg` | No | **Already exists** (`schema:436-441`) but is not read. **Geometry-bearing data unused.** | Generic flat-topped box representation; future work should use/extend the field. |

### Render-stage use and default boundary

The renderer never reads raw schema fields. It consumes builder output:

* polygon coordinates come exclusively from model triangles (`renderResources.ts:68-78`); edges use the two builder endpoints (`ViewerViewport.tsx:116-131`);
* openings are translated outward by a render-only token offset, leaving canonical coordinates unchanged for measurement (`renderResources.ts:9-27,81-101`);
* condition decals similarly receive only a presentation offset (`renderResources.ts:29-65`);
* face color and secondary color affect materials, not geometry (`renderResources.ts:73-78,82-113`);
* overall generated bounds, including inferred/proxy attachments, set camera center/span and contact shadow (`ViewerViewport.tsx:557-625`; `renderResources.ts:165-196`);
* walls, roof faces, openings, attachments, massing, edges, and condition patches are rendered; soffit/fascia do not reach model geometry (`ViewerViewport.tsx:627-640`);
* presentation-only caps/seams are reconstructed from projected roof/ground-attachment/model geometry, not from schema footprint points (`closure.ts:127-153,305-380`).

Thus schema defaults are not generally applied. Preparation is structural sanitation, not JSON Schema default materialization. Concrete defaults/inferences are builder code defaults documented in the tables above.

### Schema path inventory coverage

The requested five roots are fully inventoried below. `MV.*` expands to `value`, `confidence`, `source`, `reference_used`, and `low_reason` as explicitly tabulated above.

| Root | Every schema property path covered |
|---|---|
| `building` | `building_type`; `stories`; `roof_type`; `footprint`; `footprint.points[]`; `footprint.points[][0]`; `footprint.points[][1]`; `footprint.width_mm.MV.*`; `footprint.depth_mm.MV.*`; `footprint.perimeter_mm.MV.*`; `footprint.area_mm2.MV.*`; `heights`; `heights.eave_height_mm.MV.*`; `heights.ridge_height_mm.MV.*`; `heights.parapet_height_mm.MV.*`; `heights.datum_note`; `heights.per_elevation`; `heights.per_elevation[].elevation`; `heights.per_elevation[].eave_height_mm.MV.*`; `heights.per_elevation[].ridge_height_mm.MV.*`; `heights.per_elevation[].grade_offset_mm.MV.*`; `shared_walls[]`; `footprint_overall`; `footprint_overall.width_mm.MV.*`; `footprint_overall.depth_mm.MV.*`; `footprint_overall.note`. |
| `faces[]` | `id`; `face_class`; `elevation`; `material`; `area_mm2.MV.*`; `net_area_mm2.MV.*`; `width_mm.MV.*`; `height_mm.MV.*`; `gable_height_mm.MV.*`; `soffit_depth_mm.MV.*`; `parent_attachment_id`; `pitch`; `pitch.degrees_original`; `pitch.degrees_rounded`; `pitch.rise_over_12_snapped`; `orientation_deg`; `color`; `color.hex`; `color.name`; `color.confidence`; `color.secondary_hex`; `color.note`. Conditional material enums do not add paths (`schema:606-672`). |
| `edges[]` | `id`; `edge_class`; `length_mm.MV.*`; `belongs_to_elevation`. |
| `openings[]` | `id`; `type`; `elevation`; `parent_face_id`; `width_mm.MV.*`; `height_mm.MV.*`; `sill_height_mm.MV.*`; `group_id`; `position_mm`; `position_mm.x`; `position_mm.y`; `area_mm2.MV.*`; `perimeter_mm.MV.*`; `note`. |
| `attachments[]` | `id`; `type`; `subtype`; `elevation`; `width_mm.MV.*`; `height_mm.MV.*`; `depth_mm.MV.*`; `position_mm`; `position_mm.x`; `position_mm.y`; `parent_face_id`; `attached`; `include_in_footprint`; `dormer`; `dormer.style`; `dormer.face_pitch_deg`. |

Required markers and enum/pattern constraints are schema validation rules, not additional data paths. Preparation does not execute those constraints; for collections it checks only record shape, uniqueness, and the named string identity fields (`projectMeasurement.ts:43-75,215-301`).

### Baseline contradictions and gaps (reported, not fixed)

1. **Version naming is stale and validation claims exceed preparation.** The input comments say the boundary survives v1.5 and that canonical v1.6 was validated (`input.ts:1-5`), while the diagnosed schema is v1.7 (`schema:1-4`) and preparation is still named `normalizeV16Measurement` (`projectMeasurement.ts:207-210`). Preparation accepts supported versions or literal 1.5, then performs permissive sanitation rather than canonical schema validation (`projectMeasurement.ts:461-490`).

2. **The schema cannot encode authoritative face polygons or edge endpoints.** Roof planes, cross-gables, garage roofs, and all edge locations must therefore be invented from footprint scalars, areas, elevations, pitches, IDs, and fixed topology heuristics (`buildModel.ts:1321-1495,708-859`). This is the central representational reason a schema-valid measurement need not render like the photographed building.

3. **Explicit attachment-roof ownership is present but ignored.** `faces[].parent_attachment_id` exists specifically to place attachment roof facets (`schema:524-530`), yet it is absent from `MeasurementFaceLike` (`input.ts:19-34`) and never read. The builder instead selects the two largest roof faces as the main roof, then guesses garage/cross roofs (`buildModel.ts:1321-1358`).

4. **Per-elevation height/grade geometry is present but ignored.** The schema already includes `per_elevation[].grade_offset_mm` and says per-elevation values are needed for sloped grade, cross-gable, and jerkinhead cases (`schema:168-199`). The builder reads only global eave/ridge values, fixes every wall base at zero, and normalizes bounds to zero (`buildModel.ts:1266-1271,1303-1314,1579-1594`). Future topology work should use or extend the existing grade-offset field, not treat grade offsets as wholly missing from the schema.

5. **Most declared roof types are unsupported.** The schema permits gable, hip, flat, shed, mansard, gambrel, jerkinhead, other, and unknown (`schema:104-115`). The builder follows one gable-oriented construction and only warns for non-gable values (`buildModel.ts:1360-1498`). Calculation’s use of `hip` changes waste metadata, not geometry (`computeDerived.ts:276-283`).

6. **Dormer-specific geometry is present but ignored.** The schema already includes `dormer.style` and `dormer.face_pitch_deg` (`schema:418-442`), but they never cross the input boundary. A dormer is a rectangular proxy box using generic width/depth/height (`buildModel.ts:966-980,983-1092`). Future topology work should use or extend these existing fields, not treat dormer style/pitch as wholly missing from the schema.

7. **Attachment envelope flags are ignored.** `attached` and `include_in_footprint` are typed (`input.ts:64-65`) but do not govern placement, overall bounds, or closure. Detached structures can therefore affect generated overall framing, while intended footprint inclusion is inferred rather than obeyed (`buildModel.ts:1564-1594`; `closure.ts:127-153`).

8. **Soffit/fascia geometry fields do not produce soffit/fascia geometry.** The schema describes all four face classes and provides soffit depth (`schema:447-522`); builder detailed geometry supports only wall and roof and omits the others (`buildModel.ts:1248-1251,1505-1513`).

9. **Edge inventory exceeds placeable edge geometry.** The schema promises all edge classes and says unclassified is shown, never silently dropped (`schema:675-677`). Builder omits every class except eave, rake, ridge, base, and vertical corners, and may omit even those unless reconstructed length matches within 20 mm unambiguously (`buildModel.ts:708-859`). Hip, valley, flashing, step flashing, head, sill, jamb, and unclassified therefore remain calculation rows but are not shown.

10. **Opening position origin is ambiguous across schema and implementation.** Schema says opening x/y is from the lower-left corner of its elevation (`schema:787-800`), while `parent_face_id` is required to distinguish multiple faces on that elevation (`schema:764-769`). Builder interprets x as local to the chosen parent face (`buildModel.ts:400-438,917-927`). For an attached-volume wall whose face starts away from the elevation origin, these are different coordinate systems.

11. **Footprint point shape is loosened during preparation.** Schema points have exactly two numbers (`schema:124-133`). Preparation accepts two or more finite coordinates (`projectMeasurement.ts:104-120`), calculation reads the selected axis, and builder reads only the first two (`computeDerived.ts:164-170`; `buildModel.ts:296-313`).

12. **`footprint_overall` is treated as a richer type than its schema.** Schema gives it width, depth, and note but no points (`schema:214-235`). The input boundary aliases it to the main `MeasurementFootprintLike`, which includes points (`input.ts:79-83,89-93`), and preparation runs the point sanitizer on it (`projectMeasurement.ts:123-150`), although the builder ignores overall points (`buildModel.ts:301-342`).

13. **Null/omitted gable semantics disagree.** Calculation treats explicit null as a known zero gable and omission as unknown (`computeDerived.ts:174-180,232-239`). Builder maps both to zero (`buildModel.ts:1301-1313`), so a wall can be geometrically rectangular while its calculated gable/gross reconstruction remains unknown.

14. **Stored opening area/perimeter and wall net area are non-authoritative.** The schema carries them (`schema:505-507,802-806`), but calculation explicitly ignores them and reconstructs from dimensions/parent assignment (`computeDerived.ts:174-181,205-259`). Builder retains opening area and wall net area only as model metadata (`buildModel.ts:631-639,928-960`).

15. **Pitch stages are mostly inert.** Schema carries original, rounded, and snapped pitch (`schema:532-549`). Only snapped rise-over-12 is read; original is typed but unused and rounded is not typed (`input.ts:28-31`; `buildModel.ts:567-575`). Even snapped pitch loses to supplied ridge/gable rise in several roof branches.

16. **Color confidence default behavior is permissive rather than unknown-safe.** A missing confidence does not neutralize a valid hex because only literal `low` is rejected (`buildModel.ts:152-175`), although schema requires confidence whenever color exists (`schema:558-587`). This is visual, not geometric, but demonstrates that preparation is not enforcing the schema contract.

17. **Preparation silently preserves many malformed nested scalar children.** It verifies that selected measurement/pitch/color/position fields are records, but does not validate their children against numeric/enumerated schema constraints (`projectMeasurement.ts:97-102,171-198,215-301`). Builder and calculation then each apply different local finite/nonnegative checks (`buildModel.ts:80-96`; `computeDerived.ts:32-40`).

18. **Overall-envelope fallbacks use only a narrow addition pattern.** In the absence of explicit overall dimensions, width considers the first right-side addition width, while depth considers the first left/right addition depth (`buildModel.ts:330-342`). Front/back additions, multiple additions, bay/balcony volumes, `attached`, and `include_in_footprint` do not participate in that scalar inference, though generated proxy bounds can later enlarge overall render bounds (`buildModel.ts:1572-1594`).

19. **Area and ID can change topology rather than merely metadata.** Roof area ranking chooses the two “main” facets and IDs assign front/back, cross-roof side, and garage-roof side (`buildModel.ts:1213-1234,1321-1358,1360-1478`). Two measurements with identical dimensions but different facet area ordering or IDs can therefore produce different geometry.

20. **Renderer closure is inferred from generated roofs, not schema footprint.** Opaque caps and seams use projected model roof polygons and selected ground attachments (`closure.ts:127-153,305-380`). Any earlier topology/placement inference is amplified into presentation closure and occlusion (`ViewerViewport.tsx:632-635,713-759`).

## 4. Shape coverage matrix

**Rating rules:** correct = the focal shape/placement behavior encoded by this case is represented correctly; partly wrong = recognizable shape but material placement, topology, warning, or assembly defects remain; broken = the defining requested shape is not represented; crash = preparation/build/render cannot produce the case. A correct simple case does not certify every edge, label, takeoff, or unsupported feature. Schema-valid does not mean spatially complete: each synthetic case includes its expressiveness limits. Ratings are authored from runtime geometry and the captures, not inferred from “no exception”.

### Synthetic shapes

| Shape | Expected geometry | Observed geometry and rating | Screenshot filenames (initial / orbit) |
|---|---|---|---|
| Rectangle footprint | Extrude every footprint segment; preserve the rectangle footprint outline rather than replacing it with its bounding rectangle. | **correct** — Four walls close the 12000×8000 rectangular body; paired roofs meet at z=9000 over eaves z=6000. This verifies the rectangular focal shape, not opposite-rake disambiguation. | [footprint-rectangle-initial.png](diagnose/2026-09-23/footprint-rectangle-initial.png)<br>[footprint-rectangle-orbit.png](diagnose/2026-09-23/footprint-rectangle-orbit.png) |
| L-shaped footprint | Extrude every footprint segment; preserve the l-shaped footprint outline rather than replacing it with its bounding rectangle. | **broken** — Six wall IDs survive but their offsets/concavity do not; two roof rectangles span the full 12000×9000 envelope. Recess and wing junction are lost. | [footprint-l-shape-initial.png](diagnose/2026-09-23/footprint-l-shape-initial.png)<br>[footprint-l-shape-orbit.png](diagnose/2026-09-23/footprint-l-shape-orbit.png) |
| T-shaped footprint | Extrude every footprint segment; preserve the t-shaped footprint outline rather than replacing it with its bounding rectangle. | **broken** — Eight wall IDs map to four planes; roof spans a 12000×8000 rectangle instead of the T boundary. Overlapping gables and ground-reaching closure obscure the intended recesses. | [footprint-t-shape-initial.png](diagnose/2026-09-23/footprint-t-shape-initial.png)<br>[footprint-t-shape-orbit.png](diagnose/2026-09-23/footprint-t-shape-orbit.png) |
| U-shaped footprint | Extrude every footprint segment; preserve the u-shaped footprint outline rather than replacing it with its bounding rectangle. | **broken** — Eight wall IDs survive but the courtyard notch is not represented; roof fills the 12000×9000 envelope and wall segments overlap. | [footprint-u-shape-initial.png](diagnose/2026-09-23/footprint-u-shape-initial.png)<br>[footprint-u-shape-orbit.png](diagnose/2026-09-23/footprint-u-shape-orbit.png) |
| Two connected volumes of different heights | Show a 6 m-high main body joined to a distinct 3 m-high secondary volume with its own flat roof. | **partly wrong** — The rear AT-1 box keeps its 3000 mm height, but its RF-3 roof is placed centrally at the main 6000 mm eave, not atop the secondary volume. | [footprint-connected-heights-initial.png](diagnose/2026-09-23/footprint-connected-heights-initial.png)<br>[footprint-connected-heights-orbit.png](diagnose/2026-09-23/footprint-connected-heights-orbit.png) |
| Gable roof | Two slopes meeting at one ridge; gable triangles only on left and right walls. | **correct** — The supported symmetric X-ridge case closes at z=9000 with gables on the left/right walls and eaves at 6000. General arbitrary ridge orientation is not supported. | [roof-gable-initial.png](diagnose/2026-09-23/roof-gable-initial.png)<br>[roof-gable-orbit.png](diagnose/2026-09-23/roof-gable-orbit.png) |
| Hip roof | Four sloped facets, a shortened ridge and four hips; no vertical gable triangles. | **broken** — Four roof IDs become two full main gable slopes plus two central cross halves. No shortened hip ridge or four hip boundary edges; vertical presentation closure makes gable-like ends. | [roof-hip-initial.png](diagnose/2026-09-23/roof-hip-initial.png)<br>[roof-hip-orbit.png](diagnose/2026-09-23/roof-hip-orbit.png) |
| Half-hip roof | Partial gables capped by small hip facets; visibly different from both full gable and full hip. | **broken** — Main roof still runs full-width to a gable ridge; the extra facets sit centrally, not as clipped end caps. All four hip edges and the 9200 mm ridge are omitted. | [roof-half-hip-initial.png](diagnose/2026-09-23/roof-half-hip-initial.png)<br>[roof-half-hip-orbit.png](diagnose/2026-09-23/roof-half-hip-orbit.png) |
| Flat roof | One horizontal membrane facet at parapet height, with no ridge or gable. | **broken** — The single horizontal roof occupies only 12000×4000 of the 12000×8000 footprint; the other half remains open. Elevation is 6000 but full coverage is absent. | [roof-flat-initial.png](diagnose/2026-09-23/roof-flat-initial.png)<br>[roof-flat-orbit.png](diagnose/2026-09-23/roof-flat-orbit.png) |
| Shed mono-pitch roof | One continuous facet rising from the front eave to the higher back wall; no centered ridge. | **broken** — One slope runs from z=6000 to 8200 over only half the depth, ending at the center instead of the far side. The other half is uncovered; rake edges are omitted. | [roof-shed-initial.png](diagnose/2026-09-23/roof-shed-initial.png)<br>[roof-shed-orbit.png](diagnose/2026-09-23/roof-shed-orbit.png) |
| Cross gable roof | Intersecting main and transverse gables with two valleys and two ridges. | **broken** — Extra roofs are centered area-derived intersecting halves (ridge about 7545.6), not a connected transverse roof; valleys and second measured ridge are omitted. | [roof-cross-gable-initial.png](diagnose/2026-09-23/roof-cross-gable-initial.png)<br>[roof-cross-gable-orbit.png](diagnose/2026-09-23/roof-cross-gable-orbit.png) |
| Gable with a lower gable wing | A main gable plus a shorter attached wing with two roof facets and its own lower ridge. | **broken** — The 3200 mm wing box is present but its roofs start at main eave 6000 and peak about 8010.7 centrally rather than closing the lower wing. | [roof-lower-gable-wing-initial.png](diagnose/2026-09-23/roof-lower-gable-wing-initial.png)<br>[roof-lower-gable-wing-orbit.png](diagnose/2026-09-23/roof-lower-gable-wing-orbit.png) |
| Attached garage with flat roof | Attached right-side garage at its measured 6.5 x 6.5 x 3 m size, capped by its RF-3 flat roof. | **broken** — The 6500×6500×3000 box is retained, but RF-3 covers only half its inferred roof width and sits at z=6000, leaving a 3000 mm height mismatch and wrong alignment. | [attachment-garage-flat-initial.png](diagnose/2026-09-23/attachment-garage-flat-initial.png)<br>[attachment-garage-flat-orbit.png](diagnose/2026-09-23/attachment-garage-flat-orbit.png) |
| Attached garage with its own gable roof | Attached right-side garage with a separate lower gable roof RF-3/RF-4, not a copy of the main roof. | **broken** — Garage box keeps its 3000 mm height, but its separate roof eave is 6000 and ridge 8437.5. The box and roof do not form one owned volume. | [attachment-garage-gable-initial.png](diagnose/2026-09-23/attachment-garage-gable-initial.png)<br>[attachment-garage-gable-orbit.png](diagnose/2026-09-23/attachment-garage-gable-orbit.png) |
| Detached garage | A separate 6 x 6 x 3 m garage, not touching the house. | **broken** — attached=false is ignored: the garage is placed against the main side boundary and its roofs still start at main eave 6000. Exact site position is not expressible by the schema, but touching the host is not a justified fallback. | [attachment-garage-detached-initial.png](diagnose/2026-09-23/attachment-garage-detached-initial.png)<br>[attachment-garage-detached-orbit.png](diagnose/2026-09-23/attachment-garage-detached-orbit.png) |
| One-story annex | A 3 m-high rear annex with a distinct flat roof. | **partly wrong** — Rear parent placement and 3000 mm box height are honored. Owned RF-3 instead becomes a central-front horizontal patch at z=6000; no coherent own roof/wall assembly. | [attachment-annex-one-story-initial.png](diagnose/2026-09-23/attachment-annex-one-story-initial.png)<br>[attachment-annex-one-story-orbit.png](diagnose/2026-09-23/attachment-annex-one-story-orbit.png) |
| Two-story annex | A 6 m-high rear annex, visibly taller than the one-story case, with a distinct flat roof. | **partly wrong** — Rear box height changes to 6000 as measured, unlike the one-story case; its roof remains the same unrelated central patch, not the rear volume boundary. | [attachment-annex-two-story-initial.png](diagnose/2026-09-23/attachment-annex-two-story-initial.png)<br>[attachment-annex-two-story-orbit.png](diagnose/2026-09-23/attachment-annex-two-story-orbit.png) |
| Entrance canopy | A thin 250 mm canopy projecting 1.6 m from WL-1, not a room-sized box. | **partly wrong** — Thin canopy box is preserved at z=3000…3250 and depth 1600, disproving mandatory thickening. Its named covering RF-3 is misplaced at z=6000 on the main body. | [attachment-entrance-canopy-initial.png](diagnose/2026-09-23/attachment-entrance-canopy-initial.png)<br>[attachment-entrance-canopy-orbit.png](diagnose/2026-09-23/attachment-entrance-canopy-orbit.png) |
| Porch | A 5 x 2.5 m one-story front porch with its own flat roof. | **partly wrong** — Measured 5000×2500×2800 projection is present as a solid box; its flat roof is displaced to the main eave. Open sides/supports cannot be described by this fixture's schema fields. | [attachment-porch-initial.png](diagnose/2026-09-23/attachment-porch-initial.png)<br>[attachment-porch-orbit.png](diagnose/2026-09-23/attachment-porch-orbit.png) |
| Bay window | A shallow 0.9 m projection from WL-1, retaining the measured 2.4 m width. | **partly wrong** — Width 2400 and shallow depth 900 survive, but it is a solid type-colored box and its named roof is at z=6000 elsewhere. No bay-angle/glazing topology is supplied. | [attachment-bay-window-initial.png](diagnose/2026-09-23/attachment-bay-window-initial.png)<br>[attachment-bay-window-orbit.png](diagnose/2026-09-23/attachment-bay-window-orbit.png) |
| Gable dormer | A roof-mounted dormer with a peaked gable roof at RF-1 position. | **broken** — Dormer is a slope-based vertically extruded box with no peaked own roof; dormer.style=gable and face_pitch_deg=35 have no effect. | [attachment-dormer-gable-initial.png](diagnose/2026-09-23/attachment-dormer-gable-initial.png)<br>[attachment-dormer-gable-orbit.png](diagnose/2026-09-23/attachment-dormer-gable-orbit.png) |
| Shed dormer | A wider roof-mounted dormer with one 12-degree mono-pitch roof, distinct from the gable dormer. | **broken** — Dormer uses the same generic box construction as the gable dormer; its declared 12-degree shed face pitch is ignored. Dimension differences alone distinguish the fixtures. | [attachment-dormer-shed-initial.png](diagnose/2026-09-23/attachment-dormer-shed-initial.png)<br>[attachment-dormer-shed-orbit.png](diagnose/2026-09-23/attachment-dormer-shed-orbit.png) |
| Balcony | A shallow elevated platform on WL-1 at y=3.3 m, not a ground-level solid addition. | **partly wrong** — Mounting z=3300 is preserved, but the entire 1100 mm height becomes a solid block through z=4400 instead of a slab/railing assembly. The latter detail is absent from schema. | [attachment-balcony-initial.png](diagnose/2026-09-23/attachment-balcony-initial.png)<br>[attachment-balcony-orbit.png](diagnose/2026-09-23/attachment-balcony-orbit.png) |
| Awning | A 180 mm-thick wall-mounted awning projecting 1.2 m, with its own RF-3 covering plane. | **partly wrong** — Positive depth 1200 and thickness 180 are retained at z=3000…3180. The separately linked RF-3 covering is placed on the main body at z=6000 instead of on the awning. | [attachment-awning-initial.png](diagnose/2026-09-23/attachment-awning-initial.png)<br>[attachment-awning-orbit.png](diagnose/2026-09-23/attachment-awning-orbit.png) |
| Flat panel on a wall | A 100 mm-deep 2.4 x 1.2 m panel mounted on WL-1 at y=3.3 m; do not inflate it into a box. | **correct** — The wall-mounted 2400×1200 panel stays 100 mm deep at x=4200…6600, y=-100…0, z=3300…4500. No minimum-depth cube is introduced. | [attachment-wall-panel-initial.png](diagnose/2026-09-23/attachment-wall-panel-initial.png)<br>[attachment-wall-panel-orbit.png](diagnose/2026-09-23/attachment-wall-panel-orbit.png) |
| Chimney | A 0.9 x 0.7 m chimney rising 1.8 m above RF-1 at the stated roof-relative position. | **partly wrong** — Position is evaluated on the parent roof, but the box base/top follow roof slope with vertical extrusion: z bounds 6720…8940 exceed the nominal 1800 height. No level cap/roof penetration geometry is modeled. | [attachment-chimney-initial.png](diagnose/2026-09-23/attachment-chimney-initial.png)<br>[attachment-chimney-orbit.png](diagnose/2026-09-23/attachment-chimney-orbit.png) |
| Sloped site with per-side eave heights | Respect four grade offsets and side-specific eave heights; wall bottoms follow grade while roof eaves remain coherent. | **broken** — Per-side grade offsets are ignored: every wall still starts at z=0, with unchanged 6000 mm wall height, while global roof eave is 7200. Closure fills the inconsistency rather than representing slope. | [special-sloped-site-initial.png](diagnose/2026-09-23/special-sloped-site-initial.png)<br>[special-sloped-site-orbit.png](diagnose/2026-09-23/special-sloped-site-orbit.png) |
| Measurement without footprint outline | Degrade to the declared 12 x 8 m width/depth rectangle and issue a visible approximation warning rather than crash. | **partly wrong** — Declared 12000×8000 scalars yield a plausible rectangle without crashing. No missing-outline diagnostic is generated while the footprint object exists. The fixture pre-seeds an approximation warning; this does not test automatic warning generation or its visibility in the full product UI. | [special-no-footprint-initial.png](diagnose/2026-09-23/special-no-footprint-initial.png)<br>[special-no-footprint-orbit.png](diagnose/2026-09-23/special-no-footprint-orbit.png) |
| Attachment with missing dimensions | Keep the main house valid, omit or visibly placeholder the underdetermined addition, and identify AT-1 in a warning. | **partly wrong** — Geometry degrades safely: main house survives and AT-1 is omitted. An internal note names AT-1, but production warning presentation reduces model notes to generic categories without that ID. Fixture-authored warning text supplies the ID; viewport screenshots do not verify warning-panel visibility. Missing height/depth alone still default to width. | [special-missing-attachment-dimensions-initial.png](diagnose/2026-09-23/special-missing-attachment-dimensions-initial.png)<br>[special-missing-attachment-dimensions-orbit.png](diagnose/2026-09-23/special-missing-attachment-dimensions-orbit.png) |

### What the synthetic data cannot express

- **Rectangle footprint:** v1.7 supplies footprint points but does not map each wall face to a specific point pair; repeated cardinal elevations are the only available hint.
- **L-shaped footprint:** v1.7 supplies footprint points but does not map each wall face to a specific point pair; repeated cardinal elevations are the only available hint.
- **T-shaped footprint:** v1.7 supplies footprint points but does not map each wall face to a specific point pair; repeated cardinal elevations are the only available hint.
- **U-shaped footprint:** v1.7 supplies footprint points but does not map each wall face to a specific point pair; repeated cardinal elevations are the only available hint.
- **Two connected volumes of different heights:** v1.7 has no attachment story count, attachment wall-face linkage, attachment footprint polygon, or attachment eave/ridge heights; only dimensions and parent links encode this case.
- **Gable roof:** Face records have no boundary vertices or edge-to-face links.
- **Hip roof:** The schema identifies hip edge lengths but not their endpoints or incident faces.
- **Half-hip roof:** v1.7 calls half-hip jerkinhead and has no facet topology or explicit half-hip run.
- **Flat roof:** Parapet plan geometry and drainage slope are not represented.
- **Shed mono-pitch roof:** Per-elevation height can state high/low sides but roof face boundaries are absent.
- **Cross gable roof:** roof_type must be other; v1.7 cannot associate roof facets, valleys and ridges into topology.
- **Gable with a lower gable wing:** The attachment has dimensions and parent roof faces, but v1.7 has no attachment ridge/eave height fields or explicit roof topology.
- **Attached garage with flat roof:** Garage is represented as generic addition because v1.7 has no garage attachment type or attachment wall linkage.
- **Attached garage with its own gable roof:** No attachment eave/ridge heights or facet topology are available.
- **Detached garage:** v1.7 position_mm is parent-face-relative and provides no site coordinate system for detached objects; exact detached placement is unknowable.
- **One-story annex:** No attachment story count, wall-face ownership or roof elevation is declared by v1.7.
- **Two-story annex:** Story count and floor levels are not fields on attachments; height is the only discriminator.
- **Entrance canopy:** Canopy has no dedicated attachment type; type other plus dimensions is the only schema-valid representation.
- **Porch:** Porch has no dedicated type or open/closed/support geometry in v1.7.
- **Bay window:** v1.7 does not describe bay side-wall angles or bay footprint.
- **Gable dormer:** Dormer style and face pitch exist, but dimensions do not encode dormer roof ridge/eave or cheek topology.
- **Shed dormer:** Dormer face_pitch_deg does not define roof direction or facet boundaries.
- **Balcony:** Railings, slab thickness and supports have no declared fields.
- **Awning:** Slope/direction for non-dormer attachment roofs can only be inferred from the parent roof-face pitch record.
- **Flat panel on a wall:** Panel has no dedicated type, orientation or surface-normal field; type other and parent wall are the available representation.
- **Chimney:** Roof-relative x/y has no facet coordinate frame or surface equation in v1.7, so world placement cannot be exact.
- **Sloped site with per-side eave heights:** v1.7 provides per-elevation values but no grade polyline or per-footprint-vertex elevations, so corners with differing offsets are underdetermined.
- **Measurement without footprint outline:** The schema allows footprint.points to be absent; without it, only a rectangular width/depth fallback can be justified.
- **Attachment with missing dimensions:** Attachment dimension fields are nullable; there is no schema-defined default size and inventing one would be misleading.

### Existing measurements and control fixture

Expected baselines below are inferred from stored dimensions, types, and relationships—not independently remeasured photographic ground truth. Missing topology limits the exact expected reconstruction; a plausible interpretation must still preserve explicit constraints or identify uncertainty.

| Input | Expected baseline | Rating and observed geometry | Screenshot filenames (initial / orbit) |
|---|---|---|---|
| scripts/diagnose/real/536235c3-131d-4279-92b0-007c9cea831b.json | A 12940×10000 main hip-roof body, ten independently placed measured walls, rear annex and 2920 mm garage with RF-5's own 3.4° roof; retain per-side grade/eave relationships. | **broken** — All ten walls retained, three overlapping pairs; hip facets misassigned and garage roof RF-5 detached from its 2920 mm volume. Roof-colored closure reaches grade and source secondary colors create translucent triangles. | [real-536235c3-131d-4279-92b0-007c9cea831b-initial.png](diagnose/2026-09-23/real-536235c3-131d-4279-92b0-007c9cea831b-initial.png)<br>[real-536235c3-131d-4279-92b0-007c9cea831b-orbit.png](diagnose/2026-09-23/real-536235c3-131d-4279-92b0-007c9cea831b-orbit.png) |
| scripts/diagnose/real/82a4d3a3-053e-47d6-9494-49c76509ea60.json | A 14000×11500 hip-roof main volume, lower 2700 mm left annex, and a detached garage-like volume whose exact site position must remain unresolved rather than invented. | **broken** — Six wall IDs retained, but hip roof remains the gable/cross template, lower addition walls overlap main planes, and detached other-type garage falls back to origin massing. | [real-82a4d3a3-053e-47d6-9494-49c76509ea60-initial.png](diagnose/2026-09-23/real-82a4d3a3-053e-47d6-9494-49c76509ea60-initial.png)<br>[real-82a4d3a3-053e-47d6-9494-49c76509ea60-orbit.png](diagnose/2026-09-23/real-82a4d3a3-053e-47d6-9494-49c76509ea60-orbit.png) |
| scripts/diagnose/real/a847416a-6f1c-478f-817c-371896023124.json | A 12940×10000 hip-roof body with eight measured walls, a 2920 mm garage and 5395 mm rear annex, with their openings retained on their respective surfaces. | **broken** — Eight walls retained but lower garage/annex and main hip are not a connected topology; intersecting roof/closure and translucent wall regions are visible. | [real-a847416a-6f1c-478f-817c-371896023124-initial.png](diagnose/2026-09-23/real-a847416a-6f1c-478f-817c-371896023124-initial.png)<br>[real-a847416a-6f1c-478f-817c-371896023124-orbit.png](diagnose/2026-09-23/real-a847416a-6f1c-478f-817c-371896023124-orbit.png) |
| scripts/diagnose/real/d165c333-6125-4294-bd79-fb1c9c185568.json | Front/back gables of 6300 mm above 4400 mm wall rectangles joined by the correct ridge; separately mounted entrance/awning/dormer volumes and 100 mm solar panels. Flag missing awning depth. | **broken** — Five walls retained; front/back 6300 mm gables disagree with X-oriented roof ridge. AT-9 missing depth becomes 5000; solar panel depth remains 100. Four soffit/fascia faces, AT-6 and CA-4 absent. | [real-d165c333-6125-4294-bd79-fb1c9c185568-initial.png](diagnose/2026-09-23/real-d165c333-6125-4294-bd79-fb1c9c185568-initial.png)<br>[real-d165c333-6125-4294-bd79-fb1c9c185568-orbit.png](diagnose/2026-09-23/real-d165c333-6125-4294-bd79-fb1c9c185568-orbit.png) |
| export-messungen/leipzig-photo.json | A 12100×11200 hip-roof main body with independently placed side additions and roof obstacles; report absent wall spans or ambiguous topology rather than treat array order as location. | **broken** — Rectangular gable/cross template replaces hip/secondary roofs; opaque proxies and translucent overlapping surfaces disagree. Reversing side-addition order changes RF-3/RF-4 coordinates. | [export-leipzig-photo-initial.png](diagnose/2026-09-23/export-leipzig-photo-initial.png)<br>[export-leipzig-photo-orbit.png](diagnose/2026-09-23/export-leipzig-photo-orbit.png) |
| export-messungen/leipzig-plan.json | A 12940×10000 hip-roof main body with ten wall faces assigned to main/secondary volumes, consistent own roofs, openings and elevations. | **broken** — Ten walls survive but eight coplanar envelope-overlap pairs are detected; side volumes and multiple roof facets do not form a coherent hip-roof assembly. | [export-leipzig-plan-initial.png](diagnose/2026-09-23/export-leipzig-plan-initial.png)<br>[export-leipzig-plan-orbit.png](diagnose/2026-09-23/export-leipzig-plan-orbit.png) |
| export-messungen/neuengamme-mixed.json | A 12400×10800 compound-roof body consistent with two measured ridges, hip/valley edges and attached features; unresolved face widths/topology must be disclosed. | **broken** — Wall widths are missing and inferred from the envelope; compound roof topology is guessed from areas. Two ridges, hip and valley edges fail placement despite retaining their takeoff values. | [export-neuengamme-mixed-initial.png](diagnose/2026-09-23/export-neuengamme-mixed-initial.png)<br>[export-neuengamme-mixed-orbit.png](diagnose/2026-09-23/export-neuengamme-mixed-orbit.png) |
| export-messungen/neuengamme-photo.json | A 14100×9500 compound-roof body with distinct connected roof patches and correctly mounted secondary features; missing dimensions should remain identified as assumptions. | **broken** — Four walls are inferred from envelope spans; additional roofs become intersecting central surfaces, not a solved compound topology. Unmeasured closures mask missing roof-wall contacts. | [export-neuengamme-photo-initial.png](diagnose/2026-09-23/export-neuengamme-photo-initial.png)<br>[export-neuengamme-photo-orbit.png](diagnose/2026-09-23/export-neuengamme-photo-orbit.png) |
| fixtures/garage-house.json | Recognizable main gable plus lower side garage, six wall faces, separate small cross-roof facets, parent-linked openings, and truthful omission/uncertainty for unsupported detail. | **partly wrong** — The main gable and lower side garage are recognizable; all six wall IDs survive without detected coplanar overlap. Secondary cross facets remain heuristic, 11 edges and soffit/fascia are omitted, and small penetration dimensions are guessed. | [fixture-garage-house-initial.png](diagnose/2026-09-23/fixture-garage-house-initial.png)<br>[fixture-garage-house-orbit.png](diagnose/2026-09-23/fixture-garage-house-orbit.png) |

Across all 38 inputs: 3 correct, 23 broken, 12 partly wrong. Ratings concern the current renderer, not the accuracy of AI extraction. All 76 captures have positive WebGL scene/pixel evidence.

## 5. Dropped elements per project

This is the static code-path inventory. It intentionally does **not** invent per-project dropped IDs.

1. **Whole preparation rejected:** nonobject raw input → unreadable; missing/unsupported schema metadata → older-version; normalization/calculation/cards exception → unreadable (P:461–494).
2. **Preparation collection filtering:** malformed collection, nonobject entry, missing required identity/class/type, duplicate ID → removed (P:43–76,215–301). Malformed optional nested values, points, references or warnings → stripped, one generic warning (P:87–199,302–359). A sanitized dimension is not the same as a removed face.
3. **Raw-builder collection filtering:** nonarray collection or nonobject entry → omitted; malformed ID → replaced by generated display ID (B:543–565). Unlike preparation, this does not deduplicate or require class/type. Footprint processing reads raw attachments before `modelParts` sanitizes them (B:330–338,1248–1258); malformed direct-builder input is therefore not guaranteed safe merely because its comment says it is.
4. **Face routing:** only exact `wall` and `roof_face` classes enter detailed construction (B:1248–1250). Other face classes are omitted from detailed geometry, or excluded from per-face display with possible whole-building fallback (B:1500–1513). Fascia and soffit are included in quantities but not detailed 3D.
5. **Walls:** no explicit recognized-wall drop branch in B:1273–1319. Every prepared recognized wall is pushed; overlap, zero height, wrong plane, occlusion and coincident IDs must be diagnosed separately.
6. **Roof simplification:** largest two main, up to two secondary, rest cross facets; all records are bucketed but not physically reconstructed (B:1321–1479). Degenerate span retained (B:595–597). The fallback loop skips an ID already represented, otherwise adds a square plane (B:1483–1494); this is not a general topology solver.
7. **Unsupported whole shape:** non-gable roof type adds only an internal note, while geometry remains the template (B:1496–1498). Its exact phrase “not a supported topology” does not contain the classifier substring “unsupported”; it becomes `general`/`model_note` (B:1164–1192), and neither diagnostic-category handling nor note regexes in W:23–48 expose it as a model UI warning. A flat roof can therefore be wrong with no model UI warning if no other warning-producing path fires. No special hip facet omission is necessary to explain a missing-looking roof slope.
8. **Attachment drop:** detailed proxy heuristic succeeds → omit proxy; width null/nonpositive → omit (B:996–1017). Missing/nonpositive height/depth → width substitution (B:1019–1023). Parentless fallback and generic boxes simplify retained objects (B:1032–1089).
9. **Opening drop/reparent/clamp:** invalid width/height → omit; no discoverable wall/roof parent → omit; invalid parent → guess another; position inference/clamping silently changes shape location with partial notes (B:400–444,893–961).
10. **Conditions:** invalid/nonpositive area → omit; no usable parent → omit; all other shapes replaced by squares with clipped coordinates (B:1103–1140).
11. **Edges:** no match within 20 mm, near-tied distinct candidates, no supported edge class, no matching roof ridge → null then filtered (B:708–781,783–839,1522–1524). Missing length becomes zero before matching and may still be omitted (B:795–796); note “retained as zero-length” does not guarantee final retention.
12. **Downspouts:** preparation and calculation retain/count them, but builder input/model has no downspout collection and buildModel never constructs them (P:295–301; D:300–303,341–345; I:85–103; T:146–169).
13. **Massing substitution:** absent footprint plus faces with no width or height → one first-face area-derived polygon (B:1514–1520,643–666), not all missing faces. Its first-face basis means record order can affect fallback appearance.
14. **Main-bounds exclusion:** max-x filtering only changes main bounds inputs, not output wall/roof arrays (B:1547–1555,1614–1622). Do not count these as dropped model faces.
15. **Closure exclusions:** zero-area projections, nonground attachment proxies and nonselected types are absent from closure source list; internal cell boundaries do not get seams; seam omitted if roof not above wall (C:127–154,292,339,364–376). These remove presentation surfaces, not source IDs.
16. **Rendering state/visibility:** not-ready/WebGL/controls failure stops painter creation (V:564–600); all model meshes are otherwise added (V:627–640). Conditions toggle independently; hidden conditions and condition hits during measuring are excluded from picking (V:641,728–730). Source hit behind closure is rejected; snap targets behind meshes are rejected (V:744–759). These are not builder drops.
17. **Dimensions:** null derived value produces no dimension (B:1596–1611); show-dimensions off/null/empty segments filters labels (O:154–165). Silhouette with fewer than three points aborts overlay placement (V:326–333).
18. **Diagnostic suppression:** duplicate code+ID notes collapse into one diagnostic; notes themselves deduplicate exact strings; UI returns at most three model category warnings (B:1193–1205,1633–1634; W:51–55). Complete reason accounting needs raw notes plus record comparison, not the visible warning alone.

### Warning visibility is a separate contract

The non-gable roof-type message is an internal model note classified as general; it does not match production warning-presentation rules. It generates no user-facing topology warning by itself. The executed flat-roof fixture does generate a generic approximation warning for a different reason: RF-1's front role was inferred from its ID. That is not detection of the missing half-roof. Other omitted faces or edges can still trigger generic omission warnings. The missing-dimensions case generates generic omission/missing-dimension categories, not an AT-1-specific explanation. The no-outline case generates no approximation category on its own. Both special fixtures contain authored source warnings: their presence must not be credited as automatic detection. These conclusions are checked by invoking the actual presentViewerWarnings function in validate-deliverables.ts; viewport screenshots do not show the product warning panel.

### Actual ID accounting

“Dropped” below means absent from builder output, not merely hidden from a camera. Suppressed attachment proxies are listed separately through their exact reason; suppression is not proof that the other geometry represents the attachment correctly. Soffit/fascia remain calculation records but have no model surface. Roof aliases are counted once. Downspouts have no builder collection at all.

### real-536235c3-131d-4279-92b0-007c9cea831b

Source: `scripts/diagnose/real/536235c3-131d-4279-92b0-007c9cea831b.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 18 / 18 / 16 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 25 / 25 / 11 | **E-1**: E-1: no measured ridge geometry matches 3080 mm; omitted rather than placed falsely.<br>**E-2**: E-2: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-2: no measured hip geometry matches 9281 mm on roof; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 9281 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 9281 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-5: no measured hip geometry matches 9281 mm on roof; omitted rather than placed falsely.<br>**E-6**: E-6: no measured eave geometry matches 14245 mm on front; omitted rather than placed falsely.<br>**E-7**: E-7: no measured eave geometry matches 14245 mm on back; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 11165 mm on left; omitted rather than placed falsely.<br>**E-9**: E-9: no measured eave geometry matches 11165 mm on right; omitted rather than placed falsely.<br>**E-11**: E-11: no measured unclassified geometry matches 3520 mm on front; omitted rather than placed falsely.; E-11: unclassified has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-12**: E-12: no measured unclassified geometry matches 6355 mm on right; omitted rather than placed falsely.; E-12: unclassified has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-13**: E-13: no measured unclassified geometry matches 5600 mm on back; omitted rather than placed falsely.; E-13: unclassified has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-14**: E-14: no measured unclassified geometry matches 2875 mm on right; omitted rather than placed falsely.; E-14: unclassified has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-15**: E-15: no measured unclassified geometry matches 2875 mm on left; omitted rather than placed falsely.; E-15: unclassified has no unambiguous measured placement; omitted rather than placed falsely. |
| openings | 36 / 36 / 36 | None |
| attachments | 10 / 10 / 9 | **AT-2**: AT-2: detailed wall and roof geometry already represents this addition; attachment proxy omitted. |
| conditions | 3 / 3 / 3 | None |
| downspouts | 3 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [real-536235c3-131d-4279-92b0-007c9cea831b-initial.png](diagnose/2026-09-23/real-536235c3-131d-4279-92b0-007c9cea831b-initial.png)<br>[real-536235c3-131d-4279-92b0-007c9cea831b-orbit.png](diagnose/2026-09-23/real-536235c3-131d-4279-92b0-007c9cea831b-orbit.png).

### real-82a4d3a3-053e-47d6-9494-49c76509ea60

Source: `scripts/diagnose/real/82a4d3a3-053e-47d6-9494-49c76509ea60.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 13 / 13 / 11 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 16 / 16 / 10 | **E-1**: E-1: no measured ridge geometry matches 5400 mm; omitted rather than placed falsely.<br>**E-2**: E-2: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-2: no measured hip geometry matches 8420 mm on roof; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 8420 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 8420 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-5: no measured hip geometry matches 8420 mm on roof; omitted rather than placed falsely.<br>**E-16**: E-16: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-16: no measured flashing geometry matches 5500 mm on left; omitted rather than placed falsely. |
| openings | 29 / 29 / 29 | None |
| attachments | 13 / 13 / 13 | None |
| conditions | 2 / 2 / 2 | None |
| downspouts | 3 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [real-82a4d3a3-053e-47d6-9494-49c76509ea60-initial.png](diagnose/2026-09-23/real-82a4d3a3-053e-47d6-9494-49c76509ea60-initial.png)<br>[real-82a4d3a3-053e-47d6-9494-49c76509ea60-orbit.png](diagnose/2026-09-23/real-82a4d3a3-053e-47d6-9494-49c76509ea60-orbit.png).

### real-a847416a-6f1c-478f-817c-371896023124

Source: `scripts/diagnose/real/a847416a-6f1c-478f-817c-371896023124.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 15 / 15 / 13 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 16 / 16 / 4 | **E-1**: E-1: no measured ridge geometry matches 3080 mm; omitted rather than placed falsely.<br>**E-2**: E-2: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-2: no measured hip geometry matches 9592 mm on roof; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 9592 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 9592 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-5: no measured hip geometry matches 9592 mm on roof; omitted rather than placed falsely.<br>**E-6**: E-6: no measured eave geometry matches 14245 mm on front; omitted rather than placed falsely.<br>**E-7**: E-7: no measured eave geometry matches 14245 mm on back; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 11165 mm on left; omitted rather than placed falsely.<br>**E-9**: E-9: no measured eave geometry matches 11165 mm on right; omitted rather than placed falsely.<br>**E-14**: E-14: no measured eave geometry matches 3520 mm on right; omitted rather than placed falsely.<br>**E-15**: E-15: no measured unclassified geometry matches 6010 mm on right; omitted rather than placed falsely.; E-15: unclassified has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-16**: E-16: no measured unclassified geometry matches 5600 mm on back; omitted rather than placed falsely.; E-16: unclassified has no unambiguous measured placement; omitted rather than placed falsely. |
| openings | 38 / 38 / 38 | None |
| attachments | 10 / 10 / 10 | None |
| conditions | 3 / 3 / 3 | None |
| downspouts | 3 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [real-a847416a-6f1c-478f-817c-371896023124-initial.png](diagnose/2026-09-23/real-a847416a-6f1c-478f-817c-371896023124-initial.png)<br>[real-a847416a-6f1c-478f-817c-371896023124-orbit.png](diagnose/2026-09-23/real-a847416a-6f1c-478f-817c-371896023124-orbit.png).

### real-d165c333-6125-4294-bd79-fb1c9c185568

Source: `scripts/diagnose/real/d165c333-6125-4294-bd79-fb1c9c185568.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 14 / 14 / 10 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**SF-2**: SF-2: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry.<br>**FC-2**: FC-2: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 20 / 20 / 11 | **E-1**: E-1: no measured ridge geometry matches 8700 mm; omitted rather than placed falsely.<br>**E-13**: E-13: no measured step_flashing geometry matches 2400 mm on left; omitted rather than placed falsely.; E-13: step_flashing has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-14**: E-14: no measured step_flashing geometry matches 2400 mm on left; omitted rather than placed falsely.; E-14: step_flashing has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-15**: E-15: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-15: no measured flashing geometry matches 2600 mm on left; omitted rather than placed falsely.<br>**E-16**: E-16: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-16: no measured flashing geometry matches 2400 mm on roof; omitted rather than placed falsely.<br>**E-17**: E-17: no measured eave geometry matches 2600 mm on front; omitted rather than placed falsely.<br>**E-18**: E-18: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-18: no measured flashing geometry matches 2600 mm on front; omitted rather than placed falsely.<br>**E-19**: E-19: no measured eave geometry matches 2400 mm on front; omitted rather than placed falsely.<br>**E-20**: E-20: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-20: no measured flashing geometry matches 2400 mm on front; omitted rather than placed falsely. |
| openings | 19 / 19 / 19 | None |
| attachments | 9 / 9 / 8 | **AT-6**: AT-6: missing width; omitted from geometry. |
| conditions | 4 / 4 / 3 | **CA-4**: CA-4: no parent face could be located; condition patch omitted. |
| downspouts | 3 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [real-d165c333-6125-4294-bd79-fb1c9c185568-initial.png](diagnose/2026-09-23/real-d165c333-6125-4294-bd79-fb1c9c185568-initial.png)<br>[real-d165c333-6125-4294-bd79-fb1c9c185568-orbit.png](diagnose/2026-09-23/real-d165c333-6125-4294-bd79-fb1c9c185568-orbit.png).

### export-leipzig-photo

Source: `export-messungen/leipzig-photo.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 10 / 10 / 8 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 14 / 14 / 0 | **E-1**: E-1: no measured ridge geometry matches 4500 mm; omitted rather than placed falsely.<br>**E-2**: E-2: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-2: no measured hip geometry matches 8207 mm on roof; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 8207 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 8207 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-5: no measured hip geometry matches 8207 mm on roof; omitted rather than placed falsely.<br>**E-6**: E-6: no measured eave geometry matches 13000 mm on front; omitted rather than placed falsely.<br>**E-7**: E-7: no measured eave geometry matches 13000 mm on back; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 12000 mm on left; omitted rather than placed falsely.<br>**E-9**: E-9: no measured eave geometry matches 12000 mm on right; omitted rather than placed falsely.<br>**E-10**: E-10: no measured outside_corner geometry matches 6950 mm on front; omitted rather than placed falsely.<br>**E-11**: E-11: no measured outside_corner geometry matches 6950 mm on front; omitted rather than placed falsely.<br>**E-12**: E-12: no measured outside_corner geometry matches 8450 mm on back; omitted rather than placed falsely.<br>**E-13**: E-13: no measured outside_corner geometry matches 8450 mm on back; omitted rather than placed falsely.<br>**E-14**: E-14: no measured eave geometry matches 5000 mm on left; omitted rather than placed falsely. |
| openings | 31 / 31 / 31 | None |
| attachments | 12 / 12 / 12 | None |
| conditions | 1 / 1 / 1 | None |
| downspouts | 3 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [export-leipzig-photo-initial.png](diagnose/2026-09-23/export-leipzig-photo-initial.png)<br>[export-leipzig-photo-orbit.png](diagnose/2026-09-23/export-leipzig-photo-orbit.png).

### export-leipzig-plan

Source: `export-messungen/leipzig-plan.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 23 / 23 / 15 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**SF-2**: SF-2: unsupported face class "soffit" omitted from detailed geometry.<br>**SF-3**: SF-3: unsupported face class "soffit" omitted from detailed geometry.<br>**SF-4**: SF-4: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry.<br>**FC-2**: FC-2: unsupported face class "fascia" omitted from detailed geometry.<br>**FC-3**: FC-3: unsupported face class "fascia" omitted from detailed geometry.<br>**FC-4**: FC-4: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 26 / 26 / 0 | **E-1**: E-1: no measured ridge geometry matches 3080 mm; omitted rather than placed falsely.<br>**E-2**: E-2: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-2: no measured hip geometry matches 9593 mm on roof; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 9593 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 9593 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-5: no measured hip geometry matches 9593 mm on roof; omitted rather than placed falsely.<br>**E-6**: E-6: no measured eave geometry matches 14245 mm on front; omitted rather than placed falsely.<br>**E-7**: E-7: no measured eave geometry matches 14245 mm on back; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 11165 mm on left; omitted rather than placed falsely.<br>**E-9**: E-9: no measured eave geometry matches 11165 mm on right; omitted rather than placed falsely.<br>**E-10**: E-10: no measured outside_corner geometry matches 7305 mm on front; omitted rather than placed falsely.<br>**E-11**: E-11: no measured outside_corner geometry matches 7305 mm on front; omitted rather than placed falsely.<br>**E-12**: E-12: no measured outside_corner geometry matches 7910 mm on back; omitted rather than placed falsely.<br>**E-13**: E-13: no measured outside_corner geometry matches 7910 mm on back; omitted rather than placed falsely.<br>**E-14**: E-14: no measured outside_corner geometry matches 4830 mm on back; omitted rather than placed falsely.<br>**E-15**: E-15: no measured outside_corner geometry matches 4830 mm on back; omitted rather than placed falsely.<br>**E-16**: E-16: no measured outside_corner geometry matches 2920 mm on front; omitted rather than placed falsely.<br>**E-17**: E-17: no measured outside_corner geometry matches 2540 mm on back; omitted rather than placed falsely.<br>**E-18**: E-18: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-18: no measured flashing geometry matches 5600 mm on back; omitted rather than placed falsely.<br>**E-19**: E-19: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-19: no measured flashing geometry matches 6415 mm on right; omitted rather than placed falsely.<br>**E-20**: E-20: base placement is ambiguous between WL-1, WL-5; omitted.<br>**E-21**: E-21: base placement is ambiguous between WL-2, WL-7, WL-8; omitted.<br>**E-22**: E-22: base placement is ambiguous between WL-3, WL-9; omitted.<br>**E-23**: E-23: base placement is ambiguous between WL-10, WL-4, WL-6; omitted.<br>**E-24**: E-24: no measured eave geometry matches 3520 mm on back; omitted rather than placed falsely.<br>**E-25**: E-25: no measured rake geometry matches 6425 mm on right; omitted rather than placed falsely.<br>**E-26**: E-26: no measured rake geometry matches 6425 mm on right; omitted rather than placed falsely. |
| openings | 36 / 36 / 36 | None |
| attachments | 7 / 7 / 7 | None |
| conditions | 0 / 0 / 0 | None |
| downspouts | 0 / retained by preparation / 0 | None supplied |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [export-leipzig-plan-initial.png](diagnose/2026-09-23/export-leipzig-plan-initial.png)<br>[export-leipzig-plan-orbit.png](diagnose/2026-09-23/export-leipzig-plan-orbit.png).

### export-neuengamme-mixed

Source: `export-messungen/neuengamme-mixed.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 11 / 11 / 9 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 20 / 20 / 0 | **E-1**: E-1: no measured ridge geometry matches 4000 mm; omitted rather than placed falsely.<br>**E-2**: E-2: no measured ridge geometry matches 11000 mm; omitted rather than placed falsely.<br>**E-3**: E-3: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-3: no measured hip geometry matches 9170 mm on roof; omitted rather than placed falsely.<br>**E-4**: E-4: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-4: no measured hip geometry matches 9170 mm on roof; omitted rather than placed falsely.<br>**E-5**: E-5: no measured valley geometry matches 5670 mm on roof; omitted rather than placed falsely.; E-5: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-6**: E-6: no measured valley geometry matches 5670 mm on roof; omitted rather than placed falsely.; E-6: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-7**: E-7: no measured eave geometry matches 6500 mm on front; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 6500 mm on back; omitted rather than placed falsely.<br>**E-9**: E-9: no measured eave geometry matches 11000 mm on left; omitted rather than placed falsely.<br>**E-10**: E-10: no measured eave geometry matches 11000 mm on right; omitted rather than placed falsely.<br>**E-11**: E-11: no measured eave geometry matches 2100 mm on front; omitted rather than placed falsely.<br>**E-12**: E-12: no measured eave geometry matches 2100 mm on back; omitted rather than placed falsely.<br>**E-13**: E-13: no measured rake geometry matches 4243 mm on front; omitted rather than placed falsely.<br>**E-14**: E-14: no measured rake geometry matches 4243 mm on front; omitted rather than placed falsely.<br>**E-15**: E-15: no measured rake geometry matches 4243 mm on back; omitted rather than placed falsely.<br>**E-16**: E-16: no measured rake geometry matches 4243 mm on back; omitted rather than placed falsely.<br>**E-17**: E-17: no measured outside_corner geometry matches 6100 mm on front; omitted rather than placed falsely.<br>**E-18**: E-18: no measured outside_corner geometry matches 7950 mm on front; omitted rather than placed falsely.<br>**E-19**: E-19: no measured outside_corner geometry matches 6100 mm on back; omitted rather than placed falsely.<br>**E-20**: E-20: no measured outside_corner geometry matches 7950 mm on back; omitted rather than placed falsely. |
| openings | 16 / 16 / 16 | None |
| attachments | 5 / 5 / 5 | None |
| conditions | 2 / 2 / 2 | None |
| downspouts | 1 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [export-neuengamme-mixed-initial.png](diagnose/2026-09-23/export-neuengamme-mixed-initial.png)<br>[export-neuengamme-mixed-orbit.png](diagnose/2026-09-23/export-neuengamme-mixed-orbit.png).

### export-neuengamme-photo

Source: `export-messungen/neuengamme-photo.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 11 / 11 / 9 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 18 / 18 / 2 | **E-1**: E-1: no measured ridge geometry matches 9000 mm; omitted rather than placed falsely.<br>**E-2**: E-2: no measured ridge geometry matches 9500 mm; omitted rather than placed falsely.<br>**E-3**: E-3: no measured eave geometry matches 9000 mm on back; omitted rather than placed falsely.<br>**E-4**: E-4: no measured eave geometry matches 9000 mm on front; omitted rather than placed falsely.<br>**E-6**: E-6: no measured rake geometry matches 4850 mm on front; omitted rather than placed falsely.<br>**E-7**: E-7: no measured rake geometry matches 4850 mm on front; omitted rather than placed falsely.<br>**E-8**: E-8: no measured rake geometry matches 4850 mm on back; omitted rather than placed falsely.<br>**E-9**: E-9: no measured rake geometry matches 4850 mm on back; omitted rather than placed falsely.<br>**E-10**: E-10: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-10: no measured hip geometry matches 7400 mm on roof; omitted rather than placed falsely.<br>**E-11**: E-11: hip has no unambiguous measured placement; omitted rather than placed falsely.; E-11: no measured hip geometry matches 7400 mm on roof; omitted rather than placed falsely.<br>**E-13**: E-13: no measured valley geometry matches 5000 mm on roof; omitted rather than placed falsely.; E-13: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-14**: E-14: no measured valley geometry matches 5000 mm on roof; omitted rather than placed falsely.; E-14: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-15**: E-15: no measured outside_corner geometry matches 7400 mm on back; omitted rather than placed falsely.<br>**E-16**: E-16: no measured outside_corner geometry matches 7400 mm on back; omitted rather than placed falsely.<br>**E-17**: E-17: no measured outside_corner geometry matches 6800 mm on front; omitted rather than placed falsely.<br>**E-18**: E-18: no measured outside_corner geometry matches 6800 mm on front; omitted rather than placed falsely. |
| openings | 16 / 16 / 16 | None |
| attachments | 6 / 6 / 6 | None |
| conditions | 2 / 2 / 2 | None |
| downspouts | 1 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [export-neuengamme-photo-initial.png](diagnose/2026-09-23/export-neuengamme-photo-initial.png)<br>[export-neuengamme-photo-orbit.png](diagnose/2026-09-23/export-neuengamme-photo-orbit.png).

### fixture-garage-house

Source: `fixtures/garage-house.json`. Preparation: **viewer**. Raw versus prepared complete model identical: **true**.

| Collection | Stored / prepared / modeled | Dropped IDs and exact reason |
|---|---|---|
| faces | 14 / 14 / 12 | **SF-1**: SF-1: unsupported face class "soffit" omitted from detailed geometry.<br>**FC-1**: FC-1: unsupported face class "fascia" omitted from detailed geometry. |
| edges | 34 / 34 / 23 | **E-2**: E-2: no measured ridge geometry matches 2438.4 mm; omitted rather than placed falsely.<br>**E-4**: E-4: no measured valley geometry matches 3099.8 mm on roof; omitted rather than placed falsely.; E-4: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-5**: E-5: no measured valley geometry matches 3099.8 mm on roof; omitted rather than placed falsely.; E-5: valley has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-8**: E-8: no measured eave geometry matches 2438.4 mm on front; omitted rather than placed falsely.<br>**E-10**: E-10: no measured eave geometry matches 2438.4 mm on back; omitted rather than placed falsely.<br>**E-15**: E-15: no measured rake geometry matches 2712.7 mm on front; omitted rather than placed falsely.<br>**E-16**: E-16: no measured rake geometry matches 2712.7 mm on front; omitted rather than placed falsely.<br>**E-19**: E-19: flashing has no unambiguous measured placement; omitted rather than placed falsely.; E-19: no measured flashing geometry matches 3810 mm on roof; omitted rather than placed falsely.<br>**E-20**: E-20: no measured step_flashing geometry matches 3048 mm on roof; omitted rather than placed falsely.; E-20: step_flashing has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-21**: E-21: no measured step_flashing geometry matches 2490.2 mm on roof; omitted rather than placed falsely.; E-21: step_flashing has no unambiguous measured placement; omitted rather than placed falsely.<br>**E-34**: E-34: no measured base geometry matches 3657.6 mm on front; omitted rather than placed falsely. |
| openings | 20 / 20 / 20 | None |
| attachments | 7 / 7 / 6 | **AT-7**: AT-7: detailed wall and roof geometry already represents this addition; attachment proxy omitted. |
| conditions | 2 / 2 / 2 | None |
| downspouts | 4 / retained by preparation / 0 | **DS-1**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-2**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-3**: no builder input/model collection or placement path (I:85–103; B:1242–1636).<br>**DS-4**: no builder input/model collection or placement path (I:85–103; B:1242–1636). |

Preparation removed IDs: **none**. Complete per-element notes, retained IDs, and bounds are in results.json; views: [fixture-garage-house-initial.png](diagnose/2026-09-23/fixture-garage-house-initial.png)<br>[fixture-garage-house-orbit.png](diagnose/2026-09-23/fixture-garage-house-orbit.png).

### Retained-but-wrong geometry and causal experiments


### Reproduction and scope

Run from repository root:

`pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json scripts/diagnose/causal-probes.ts`

The script imports the actual preparation function and model builder, not a reimplementation. It reads four real projects, all four `export-messungen/*.json` exports, and `fixtures/garage-house.json`. It writes only `scripts/diagnose/causal-results.json`. This report is separately authored. No product edits, input writes, database requests, API calls, screenshots or app execution are involved.

All coordinates below are model millimetres: **z is vertical**. JSON evidence is under `results[]`, selected by `path`; input SHA-256 values are included. Every perturbation starts from a fresh clone. `identicalFullModel` compares the entire serialized model; `identicalCanonicalGeometry` compares ID-sorted corner/segment geometry, excluding notes and array ordering. Both `roofFaces` and `roofs` are model aliases, not twice as many physical roofs.

### Braamheide: wrong ridge direction, not just 100 mm height mismatch

Source: `scripts/diagnose/real/d165c333-6125-4294-bd79-fb1c9c185568.json`, faces WL-1/WL-2; evidence: `walls.gables`, `roofs.model`.

Both walls retain 4400 mm rectangular height plus **6300 mm gable rise**. Their apex coordinates are **(5597,0,10700)** and **(5597,8600,10700)**. The main roof ridge runs instead from **(0,4300,10600)** to **(11194,4300,10600)**. At each gable apex's x/y, its main roof is at **z=4400**, leaving **6300 mm vertical separation**. The ridge is also 100 mm below the apex, but that small discrepancy is not the primary contact failure: the generated ridge is perpendicular to the direction needed to join these front/back gables.

Mechanism: `artifacts/aufmass-app/lib/viewer-next/model/buildModel.ts:1273–1314` retains measured gables, while `:1360–1380` always constructs main roof planes about `midY=depth/2`. This is direct numeric evidence; whether the original photo labels should have been different is outside these probes.

### Leipzig: retained walls are not correctly separated volumes

Source: `scripts/diagnose/real/536235c3-131d-4279-92b0-007c9cea831b.json`; evidence: `walls`.

**10 input wall records → 10 model walls; zero dropped.** Yet three pairs are coplanar overlapping rectangles:

| Pair | Shared plane | Shared horizontal interval | Shared z interval |
|---|---|---|---|
| WL-2 / WL-5 | y=10000 | x=0…5600 | 0…5490 |
| WL-3 / WL-6 | x=12940 | y=0…2875 | 0…5490 |
| WL-4 / WL-7 | x=0 | y=0…2875 | 0…5490 |

WL-8 is at y=0, x=12940…16460, z=0…2920. WL-9 is at x=16460, y=0…6355, z=0…2730. WL-10 is at y=10000, x=12940…16460, z=0…2540: that back wall is **3645 mm beyond** the side wall's y=6355 end. This is retained but inconsistently placed geometry, not a reduction to four wall records.

The other real Leipzig projects retain 6/6 and 8/8 walls; their overlap pairs are listed in the JSON. The older `export-messungen/leipzig-plan.json` also retains 10/10, but has eight envelope-overlap pairs, not the same geometry as the real 10-wall project. Generic overlap detection reports coplanar bounding-envelope overlaps, not exact polygon intersection areas; the three rectangles above permit the stronger rectangular-overlap statement.

Mechanism: `buildModel.ts:1281–1314` infers extensions by span matching and sets `baseHeight:0`; it does not use wall parent-attachment links.

### Attachments: actual dimensions and z placement

Braamheide (same real source as above):

* **AT-5:** supplied and modeled width/depth/height **2600/2600/2500**. Box spans **x=8000…10600, y=-2600…0, z=0…2500**. No evidence that this attachment is made giant by a missing-depth fallback.
* **AT-9:** supplied width **5000**, height **300**, depth absent. Modeled depth becomes **5000**, not 300. Box spans **x=-5000…0, y=1900…6900, z=3900…4200**. This awning is a 5 m deep horizontal block; its measured elevation is preserved.
* **AT-7 solar:** width/depth/height **2400/100/1722**, spans **x=5494…7894, y=8600…8700, z=6200…7922**.
* **AT-8 solar:** **4300/100/1134**, spans **x=3694…7994, y=8600…8700, z=4600…5734**.

Thus **the solar panels' supplied 100 mm depth is actually preserved**. A blanket claim that every thin element receives width-sized thickness is false. The relevant distinction is missing versus supplied positive depth.

IDs are project-local, not universal semantics. In real Leipzig `536235c3…`, AT-5 is a chimney, nominal **800/500/1500**, bounds **x=9600…10400, y=5000…5357.821, z=12225…14074.233**. AT-9 is a dormer, nominal **1500/1500/1800**, bounds **x=1740…3240, y=7924.637…8998.101, z=8322.854…11170.554**. Roof-mounted depth follows the sloping roof axis and height is added vertically, so the vertical bounding extent exceeds nominal height. These are not the Braamheide awning/box.

Mechanism: `buildModel.ts:1019–1049`: missing depth falls back to width; parent-wall placement uses `position_mm.y` as z; roof placement uses roof axes. No type-specific solar thickness override is needed to explain the 100 mm result.

### Leipzig garage: measured 2920 mm / 3.4° relationship is not honored

Source: real `536235c3…`, attachment AT-2, roof RF-5 and walls WL-8…WL-10.

AT-2 supplies **3520×6355×2920**, and RF-5 explicitly links to AT-2 with **3.4°** original pitch (snapped ratio **1/12**). Instead RF-5 becomes a central-front cross roof: **x=4105.174…6470, y=0…4729.651, z=7345…7542.069**. Its eave is **4425 mm above** the attachment's supplied 2920 mm height, and its x range is not the garage wall range **12940…16460**.

RF-3/RF-4 are selected for the side garage instead: eave **5490**, ridge **7103.333**, across x=12940…16460 and y=0…6355. The 5490 comes from another short wall rather than AT-2's height. Changing all addition heights by +1000 changes AT-1's box but **no roof coordinates** in this project. Changing all face/edge parent-attachment links leaves the **entire model identical**.

Mechanism: `buildModel.ts:1322–1357` takes the two largest roofs as main roofs and chooses remaining garage faces heuristically; `:1415–1484` determines garage eave from short-wall heights. `:567–575` reads snapped pitch, not original degrees. Changing degrees alone to 67° produces an identical full model. This proves original-degree insensitivity, not that all pitch inputs are ignored.

### Controlled perturbations across the nine inputs

* Replacing every face/edge `parent_attachment_id`: **full model identical for all nine**.
* Replacing `per_elevation` heights and grade offsets with large values: **full model identical for all nine**. Existing measured wall-height differences remain; this does not mean every elevation is drawn with the same height.
* Changing `roof_type`: **geometry identical for all nine**, but full model differs because the unsupported-topology note changes (`buildModel.ts:1496–1497`). Do not call the whole model identical.
* Reversing footprint points, or replacing them with a concave polygon of the same extents: **full model identical** for the four inputs with existing polygon points (real `536235c3…`, real `a847416a…`, Neuengamme photo export, garage fixture). Inputs without point polygons are explicitly not included in this test. Extents, not boundary shape, control this geometry (`buildModel.ts:300` onward).
* Reversing face arrays: canonical geometry unchanged in all nine, but serialized full model changes order. This is not evidence of geometric face-order dependence.
* Reversing attachment arrays: geometry unchanged for all four real projects and the garage fixture, but **changes RF-3/RF-4 in the Leipzig photo export**. Baseline roofs span x=12100…14600, y=0…2000, z=6900…8566.667. After reversal they span **x=-5000…0, y=0…3000, z=6900…10233.333**. The first matching side addition is selected by `.find` (`buildModel.ts:1328`); two eligible additions make array order material.
* Appending `A` to roof IDs and remapping parent-face references changes **actual corner coordinates**, not merely IDs, in all nine inputs. `coordinateChangedParts` matches each renamed ID to its original before comparing corners. Real Braamheide RF-3/RF-4/RF-5 switch sides; real Leipzig `536235c3…` RF-3…RF-6 switch sides. Character-code parity (`buildModel.ts:1208–1210`, `:1412`, `:1465–1472`) and stable ID ordering supply placement decisions.

### Limits and hypothesis boundary

These measurements establish deterministic builder/preparation mechanisms, not screenshot occlusion, renderer clipping, photographic ground truth, or accuracy of upstream extraction. The garage fixture is a control for the builder's supported heuristics, not proof that real hip roofs or compound footprints work. Its six walls are retained without detected coplanar overlaps; parent links, per-elevation values and same-extents concavity still have no effect. No fixes are proposed or applied here.

### Follow-up: actual presentation closure and material execution

The script now additionally imports and executes **buildPresentationClosure**, **polygonMaterial**, and **polygonGeometry**. No WebGL renderer or browser is needed to instantiate these geometry/material resources; all are disposed after recording. Existing result fields and perturbations remain intact. New JSON fields are `closure`, `structuralMaterials`, `secondaryColorInventory`, and `annexOpenings`. `closure.parts` contains **every generated mesh's stable element ID, full corners, bounds, colors and actual material properties** for all nine datasets. These are model/element IDs, not randomly allocated Three.js object UUIDs. Viewport source `components/viewer-next/ViewerViewport.tsx:632–634` confirms it adds these closure polygons to the rendered geometry.

### Closure counts and roof-to-ground evidence

| Input (real UUID prefix or export) | Total closure meshes | Ground caps | Vertical seams | Roof minimum z | Seam minimum z | Closure bounds min → max |
|---|---:|---:|---:|---:|---:|---|
| real 536235c3 | 56 | 41 | 15 | 5490 | **0** | (0,0,0) → (16460,12875,12224.024) |
| real 82a4d3a3 | 45 | 30 | 15 | 2700 | **0** | (-5500,0,0) → (14500,11200,11599.232) |
| real a847416a | 55 | 37 | 18 | 5395 | **0** | (0,0,0) → (18950,12875,13354.024) |
| real d165c333, Braamheide | 30 | 20 | 10 | 4400 | **4400** | (0,0,0) → (11194,8600,10598.558) |
| Leipzig photo export | 28 | 14 | 14 | 6900 | **0** | (-3000,0,0) → (14600,11200,11499.179) |
| Leipzig plan export | 53 | 37 | 16 | 7345 | **0** | (-2030,0,0) → (19355,12875,12224.024) |
| Neuengamme mixed export | 28 | 20 | 8 | 6050 | **6050** | (0,-1200,0) → (12400,10800,10949.093) |
| Neuengamme photo export | 28 | 20 | 8 | 7050 | **7050** | (0,-1300,0) → (14100,9500,12079.653) |
| garage-house fixture | 27 | 24 | 3 | 2743.2 | **0** | (0,0,0) → (18897.6,8534.4,6526.824) |

Ground caps are deliberately at z=0; their presence alone is **not** a roof-to-ground vertical face. Separating seam minimum from overall closure minimum matters.

For real Leipzig `536235c3…`, the two ground-reaching seams are:

* **presentation-seam-6-3-back:** x=12940…14700, y=6355, z=0…7102.417.
* **presentation-seam-7-3-back:** x=14700…16460, y=6355, z=0…7102.417.

Both have actual opaque material **#46464e**, opacity 1, depthWrite true. These are roof-colored vertical curtains down to grade, despite all source roof polygons starting at z≥5490. The generated garage back wall WL-10 is at **y=10000**, not at these seams' y=6355. `model/closure.ts:197–228` uses `baseZ` when no matching wall height is found; `:270–301` then joins that bottom to roof height. This proves a geometry mechanism for apparent roof-to-ground surfaces without claiming the measured roof itself descends to grade.

Braamheide is different: its seams start at **z=4400**, not ground. For example **presentation-seam-0-3-left** spans x=0, y=2645.751…4300, z=4400…10598.558, with roof color **#4b4b48**. Corresponding right seam **presentation-seam-3-3-right** lies at x=11194. Thus the closure fills the wrongly oriented roof's side gables with dark roof-colored faces; a literal roof-to-ground seam is **not supported** for this input.

### Wall translucency: measured material behavior, not a hypothesis

`renderResources.ts:68–78` assigns alternating triangle groups when a non-glazing polygon has `secondaryHex`. `:82–113` makes the base structural material opaque but the secondary material **transparent=true, opacity=0.42, depthWrite=true**. The probes instantiate these actual functions and record the groups and material values; this is not inferred solely from source text.

| Input | Wall IDs with actual translucent secondary material |
|---|---|
| real 536235c3 | WL-1,2,3,4,5,6,9,10 |
| real 82a4d3a3 | WL-1,2,3,4,5,6 |
| real a847416a | WL-1,2,3,4,5,6,7,8 |
| Braamheide | WL-1,2,3,4 |
| Leipzig photo export | WL-1,2,3,4 |
| Leipzig plan export | WL-1,2,3,4 |
| Neuengamme mixed / photo exports | WL-1,2 in each |
| garage fixture | WL-5,6 |

Examples of actual source `secondary_hex`: real Leipzig `536235c3…` WL-1…5 and WL-9/10 use **#5A3A32**, WL-6 uses **#C7B893**; Braamheide WL-1…3 use **#BFBFBF**, WL-4 **#9A9A94**; fixture WL-5/6 use **#8A8378**. The JSON inventories every source face color alongside its effective model color. In both Neuengamme exports WL-4 has a source secondary color but is not in the translucent list: model color neutralization suppresses it. Therefore source color presence alone does not establish rendered transparency.

This establishes **partial triangle translucency**, not uniformly transparent walls or physically modeled masonry accents. Glazing is separate: tested windows use a single **#dce8f2** material, transparent=true, opacity **0.38**, depthWrite=false. Closure material output is recorded separately; the ground-reaching Leipzig seams above are opaque.

### Leipzig annex windows exist, but not on the projecting proxy exterior

Real `536235c3…` contains, and the actual prepared model retains:

| Opening | Parent | Actual model bounds |
|---|---|---|
| W-21, window | WL-5 | x=400…5200, **y=10000**, z=2900…4800 |
| W-22, window | WL-6 | **x=12940**, y=450…2450, z=2900…4500 |
| D-3, door | WL-6 | **x=12940**, y=600…1500, z=0…1950 |

No source opening has parent **WL-7** in this input. W-21 and W-22 are present, not omitted for missing data. WL-5 and WL-6 are the overlapping wall planes documented earlier; they do not surround the projecting AT-1 proxy. AT-1 spans **x=1490…7090, y=10000…12875, z=0…5490**, is an opaque **#a6adb5** addition box, and has no modeled openings on its exterior y=12875 plane. W-21 lies at its attachment/base plane y=10000, with partial x overlap; W-22 lies far away at x=12940. This numeric mismatch explains why retaining window records does not ensure windows on the visible annex exterior. Exact camera-dependent occlusion is still not tested.

Annex wall materials also differ from the proxy: WL-5 uses base **#c7b893** plus translucent **#5a3a32**; WL-6 reverses those colors. WL-7 is single opaque **#8b9299**. AT-1's neutral solid proxy does not inherit these face treatments or their openings.

For comparison, real `82a4d3a3…` has four source/model opening records linked to WL-5/6/7 (D-3,W-16,D-4,W-18), and real `a847416a…` has six (D-2,W-15,W-16,W-17,D-3,G-1); all remain in the model. The two Leipzig exports have **zero explicit WL-5/6/7 parent links**, which is a different input condition, not evidence that preparation dropped such links. Full opening-parent inventories, proxy bounds, wall colors and actual opening materials are included per input.

## 6. Symptom-to-cause map

| Reported symptom | Station and underlying cause | Runtime evidence / limits |
|---|---|---|
| Gable triangles float beside the house (Braamheide WL-1/WL-2, 6300 mm) | **MODEL BUILDER**, B9/B16/B17: gables remain on the measured elevation planes, while the main ridge always follows X at half-depth. No wall/roof contact constraint connects them. | Gable apices are (5597,0,10700) and (5597,8600,10700); the generated ridge is y=4300,z=10600. Roof height at apex XY is 4400: 6300 mm separation. The secondary 100 mm ridge/apex inconsistency does not explain the wrong direction. |
| Ten walls in data, fewer visible; omission warning | **MODEL BUILDER** B5–B7 and **RENDERING** R8/R13: retained wall faces can share a plane, while warnings also cover omitted edges, unsupported face classes, or suppressed proxies. **MEASUREMENT/preparation** can drop malformed records, but that is not what happened to these ten walls. | Real Leipzig has 10/10 model walls, including three overlapping rectangular pairs. Garage rear and side wall ends also disagree by 3645 mm. Exact absent IDs—not inferred from the generic warning—are listed in Section 5. |
| Attachments misplaced, floating, or underground (Braamheide AT-5/AT-9) | **MODEL BUILDER** B27–B33: generic box plus guessed missing depth; parent-frame origin and world-Z mounting are not reconciled with grade. **MEASUREMENT**: missing awning depth prevents exact recovery. | AT-5 is a 2600×2600×2500 box at z=0…2500; the alleged below-ground placement is not reproduced here. AT-9 is z=3900…4200 but its absent depth becomes 5000. AT-5's independently stored covering roof is not assembled onto its box. A general negative-position/grade risk is not evidence that this particular box is below ground. |
| Garage wrong height and roof (2920 mm, 3.4°) | **MODEL BUILDER** B15/B18–B23: ignores explicit roof ownership; chooses roof families from area/pitch heuristics and eave from unrelated short-wall heights. Original-degree pitch is ignored. No story-count sizing rule exists. | Leipzig AT-2 height is 2920; RF-5 names it but is drawn centrally at eave 7345. RF-3/RF-4 instead become the side garage roof at eave 5490. Changing attachment height does not move these roofs; changing parent-attachment links produces an identical model. |
| 100 mm panels become thick cubes | **MODEL BUILDER** B27/B31: thickness is guessed only when absent/nonpositive; roof-mounted boxes have generic slope-axis bases and vertical extrusion. **MEASUREMENT** must distinguish thickness/height/depth semantics. | Current Braamheide AT-7/AT-8 retain their positive 100 mm depth. The wall-panel synthetic case independently tests the same behavior. The reported cube symptom is not reproduced for these supplied dimensions; do not propose a fictitious minimum-thickness fix. |
| Annex has no windows/material | **MODEL BUILDER** B5/B35 and **MEASUREMENT** ownership gap: box proxies do not own independently measured wall faces/openings; face color is read but material is not; current schema describes attachment ownership only for roof faces. | Openings can survive but remain on an incorrectly located parent wall. Section 5's annex-detail probe separates existing face/opening data from appearance that the proxy never receives; this is not a universal claim that window input is absent. |
| Hip roof has vertical gables or missing roof facet | **MODEL BUILDER** B9/B17/B22–B24 plus **RENDERING** R6: roof type changes only an internal model note, not topology; extra facets become cross-roof halves and may overlap; closure fills gaps with vertical seams. | The hip case is executed, not merely rejected as unsupported. Real roofs retain their IDs, so a missing-looking slope need not be a dropped record. The roof-type note itself is not promoted to a UI warning. Distinguish a positive measured gable from an unmeasured closure seam; neither is a correct hip solver. |
| Roof surfaces reach the ground | **MODEL BUILDER** B18/B21 and **RENDERING** R4–R7: invalid inferred eaves can lower roofs; independently, closure can create tall vertical surfaces from grade to roof when wall coverage is missing. | Roof and closure minimum-Z evidence is in Section 5. Ordinary main roof facets start at the global eave, so a grade-reaching seam must not be described as an actual sloped roof corner at zero. Pixel appearance alone cannot identify the mesh's ownership. |
| Walls see-through; overlap flickers | **RENDERING** R1: structural secondary-color triangles use alpha 0.42. **MODEL BUILDER** B5/B22 creates coincident/overlapping surfaces without shared topology. | Source material policy and actual secondary-color inventory identify conditional translucency; ordinary primary wall material is opaque. Coplanar overlaps are numerically proven. Still screenshots do not establish temporal flicker; camera depth precision is an aggravating hypothesis, not independently proven here. |
| Dimensions detached from corners; one eave label | **CALCULATION** D2, **MODEL BUILDER** R10, **RENDERING** R11–R12: exactly three global dimensions with abstract origin anchors; screen rails intentionally offset from the silhouette. Per-side height/grade fields do not create dimensions. | Models expose one eave dimension despite per-elevation data. Dashed witnesses exist; shifted rails alone are intentional. Nonrectangular or multi-volume corner references cannot be fixed merely by moving labels, because those references are absent from the dimension model. |
## 7. Recommended general approach

### Establish a shared spatial model before drawing surfaces

Use both the footprint outline and individual measured faces, but give them different responsibilities. The footprint describes horizontal topology: closed rings, courtyards, boundaries, and the junctions between volumes. Faces describe measured surfaces, including their dimensions, openings, appearance, and ownership. Neither should silently overwrite the other.

Create an intermediate spatial model with explicit building volumes, attachment ownership, wall segments, roof patches, shared vertices/edges, and local coordinate frames. Every output surface must retain its source IDs and state whether its location is measured, derived, assumed, or unresolved. Elevation names are viewing/orientation labels, not addresses that uniquely locate surfaces. A single elevation may contain many walls on different planes.

Check dimensional agreement with stated tolerances derived from measurement uncertainty. If a face length disagrees with its mapped footprint segment, record the conflict and preserve both measurements; do not resize the source or stretch a whole building to hide it. Prefer explicitly located, higher-confidence observations only under a documented conflict policy. When topology is incomplete, draw a clearly marked massing approximation separately from measured surfaces. Do not call that approximation a placed measurement.

```text
stored measurement (unchanged)
    |
    +--> calculation quantities and source provenance
    |
    +--> spatial interpretation + conflicts + unresolved elements
             |
             +--> volumes / local frames / shared boundary graph
                      |
                      +--> closed surface geometry + validation
                               |
                               +--> rendering + anchored annotations
```

### Construct roofs as a connected surface graph

A roof type restricts possible topology; it does not uniquely locate a ridge or identify which surfaces belong to which volume. Resolve roof ownership before classifying roof planes. Use measured boundary vertices or explicit ridge/hip/valley/eave adjacency when available. Otherwise, solve the smallest supported topology consistent with footprint, pitch, eave constraints, and gable heights, and disclose any remaining ambiguity. Do not select the main roof by area or assign sides by IDs.

Each roof plane should share exact boundary vertices with adjacent planes and the supporting wall tops. For supported parameterized primitives, gable, hip, half-hip, mono-pitch, and flat roofs require different construction rules. Pitches and gable heights are constraints to reconcile, not interchangeable values silently overridden by a global ridge height. More complex roofs need explicit intersections and valleys, not intersecting independent rectangles.

Validate watertight boundary loops, nonzero area, consistent normals, shared ridge/hip/valley endpoints, non-self-intersection, and wall-to-roof contact. Roof vertices must not fall below their supporting *local* eave boundary, allowing documented overhangs and intentionally lower roof volumes. If the constraints cannot produce a valid closed roof, show unresolved measured patches or a labelled coarse envelope rather than a false complete roof. Geometry validation belongs before rendering; a renderer-generated skirt to ground must not masquerade as a measured wall.

### Treat attachments as owned geometry, not a single universal box

Use a common placement/ownership interface: parent surface or independent site transform, local position, orientation, dimensions, and evidence. Then distinguish geometry families:

- **Enclosed volumes:** garages, annexes, and enclosed bays own their wall faces, openings, roof patches, and materials. Connected volumes have junctions; a detached volume has an independent transform.
- **Roof insertions:** dormers intersect a parent roof and own their vertical walls and gable/mono-pitch/other roofs. A dormer cannot be represented correctly merely by extruding a block along a roof normal.
- **Thin surfaces and assemblies:** panels, awnings, balconies, canopies, and open porches need slab/plate thickness, slope, support/open-side semantics where measured, and distinct local axes.
- **Penetrations:** chimneys and vents need an axis/orientation and a roof intersection; they are not automatically normal to the roof plane.

Preserve positive measured dimensions, including thin panels. Do not infer physical size from a name, story count, identifier, or a generic minimum thickness. Do not copy a host roof's pitch unless explicitly declared as an assumption. Build attachment-owned walls and roof first; suppress a proxy only when ownership proves that the detailed representation covers it. Appearance belongs to the owned surfaces, not to a type-based proxy palette.

### Degrade explicitly and locally

Incomplete topology should not erase valid measured quantities. Distinguish “measurement missing”, “placement unresolved”, “unsupported topology”, “conflicting evidence”, and “represented by owned detailed geometry”. List affected IDs with concrete reasons and preserve them in takeoff views. A missing depth is unknown, not equal to width; a missing independent location is unresolved, not the world origin.

Keep any illustrative placeholder visually distinct and out of exact snapping/dimension calculations. Show what is known without implying closure or accuracy that is not supported. Preserve the raw measurement and make interpretation deterministic under collection reordering and identifier renaming. Identifier changes must not alter geometry.

### Render the resolved model without changing its meaning

Render structural surfaces opaque unless their actual material is translucent; secondary color must not make alternating structural triangles translucent. Resolve duplicate/coincident structural surfaces in the spatial model rather than hiding them with broad depth bias. Use local render offsets only for intentional overlays such as opening decals and selection highlights.

Anchor dimensions to the actual boundary vertices and edges, retaining per-volume and per-side height information. Screen-space collision avoidance may move labels and drawing rails, but witnesses must still identify the measured endpoints. Keep camera/framing/visibility decisions separate from the geometric quantity and its provenance. Test multiple views because a plausible silhouette can conceal intersecting or misplaced parts.

## 8. What the measurement must deliver that it does not today

The present schema has useful measurements and some ownership/position fields, but it is not a complete spatial topology contract. Adding fields alone will not fix the builder: existing fields must also be consumed correctly. In particular, footprint concavity, individual wall heights, attachment dimensions/positions, and supplied face-to-attachment ownership must not be dismissed as wholly absent information.

| Needed information | Why the viewer cannot reliably infer it | General measurement/schema requirement |
|---|---|---|
| Volume identity and relationships | A collection of facade widths does not identify distinct connected buildings or lower wings. | Identify each principal/secondary volume, its footprint/boundary, level/base datum, and connection to other volumes. |
| Wall-to-outline correspondence | “Front” and a length cannot distinguish two recessed or overlapping front-facing walls. | Link a wall to an ordered footprint segment or provide its spatial/local endpoints and parent volume. |
| Common coordinate frames | A two-dimensional position has no unambiguous world meaning without origin and axes, especially on a rear wall or sloped roof. | Define units, handedness, origin, local x/y direction, face normal, placement anchor, and whether height is vertical or normal-to-surface. |
| Roof topology and orientation | Roof type and edge lengths do not locate shared ridge, hip, valley, and eave endpoints. | Provide patch ownership and adjacency plus located vertices/edges, or a fully specified supported roof primitive with ridge direction, endpoints, slopes, and per-boundary eaves. |
| Precise pitch with uncertainty | A shallow roof may snap to zero rise-over-12; the snapped display value discards useful geometry information. | Preserve measured degrees/slope and uncertainty as geometry inputs; identify rounding explicitly. |
| Terrain and local base heights | Existing per-elevation grade offsets and datum notes are ignored; even when used, they do not uniquely locate grade at every corner or recessed wall. | First consume existing offsets; extend to a shared vertical datum and grade/base values at relevant vertices or wall endpoints when per-side data is insufficient. |
| Complete attachment ownership | A supplied roof ownership link does not resolve unlinked attachment walls; the current schema describes `parent_attachment_id` as roof-only. | Extend ownership semantics to applicable wall faces and populate them consistently; preserve existing opening-to-face links and distinguish unknown from explicitly main-building ownership. |
| Independent placements | `attached: false` does not specify where a detached garage sits. | Independent translation/orientation or a surveyed site relationship; otherwise retain unresolved location. |
| Attachment geometry family | Existing `dormer.style` and `dormer.face_pitch_deg` distinguish important dormer variants but are ignored; other generic types do not describe open sides, panel orientation, or detailed boundaries. | Consume existing dormer fields, then extend structured primitive/assembly semantics with own roof, wall/open-side state, thickness, and orientation where necessary. |
| Face boundaries and holes | Width, height, and area do not uniquely define clipped, nonrectangular, or multiply connected surfaces. | Ordered polygon boundary and opening/void loops, or a supported shape specification sufficient to derive them. |
| Positional uncertainty and conflict evidence | A confidence label on a scalar does not explain incompatible spatial observations. | Preserve measurement references, uncertainty/tolerance and unresolved alternatives, especially for inferred topology. |

Measurement generation must be allowed to say “not identifiable from these inputs”. A prompt cannot extract an unseen detached-building position or exact roof junction from insufficient evidence. Never make a mandatory topology field force fabricated certainty. Retain compatibility with older records and display their limits without rewriting them.

## 9. Suggested order of work and dependencies

1. **Agree on spatial meanings and acceptance criteria.** Define coordinate frames, ownership, volume/face identity, uncertainty, and conflict policy; decide which shapes are directly supported and which require honest unresolved display. Use this diagnosis matrix as a baseline, not as a collection of buildings to special-case.
2. **Specify the measurement contract and compatibility boundary.** Depends on 1. Separate fields already supplied but ignored from genuinely missing topology. Validate parent references, units, face dimensions, and ownership without mutating stored measurements. Define backward-compatible unresolved states for historical data.
3. **Build a spatial interpretation layer with diagnostics.** Depends on 1–2. Map volumes, footprint segments, measured faces, and attachment transforms; reconcile conflicting constraints. Make every omission or simplification attributable to an ID and station. This must precede individual roof/attachment fixes.
4. **Build walls and roof topology on the same shared boundary graph.** Depends on 3. Support concave footprints and local base/eave heights; construct separate gable/hip/half-hip/flat/shed primitives, then multi-volume intersections. Validate closure, contact, and source provenance before producing render meshes.
5. **Build attachment families and owned detail.** Depends on 3–4 for enclosed volumes and roof intersections; thin/open assemblies can proceed after the placement contract is stable. Use own walls, openings, roof and materials; remove proxy suppression based on coincidental lengths.
6. **Correct rendering and annotation independently of measurement.** Depends on 4–5 for final geometry. Opaque structural material behavior can be corrected independently after its source audit, but dimensions, closure removal, contact shadows, selection, and snapping must be checked against the final spatial model.
7. **Gate rollout with shape-based tests and real-record regression checks.** Begin the tests in 1 and extend at every stage; final acceptance depends on 2–6. Assert topology, contact, dimensional fidelity, no below-grade placement unless supplied, identifier-renaming invariance, collection-order invariance, and understandable missing-data states. Include multiple camera views and both original and prepared inputs. A screenshot or retained-ID count alone is insufficient.

Do not start by changing a particular project's roof pitch, moving one attachment, renaming face IDs to influence placement, or stretching one wall. Those changes would preserve the assumptions responsible for failures on the next unseen house.
