# Offline causal probes: viewer geometry

## Reproduction and scope

Run from repository root:

`pnpm exec tsx --tsconfig artifacts/aufmass-app/tsconfig.json scripts/diagnose/causal-probes.ts`

The script imports the actual preparation function and model builder, not a reimplementation. It reads four real projects, all four `export-messungen/*.json` exports, and `fixtures/garage-house.json`. It writes only `scripts/diagnose/causal-results.json`. This report is separately authored. No product edits, input writes, database requests, API calls, screenshots or app execution are involved.

All coordinates below are model millimetres: **z is vertical**. JSON evidence is under `results[]`, selected by `path`; input SHA-256 values are included. Every perturbation starts from a fresh clone. `identicalFullModel` compares the entire serialized model; `identicalCanonicalGeometry` compares ID-sorted corner/segment geometry, excluding notes and array ordering. Both `roofFaces` and `roofs` are model aliases, not twice as many physical roofs.

## Braamheide: wrong ridge direction, not just 100 mm height mismatch

Source: `scripts/diagnose/real/d165c333-6125-4294-bd79-fb1c9c185568.json`, faces WL-1/WL-2; evidence: `walls.gables`, `roofs.model`.

Both walls retain 4400 mm rectangular height plus **6300 mm gable rise**. Their apex coordinates are **(5597,0,10700)** and **(5597,8600,10700)**. The main roof ridge runs instead from **(0,4300,10600)** to **(11194,4300,10600)**. At each gable apex's x/y, its main roof is at **z=4400**, leaving **6300 mm vertical separation**. The ridge is also 100 mm below the apex, but that small discrepancy is not the primary contact failure: the generated ridge is perpendicular to the direction needed to join these front/back gables.

Mechanism: `artifacts/aufmass-app/lib/viewer-next/model/buildModel.ts:1273–1314` retains measured gables, while `:1360–1380` always constructs main roof planes about `midY=depth/2`. This is direct numeric evidence; whether the original photo labels should have been different is outside these probes.

## Leipzig: retained walls are not correctly separated volumes

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

## Attachments: actual dimensions and z placement

Braamheide (same real source as above):

* **AT-5:** supplied and modeled width/depth/height **2600/2600/2500**. Box spans **x=8000…10600, y=-2600…0, z=0…2500**. No evidence that this attachment is made giant by a missing-depth fallback.
* **AT-9:** supplied width **5000**, height **300**, depth absent. Modeled depth becomes **5000**, not 300. Box spans **x=-5000…0, y=1900…6900, z=3900…4200**. This awning is a 5 m deep horizontal block; its measured elevation is preserved.
* **AT-7 solar:** width/depth/height **2400/100/1722**, spans **x=5494…7894, y=8600…8700, z=6200…7922**.
* **AT-8 solar:** **4300/100/1134**, spans **x=3694…7994, y=8600…8700, z=4600…5734**.

Thus **the solar panels' supplied 100 mm depth is actually preserved**. A blanket claim that every thin element receives width-sized thickness is false. The relevant distinction is missing versus supplied positive depth.

IDs are project-local, not universal semantics. In real Leipzig `536235c3…`, AT-5 is a chimney, nominal **800/500/1500**, bounds **x=9600…10400, y=5000…5357.821, z=12225…14074.233**. AT-9 is a dormer, nominal **1500/1500/1800**, bounds **x=1740…3240, y=7924.637…8998.101, z=8322.854…11170.554**. Roof-mounted depth follows the sloping roof axis and height is added vertically, so the vertical bounding extent exceeds nominal height. These are not the Braamheide awning/box.

Mechanism: `buildModel.ts:1019–1049`: missing depth falls back to width; parent-wall placement uses `position_mm.y` as z; roof placement uses roof axes. No type-specific solar thickness override is needed to explain the 100 mm result.

## Leipzig garage: measured 2920 mm / 3.4° relationship is not honored

Source: real `536235c3…`, attachment AT-2, roof RF-5 and walls WL-8…WL-10.

AT-2 supplies **3520×6355×2920**, and RF-5 explicitly links to AT-2 with **3.4°** original pitch (snapped ratio **1/12**). Instead RF-5 becomes a central-front cross roof: **x=4105.174…6470, y=0…4729.651, z=7345…7542.069**. Its eave is **4425 mm above** the attachment's supplied 2920 mm height, and its x range is not the garage wall range **12940…16460**.

RF-3/RF-4 are selected for the side garage instead: eave **5490**, ridge **7103.333**, across x=12940…16460 and y=0…6355. The 5490 comes from another short wall rather than AT-2's height. Changing all addition heights by +1000 changes AT-1's box but **no roof coordinates** in this project. Changing all face/edge parent-attachment links leaves the **entire model identical**.

Mechanism: `buildModel.ts:1322–1357` takes the two largest roofs as main roofs and chooses remaining garage faces heuristically; `:1415–1484` determines garage eave from short-wall heights. `:567–575` reads snapped pitch, not original degrees. Changing degrees alone to 67° produces an identical full model. This proves original-degree insensitivity, not that all pitch inputs are ignored.

## Controlled perturbations across the nine inputs

* Replacing every face/edge `parent_attachment_id`: **full model identical for all nine**.
* Replacing `per_elevation` heights and grade offsets with large values: **full model identical for all nine**. Existing measured wall-height differences remain; this does not mean every elevation is drawn with the same height.
* Changing `roof_type`: **geometry identical for all nine**, but full model differs because the unsupported-topology note changes (`buildModel.ts:1496–1497`). Do not call the whole model identical.
* Reversing footprint points, or replacing them with a concave polygon of the same extents: **full model identical** for the four inputs with existing polygon points (real `536235c3…`, real `a847416a…`, Neuengamme photo export, garage fixture). Inputs without point polygons are explicitly not included in this test. Extents, not boundary shape, control this geometry (`buildModel.ts:300` onward).
* Reversing face arrays: canonical geometry unchanged in all nine, but serialized full model changes order. This is not evidence of geometric face-order dependence.
* Reversing attachment arrays: geometry unchanged for all four real projects and the garage fixture, but **changes RF-3/RF-4 in the Leipzig photo export**. Baseline roofs span x=12100…14600, y=0…2000, z=6900…8566.667. After reversal they span **x=-5000…0, y=0…3000, z=6900…10233.333**. The first matching side addition is selected by `.find` (`buildModel.ts:1328`); two eligible additions make array order material.
* Appending `A` to roof IDs and remapping parent-face references changes **actual corner coordinates**, not merely IDs, in all nine inputs. `coordinateChangedParts` matches each renamed ID to its original before comparing corners. Real Braamheide RF-3/RF-4/RF-5 switch sides; real Leipzig `536235c3…` RF-3…RF-6 switch sides. Character-code parity (`buildModel.ts:1208–1210`, `:1412`, `:1465–1472`) and stable ID ordering supply placement decisions.

## Limits and hypothesis boundary

These measurements establish deterministic builder/preparation mechanisms, not screenshot occlusion, renderer clipping, photographic ground truth, or accuracy of upstream extraction. The garage fixture is a control for the builder's supported heuristics, not proof that real hip roofs or compound footprints work. Its six walls are retained without detected coplanar overlaps; parent links, per-elevation values and same-extents concavity still have no effect. No fixes are proposed or applied here.

## Follow-up: actual presentation closure and material execution

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