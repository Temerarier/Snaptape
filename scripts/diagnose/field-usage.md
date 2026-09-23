# Measurement v1.7 geometry/placement field usage diagnosis

## Scope and method

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

## Building fields

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

## Face fields

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

## Edge fields

Schema inventory source: `edges[]` at `schema:675-723`.

| field | read by builder? | where (and use) | what used instead if not |
|---|---|---|---|
| `edges` | Yes | Preparation requires unique string `id` and `edge_class`, sanitizing length (`projectMeasurement.ts:252-258`). Calculation aggregates every class (`computeDerived.ts:262-266`). Builder attempts placement after walls/roofs (`buildModel.ts:1522-1524`). **Geometry/takeoff collection.** | Missing/malformed collection yields no edge models. |
| `edges[].id` | Yes, metadata | Builder uses it for model identity and tie diagnostics, not coordinates (`buildModel.ts:791-796`). **Metadata.** | Generated fallback only when builder is invoked outside preparation. |
| `edges[].edge_class` | Yes | Calculation groups lengths and derives drip edge/corners/base/gutters/waste (`computeDerived.ts:262-299,316-345`). Builder defaults to `unclassified` and geometrically supports only `eave`, `rake`, `ridge`, `base`, `outside_corner`, `inside_corner` (`buildModel.ts:800-840`). **Geometric classifier for six classes; takeoff metadata for all.** | Unsupported classes are omitted from geometry rather than substituted. |
| `edges[].length_mm: MV` | Yes | Calculation sums it (`computeDerived.ts:262-266,296-299`). Builder uses it as segment length and requires a candidate geometry match within 20 mm without ambiguity (`buildModel.ts:708-780,791-859`). **Primary line geometry and placement discriminator.** | Null/invalid becomes zero with a note; unmatched/ambiguous edge is omitted. |
| `edges[].belongs_to_elevation` | Yes, except ridge | Calculation reports it for gutters (`computeDerived.ts:296-299`). Builder restricts wall candidates by it; ridge placement ignores it (`buildModel.ts:708-780,791-839`). **Geometric wall-edge placement; metadata for calculation/ridge.** | Ridge uses reconstructed roof-ridge length; missing/wrong wall elevation generally causes omission. |

No schema edge field identifies a parent face or supplies endpoints. Consequently, the builder can only length-match its own reconstructed wall/ridge candidates; valley, hip, flashing, step flashing, head, sill, jamb, and unclassified lengths have no render placement.

## Opening fields

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

## Attachment fields

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

## Render-stage use and default boundary

The renderer never reads raw schema fields. It consumes builder output:

* polygon coordinates come exclusively from model triangles (`renderResources.ts:68-78`); edges use the two builder endpoints (`ViewerViewport.tsx:116-131`);
* openings are translated outward by a render-only token offset, leaving canonical coordinates unchanged for measurement (`renderResources.ts:9-27,81-101`);
* condition decals similarly receive only a presentation offset (`renderResources.ts:29-65`);
* face color and secondary color affect materials, not geometry (`renderResources.ts:73-78,82-113`);
* overall generated bounds, including inferred/proxy attachments, set camera center/span and contact shadow (`ViewerViewport.tsx:557-625`; `renderResources.ts:165-196`);
* walls, roof faces, openings, attachments, massing, edges, and condition patches are rendered; soffit/fascia do not reach model geometry (`ViewerViewport.tsx:627-640`);
* presentation-only caps/seams are reconstructed from projected roof/ground-attachment/model geometry, not from schema footprint points (`closure.ts:127-153,305-380`).

Thus schema defaults are not generally applied. Preparation is structural sanitation, not JSON Schema default materialization. Concrete defaults/inferences are builder code defaults documented in the tables above.

## Schema path inventory coverage

The requested five roots are fully inventoried below. `MV.*` expands to `value`, `confidence`, `source`, `reference_used`, and `low_reason` as explicitly tabulated above.

| Root | Every schema property path covered |
|---|---|
| `building` | `building_type`; `stories`; `roof_type`; `footprint`; `footprint.points[]`; `footprint.points[][0]`; `footprint.points[][1]`; `footprint.width_mm.MV.*`; `footprint.depth_mm.MV.*`; `footprint.perimeter_mm.MV.*`; `footprint.area_mm2.MV.*`; `heights`; `heights.eave_height_mm.MV.*`; `heights.ridge_height_mm.MV.*`; `heights.parapet_height_mm.MV.*`; `heights.datum_note`; `heights.per_elevation`; `heights.per_elevation[].elevation`; `heights.per_elevation[].eave_height_mm.MV.*`; `heights.per_elevation[].ridge_height_mm.MV.*`; `heights.per_elevation[].grade_offset_mm.MV.*`; `shared_walls[]`; `footprint_overall`; `footprint_overall.width_mm.MV.*`; `footprint_overall.depth_mm.MV.*`; `footprint_overall.note`. |
| `faces[]` | `id`; `face_class`; `elevation`; `material`; `area_mm2.MV.*`; `net_area_mm2.MV.*`; `width_mm.MV.*`; `height_mm.MV.*`; `gable_height_mm.MV.*`; `soffit_depth_mm.MV.*`; `parent_attachment_id`; `pitch`; `pitch.degrees_original`; `pitch.degrees_rounded`; `pitch.rise_over_12_snapped`; `orientation_deg`; `color`; `color.hex`; `color.name`; `color.confidence`; `color.secondary_hex`; `color.note`. Conditional material enums do not add paths (`schema:606-672`). |
| `edges[]` | `id`; `edge_class`; `length_mm.MV.*`; `belongs_to_elevation`. |
| `openings[]` | `id`; `type`; `elevation`; `parent_face_id`; `width_mm.MV.*`; `height_mm.MV.*`; `sill_height_mm.MV.*`; `group_id`; `position_mm`; `position_mm.x`; `position_mm.y`; `area_mm2.MV.*`; `perimeter_mm.MV.*`; `note`. |
| `attachments[]` | `id`; `type`; `subtype`; `elevation`; `width_mm.MV.*`; `height_mm.MV.*`; `depth_mm.MV.*`; `position_mm`; `position_mm.x`; `position_mm.y`; `parent_face_id`; `attached`; `include_in_footprint`; `dormer`; `dormer.style`; `dormer.face_pitch_deg`. |

Required markers and enum/pattern constraints are schema validation rules, not additional data paths. Preparation does not execute those constraints; for collections it checks only record shape, uniqueness, and the named string identity fields (`projectMeasurement.ts:43-75,215-301`).

## Baseline contradictions and gaps (reported, not fixed)

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