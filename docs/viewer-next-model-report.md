# Viewer-next model and SVG report

This report covers the pure model, SVG inspection, and viewport verification.
The legacy viewer, compute library, schema and fixture were not changed. Panel
content and calculations remain unchanged; selection wiring and model notes use
the existing rows and quality block.

## Model API and dimension semantics

`artifacts/aufmass-app/lib/viewer-next/model/buildModel.ts` exports the pure
`buildModel(measurement)` boundary. It returns plain millimetre geometry for
`walls`, `roofFaces`/`roofs`, `edges`, `openings`, `attachments`, `conditions`,
and degraded `massing`, plus bounds, colours, parent ids, frames, normals,
triangles, and notes. Attachments additionally expose optional physical
`segments` (12 box edges when a box is emitted), so a painter does not infer
diagonals from a corner loop. It has no DOM, canvas, or Three.js dependency.

`permanentDimensions` has three drawable dimensions:

- `width`: main footprint width, 12192 mm / 40 ft, one 12192 mm segment.
- `ridge`: the main physical roof-intersection ridge, 12192 mm / 40 ft, one
  measured roof segment. Its segment-length sum equals its value.
- `eaveHeight`: 5486.4 mm / 18 ft, one vertical segment.

The source's aggregate ridge total remains available as
`permanentDimensions.ridgeAggregate`: 21336 mm / 70 ft for the fixture. It is a
panel/value summary only and deliberately has no drawable segments; the 70 ft
value is never drawn on the 40 ft main ridge. Renderer code should draw
`ridge.segments` and use `ridgeAggregate` only where the aggregate panel value
is required.

`ViewerModel.diagnostics` exposes stable, non-localized `{code, category, ids}`
records for a UI warning layer; the existing `notes` array remains detailed
internal diagnostic text. No raw millimetre message needs to be shown directly
to a user.

## SVG evidence

`/viewer-next/debug.svg` is generated from the same model output. The
projection passes positive model z into one screen-space inversion, so ground
is below ridge. Front occupies x=48–402 and side occupies x=498–852 in the
900px viewBox.

Corrected first 20 lines:

```text
01 <?xml version="1.0" encoding="UTF-8"?>
02 <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560" role="img" aria-label="Viewer model debug elevations">
03   <style>polygon { vector-effect: non-scaling-stroke; } .dimension { stroke: #111827; stroke-dasharray: 5 4; }</style>
04   <g id="front-elevation" data-elevation="front">
05     <title>Front elevation</title>
06     <polygon id="front-RF-1" data-model-id="RF-1" data-parent-face-id="" points="48.00,255.24 276.39,255.24 276.39,201.97 48.00,201.97" fill="none" fill-opacity="1" stroke="#4A4E55" stroke-width="2"><title>RF-1</title></polygon>
07     <polygon id="front-RF-3" data-model-id="RF-3" data-parent-face-id="" points="132.94,255.24 162.19,235.74" fill="none" fill-opacity="1" stroke="#4A4E55" stroke-width="2"><title>RF-3</title></polygon>
08     <polygon id="front-RF-4" data-model-id="RF-4" data-parent-face-id="" points="162.19,235.74 191.45,255.24" fill="none" fill-opacity="1" stroke="#4A4E55" stroke-width="2"><title>RF-4</title></polygon>
09     <polygon id="front-RF-5" data-model-id="RF-5" data-parent-face-id="" points="276.39,306.63 402.00,306.63 402.00,275.21 276.39,275.21" fill="none" fill-opacity="1" stroke="#4A4E55" stroke-width="2"><title>RF-5</title></polygon>
10     <polygon id="front-WL-1" data-model-id="WL-1" data-parent-face-id="" points="48.00,358.01 276.39,358.01 276.39,255.24 48.00,255.24" fill="none" fill-opacity="1" stroke="#C9BFAF" stroke-width="2"><title>WL-1</title></polygon>
11     <polygon id="front-WL-5" data-model-id="WL-5" data-parent-face-id="" points="276.39,358.01 402.00,358.01 402.00,306.63 276.39,306.63" fill="none" fill-opacity="1" stroke="#9B5E42" stroke-width="2"><title>WL-5</title></polygon>
12     <polygon id="front-W-1" data-model-id="W-1" data-parent-face-id="WL-1" points="93.20,340.88 110.33,340.88 110.33,312.34 93.20,312.34" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-1</title></polygon>
13     <polygon id="front-W-2" data-model-id="W-2" data-parent-face-id="WL-1" points="182.89,340.88 200.02,340.88 200.02,312.34 182.89,312.34" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-2</title></polygon>
14     <polygon id="front-W-3" data-model-id="W-3" data-parent-face-id="WL-1" points="214.06,340.88 231.19,340.88 231.19,312.34 214.06,312.34" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-3</title></polygon>
15     <polygon id="front-W-4" data-model-id="W-4" data-parent-face-id="WL-1" points="245.22,340.88 262.35,340.88 262.35,312.34 245.22,312.34" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-4</title></polygon>
16     <polygon id="front-W-11" data-model-id="W-11" data-parent-face-id="WL-1" points="124.37,338.03 139.59,338.03 139.59,315.19 124.37,315.19" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-11</title></polygon>
17     <polygon id="front-W-12" data-model-id="W-12" data-parent-face-id="WL-1" points="153.63,338.03 168.86,338.03 168.86,315.19 153.63,315.19" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>W-12</title></polygon>
18     <polygon id="front-D-1" data-model-id="D-1" data-parent-face-id="WL-1" points="62.04,358.01 79.16,358.01 79.16,318.05 62.04,318.05" fill="#DCE7EF" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>D-1</title></polygon>
19     <polygon id="front-G-1" data-model-id="G-1" data-parent-face-id="WL-5" points="293.52,358.01 384.87,358.01 384.87,318.05 293.52,318.05" fill="#46505A" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>G-1</title></polygon>
20     <polygon id="front-SK-1" data-model-id="SK-1" data-parent-face-id="RF-1" points="156.48,234.94 167.90,234.94 167.90,222.27 156.48,222.27" fill="#79A8C7" fill-opacity="0.65" stroke="#111827" stroke-width="1.5"><title>SK-1</title></polygon>
```

The SVG review found and corrected the z inversion, overlapping front/side
columns, floating garage roof, wrong front-wall inclusion, and degenerate box
attachment projection. The fixture now places WL-6 at x=18897.6 mm, RF-5/RF-6
on the garage wall eave, and G-1 inside WL-5. The measured RIGHT gable WL-6
now determines the garage roof profile: RF-5/RF-6 ridges run along x from the
main wall to the WL-6 peak, with both sloped faces fully contacting the three
WL-6 eave/peak profile points. All six roof facets have a geometric
wall-envelope contact.

## Compatibility and tests

The real `export-messungen/neuengamme-mixed.json` is rejected by the actual
v1.6 validator for its `meta.schema_version` const and legacy numeric condition
areas, then accepted structurally by `buildModel` with degradation notes.
Roof-elevation skylights receive an `RF-*` parent or are omitted; they never
fall back to WL-1. A required-fields-only measurement with valid
`confidence`/`source` values validates against v1.6 and builds neutral
area-derived massing.

Focused model/SVG tests pass: 11 tests. Library and app TypeScript checks pass.

Final full-suite output:

```text
Test Files  17 passed (17)
     Tests  136 passed (136)
```

Additional regressions cover production-camera projected snapping and occlusion,
render-loop reentrancy/error isolation, panel reveal/filter state, measured
selection-card placement across phone sheet detents, explicit twelve-edge
attachment-box snapping, gable-area selection details, and model-failure
viewport isolation.

## Browser verification

Verified in headless Chromium without WebGL. The page and measurements panel
remain usable. Browser errors were exclusively Three.js context-creation errors:

```text
THREE.WebGLRenderer: A WebGL context could not be created. Reason:
Could not create a WebGL context, VENDOR = 0xffff, DEVICE = 0xffff,
Sandboxed = no, Optimus = no, AMD switchable = no,
Reset notification strategy = 0x0000,
ErrorMessage = BindToCurrentSequence failed: .
THREE.WebGLRenderer: Error creating WebGL context.
```

No other console errors or uncaught runtime exceptions were observed.
Browser interaction checks confirmed Siding hides Roof Area while preserving
Walls, the garage-door group opens, and G-1 receives the selected-row highlight
without WebGL. These do not claim GPU rendering or canvas picking was visually
verified.

Measured control rectangles, in CSS pixels relative to the browser page:

| Viewport | Reset (x,y,w,h) | Conditions (x,y,w,h) | Measure (x,y,w,h) |
|---|---|---|---|
| Desktop 1440×900 | 695.2,8,86.8,44 | 790.0,8,154.0,44 | 430.3,835,99.3,44 |
| Tablet landscape 1024×768 | 279.2,8,86.8,44 | 374.0,8,154.0,44 | 222.3,703,99.3,44 |
| Tablet portrait 820×1180 | 555.2,8,86.8,44 | 650.0,8,154.0,44 | 699.7,82,99.3,44 |
| Phone 390×844 | 315,68,44,44 | 315,120,44,44 | 315,16,44,44 |

The touch gesture hint was hidden for desktop fine-pointer emulation and visible
for the tablet and phone coarse-pointer emulations. Clear shares the measure
control group when a user measure line exists; its visibility is covered in
interaction/state logic rather than a GPU click test.

### Measured selection-card regression

A real DOM card using the production selection-box CSS was inserted temporarily
in the phone viewport, measured by a real ResizeObserver, then positioned by the
production placement function against two controlled projected element bounds.
At 402×874, the running half-detent sheet top was y=419.52 px, leaving 419.52
px exposed above the sheet. The card measured 152.80 × 105.72 CSS pixels.
The live top-right controls measured Measure (342,16,44,44), Reset
(342,68,44,44), and Conditions (342,120,44,44). For a near-right element, the
resulting card box was (163.20,151.14)–(316.00,256.86), side `left`. After the
controlled projection changed, it was (195.20,251.14)–(348.00,356.86), still
fully above the sheet with zero control collisions.

This browser check uses controlled reprojection, not GPU orbit. Automated
camera/lifecycle tests separately cover the current-callback/measurement-ref
path and damping settling without idle overlay-state updates.

### Phone sheet and failure isolation

Camera projection and selection placement now use the exposed canvas above the
actual sheet bounds, not the full canvas. A panel-row request to inspect the model
changes the phone sheet to peek; ordinary manual detent cycling is preserved.
At 390×844, the browser measured the initial half-sheet top at 405.12px and,
after selecting G-1, the peek-sheet top at 716px. Document scroll stayed zero.
Row reveal scrolls only the panel body, never the translated sheet's document.
Camera tests cover half/peek exposed bounds and the full-sheet selection reveal.

A model-build exception now produces a localized model-unavailable quality warning
and a `data-webgl-state="notready"` viewport state, while retaining the
measurement panel.

## Visual checks in a WebGL-capable browser

- Orbit the building and confirm both main and garage front walls are visible,
  with beige siding, brick garage front, charcoal roofing and subtle accents.
- Click the garage door and confirm G-1 is revealed in the panel; select a rear
  wall row and confirm the camera moves to that side.
- Check that the selection box remains beside its element at phone and tablet
  sizes, and its outline does not replace the material colour.
- Measure the main 40-foot eave with each endpoint snapping; try the middle of a
  wall to confirm it stays free. Clear user lines and confirm the permanent
  width, main ridge and eave-height dimensions remain.
- Toggle conditions, reset the camera, and check touch orbit/pinch/two-finger pan.

## Geometry occlusion addendum

The detailed fixture omits AT-7's addition proxy because WL-5/WL-6 and RF-5/RF-6
already provide the measured garage volume. Unsupported SF-1/FC-1 trim is
omitted when detailed wall and roof geometry is available, preventing opaque
duplicate boxes and full-depth fallback wedges. Whole-building fallback massing
remains available for insufficient minimal input. `ViewerModel.diagnostics`
provides stable non-localized `{code, category, ids}` records for a warning
layer; detailed millimetre `notes` remain internal diagnostics.

## Resize and gesture regressions

Every renderer resize reapplies the exposed viewport and scissor, including
repeated same-size callbacks. Tests simulate the renderer resetting to full
canvas and assert restoration of matching camera/drawing coordinates.
Picking requires a single-pointer tap: movement beyond 6 CSS pixels, multiple
pointers, cancellation and right-button panning suppress the following click.
Tests cover tap, orbit-returning-to-start, pinch and cancellation, so orbiting
with Measure armed cannot place an endpoint. Camera orbit uses the model's
vertical Z axis.