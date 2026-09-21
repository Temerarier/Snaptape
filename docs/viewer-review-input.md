# `/viewer-next` review input

Scope: static code and reference-source audit. Responsiveness is evaluated first, look and
feel second. No measurement was run and no paid API was called. WebGL was not rendered for
this audit; statements about the 3D scene describe the code that constructs and positions it,
not its visual correctness.

## 1. Layout per width

The four review sizes below are the project reference sizes used for §11: desktop
1440×1000, tablet landscape 1024×768, tablet portrait 768×1024, and phone 390×844.

| Size | Actual layout and dimensions | Visible controls | Sheet/detents |
|---|---|---|---|
| Desktop 1440×1000 | Side by side. The panel is fixed at 480px on the right; the model section receives 960px. Both fill `100dvh`. | App-header Add photo, Reset view, and Show conditions. Measure pill bottom-centre. Calc bubble top-centre at 12px. Gesture hint hidden by the ≥1280px query. | Handle hidden; detent state does not affect geometry. |
| Tablet landscape 1024×768 | Side by side because width is ≥768 and orientation is landscape. Panel is 480px; model section receives 544px. | Same header controls. Measure pill bottom-centre. Calc top-centre at 12px. Gesture hint appears only if the pointer is coarse. | Handle hidden; detents do not apply. |
| Tablet portrait 768×1024 | Stacked two-row grid. Default/half model row is 42dvh = 430.08px; panel receives 593.92px. Peek is 72dvh = 737.28px; full is 12dvh = 122.88px. Panel is full width. | Header controls remain. Measure pill top-right at 16px. Calc top-centre at 80px. Gesture hint top-left only on a coarse pointer. | A 44px-high full-width handle cycles or drag-snaps to 72%/42%/12%. Model-section contents can scroll when the row is shorter than their fixed content. |
| Phone 390×844 | Stacked two-row grid. Default/half model row is 42dvh = 354.48px; panel receives 489.52px. Peek is 607.68px; full is 101.28px. Panel is full width. | Same textual header controls as portrait tablet. Measure is a pill at top 34px/right 12px; gesture hint at top 4px/left 12px; calc top-centre at 96px. | Same 72%/42%/12% detents and 44px handle. At full on a short screen, the model section scrolls because its stage is at least 240px or 380px with calc. |

Intermediate-width consequence: any landscape viewport from 768px through 1279px uses the
480px panel. At 768px landscape this leaves 288px for the model section. At 767px landscape
the layout changes to stacked because the landscape media query no longer matches.

The code does **not** create phone-only round Reset/Conditions controls or a bottom calc bar.
That differs from `docs/viewer-spec.md:152-159,167-176`; phone uses the portrait-tablet
composition.

Verbatim layout excerpt (`artifacts/aufmass-app/app/globals.css:181-210,245-250,274-287`;
35 lines):

```css
.viewer-next-shell {
  --color-schrift-tertiaer: #4a5568;
  --color-akzent: #1e40af;
  display: grid;
  grid-template-rows: var(--viewer-top, 42dvh) minmax(0, 1fr);
}
.viewer-next-shell[data-panel-detent="half"] {
  --viewer-top: 42dvh;
}
.viewer-next-shell[data-panel-detent="peek"] {
  --viewer-top: 72dvh;
}
.viewer-next-shell[data-panel-detent="full"] { --viewer-top: 12dvh; }
.viewer-next-model-section { overflow-y: auto; }

.viewer-next-shell button { min-height: 44px; min-width: 44px; }
.viewer-next-stage > .viewer-next-viewport {
  margin-top: max(var(--viewer-calc-bottom, 0px), var(--viewer-control-space, 0px));
}
.viewer-next-stage {
  --viewer-control-space: 80px;
  min-height: 240px;
  flex-shrink: 0;
}
.viewer-next-stage:has([data-calc-bubble]) { min-height: 380px; }
@media (max-width: 600px) {
  .viewer-next-gesture { max-width: calc(100% - 24px); top: 4px; left: 12px; }
  .viewer-next-measure-portrait { top: 34px; right: 12px; }
  .viewer-next-stage { --viewer-control-space: 96px; }
  .viewer-next-calc-bubble { top: 96px; }
}
@media (min-width: 768px) and (orientation: landscape) {
  .viewer-next-model-section { overflow: hidden; }
  .viewer-next-stage, .viewer-next-stage:has([data-calc-bubble]) { min-height: 0; }
  .viewer-next-shell { display: flex; flex-direction: row; }
  .viewer-next-panel { position: static; width: 480px; }
}
```

## 2. The 3D viewport

### Canvas sizing and resize

`ViewerViewport.tsx:645-683` observes the viewport host with `ResizeObserver`. Every observed
size change reads the host rectangle, caps device pixel ratio at 2, calls
`renderer.setSize(width, height, false)`, reapplies the exposed Three.js viewport, renders,
and updates DOM overlays. The same viewport synchronization occurs during orbit damping and
when the scrollable model section moves.

```ts
const setSize = () => {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  syncPainterViewport(state, host);
  renderer.render(scene, camera);
  updateOverlaysRef.current.invoke();
};
const resizeObserver = new ResizeObserver(setSize);
resizeObserver.observe(host);
const scrollContainer = host.closest(".viewer-next-model-section");
scrollContainer?.addEventListener("scroll", render, { passive: true });
```

There is no explicit `orientationchange` listener. Orientation changes are handled indirectly:
CSS switches between grid and side-by-side layout, then `ResizeObserver` reacts to the host
size. Whether every browser emits the needed resize sequence is **unknown** without device
testing.

`getViewportMetrics` (`ViewerViewport.tsx:221-240`) detects whether the panel overlaps the
host. The Three viewport and scissor are restricted to the exposed area above the sheet.
`applyExposedViewport` updates camera aspect, view offset, projection matrix, viewport, and
scissor. A side-by-side panel does not reduce canvas height.

### Camera and scene

The camera does not get a separate narrow-screen position. All widths start from the same
model-relative formula (`ViewerViewport.tsx:566-598`):

```ts
const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000000);
camera.up.set(0, 0, 1);
const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
const initialPosition = new THREE.Vector3(
  centre.x + span * 1.28,
  centre.y - span * 1.52,
  centre.z + span * 0.82,
);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = Math.max(span * 0.15, 100);
controls.maxDistance = span * 8;
```

The scene uses a `#f7fafc` background, hemisphere light intensity 1.9, directional light
intensity 2.2, data-driven material colours, and separate groups for geometry, conditions,
measure lines, permanent dimensions, and selection. Whether the building is framed well or
looks correct at any width is **unknown** because this audit did not render WebGL.

### Dimension labels and selection

Permanent width/ridge/eave labels and user-measure labels are projected from the midpoint of
their 3D segment into the exposed viewport (`ViewerViewport.tsx:343-370`). Their DOM labels
are absolutely positioned at that point and translated by `-50%,-50%`. They are 17px/600
IBM Plex Mono, single-line, with 4px × 9px padding. Permanent labels are white rectangles
with 4px radius; measure labels are white on `#991b1b`.

The selection placement code projects all selected-element corners, derives a screen-space
bounding rectangle, measures the actual selection box, and evaluates right/left/below/above
candidates. Control rectangles marked `data-control` are penalized. The chosen position is
then clamped:

```ts
const left = Math.max(0,
  Math.min(Math.max(0, viewport.width - box.width), chosen.left));
const top = Math.max(0,
  Math.min(Math.max(0, viewport.height - box.height), chosen.top));
```

The selection box is `max-width: calc(100% - 8px)`, uses normal wrapping, and the overlay
host clips overflow. Therefore, for content whose measured width and height fit the exposed
viewport, the box is clamped inside it. At 390px width the CSS maximum is 382px.

Can the selection box leave the visible area at the smallest width? **Horizontally, the code
prevents it for a measured box no wider than the CSS maximum. Vertically, unknown for every
possible content string:** if the rendered box becomes taller than the exposed viewport,
the clamp reduces `top` to 0 but cannot reduce its height; the overflow-hidden host will clip
the bottom. No max-height or internal selection-box scrolling is defined. Permanent
dimension labels are not clamped at all and can be clipped at any edge.

The smallest model-label type at every width is 17px for dimensions and selection values;
the selection title is 12px. Width does not change these sizes.

## 3. Fixed sizes and overflow

The table lists viewer-specific hard constraints and the first code-defined threshold where
they change, clip, or scroll. “Unknown” means the exact content-dependent failure width
cannot be derived without rendering.

| Constraint | File/value | Behaviour and threshold |
|---|---|---|
| Shell height | `ViewerNextClient.tsx:397`, `h-[100dvh]` | Page itself is fixed to the dynamic viewport height and hides outer overflow. Internal regions must scroll. |
| Side panel | `globals.css:287,316`, `width:480px` | Applies at landscape width ≥768 or any width ≥1280. Leaves 288px model width at 768 landscape, 544px at 1024, 960px at 1440. |
| Portrait tracks | `globals.css:186-194`, 72/42/12dvh | Full leaves only 68.16px at 320×568 and 101.28px at 390×844 for the model row. Fixed stage content then scrolls vertically. |
| Model stage | `globals.css:201-206`, minimum 240px; 380px with calc | On portrait full, vertical model-section scrolling starts whenever 12dvh is below header plus stage content. With the 56px header, that is all viewport heights below about 2467px without calc and 3633px with calc. |
| Reserved control space | `globals.css:202,248`, 80px; 96px at ≤600 | Canvas starts below this reservation or the measured calc bottom. It reduces visible canvas height; exact resulting size depends on bubble height. |
| Calc location/size | `globals.css:207-215`, top 80px/96px phone/12px landscape; max-width `min(680px,100%-24px)`; height 64–164px | It stays 12px from horizontal edges at narrow widths and scrolls vertically above 164px. At ≤600×700 with a selection, max-height becomes 64px. |
| Calc JSX width | `CalcBubble.tsx:63`, `max-w-[min(72%,680px)]` plus CSS `width:max-content` | Tailwind’s 72% maximum and the CSS 100%-24px maximum both apply; at 390px, 72% is about 281px. Count and subtotal are nowrap, so wrapping occurs between flex items; long content may force bubble scrolling/word breaks. Exact collision width is unknown. |
| Calc chip list | `CalcBubble.tsx:101`, max-height 128px, vertical scroll | Many chips wrap and scroll inside the list; the outer bubble can also scroll. Long labels can break via `overflow-wrap:anywhere`. |
| Calc buttons | 44px minimum height; 10px radius; horizontal padding 14px | Copy/Clear can wrap to another flex line. No fixed column count. |
| Panel heading | `globals.css:217-229`, min-height 48px, max-height panel-108px, vertical scroll | Status/filter header scrolls when it outgrows available panel height. Panel card scroller retains at least 64px. |
| Status detail | `ViewerNextClient.tsx:588`, max-height 144px, vertical scroll | Long warnings scroll inside status detail. |
| Header | `ViewerNextClient.tsx:401`, minimum 56px, flex-wrap | Project text truncates; controls wrap and increase header height. At phone width all header controls do not remain on one line. Exact first wrap width depends on localized labels and font metrics: unknown. |
| Conditions control | `ViewerNextClient.tsx:429`, `whitespace-nowrap`; switch 36×20px internally | The button itself is forced to at least 44×44 by viewer CSS. Its label does not break; it moves as a flex item when the header wraps. |
| Measure controls | absolute top-right or bottom-centre; 44px min target; nowrap button text | At phone, hint and measure occupy separate vertical offsets. Long localized labels can widen leftward; first overlap width is unknown. |
| Gesture hint | absolute; nowrap; at phone max-width `100%-24px` | Text itself does not declare wrapping; if wider than max-width it can overflow its box. Exact width depends on font rendering. |
| Selection box | max-width `100%-8px`, padding 10×12px, normal wrap | Horizontal position is clamped. No max-height; tall content can be clipped vertically. |
| Dimension labels | nowrap; 17px; padding 4×9px; absolute centred | Long dimension strings never wrap and are not clamped; they clip when their projected midpoint is less than half the label width from an edge. Content-dependent threshold unknown. |
| Row labels | `globals.css:230`, min-width `min(140px,100%)` | At panel container ≤420px, row buttons become a two-column grid and labels span both columns. Long labels wrap; no sideways document overflow is intentionally introduced. |
| Row values | 17px/600 mono; normal white-space, flex-wrap; descendants `overflow-wrap:anywhere` | Large numbers/units can wrap. No fixed value width remains. |
| Row action buttons | global minimum 44×44 | Actions occupy the auto column at panel ≤420px. Multiple actions remain side by side; exact width where they force wrapping is content-dependent. |
| Cards | 14px radius, horizontal panel padding 16px | At 390px, nominal card width is 358px before borders. At 320px, 288px. |
| Panel handle | 44px high, full width; visible below side-by-side breakpoint | Internal visual bar is 40×4px, but the button hit area is 44px high. |
| Camera marker | sphere radius `max(span*0.012,50)` | World-space fixed lower bound, not a CSS overflow issue. Visual scale at each width is unknown without rendering. |

Long IDs, labels, and numbers generally wrap in rows due to the ≤420px container layout
and `overflow-wrap:anywhere`. Exceptions are permanent dimension labels, the conditions
label, measure label, and the calc count/subtotal, which are nowrap. Many calc chips are
bounded by nested vertical scrolling rather than horizontal page scrolling.

## 4. Type, colour, spacing

### Type

| Actual value | Weight/family | Use | Reference/token status |
|---|---|---|---|
| 11px | 600 sans | Shared small measure controls if the shared `Button` size resolves to its project `text-[11px]` style; direct measure buttons are 12px. | **Below the spec’s 12px hard minimum if rendered here.** Exact shared Button output should be checked in the browser. |
| 12px | 400/500/600 sans or mono | Project status, conditions label, filters, card titles/subtext, gesture hint, quality/status text, chip text, selection title, copy feedback. | In token family; matches hard minimum. Desktop reference uses 10px status, so implementation intentionally differs there. |
| 14px | 600 sans | Project title, calc selected count, Copy/Clear. | Font family is token; calc count is 12px in reference. |
| 16px | 700 sans | “Measurements” heading. | Font family is token. |
| 17px | 600 mono | Row values and units, card hero units/secondary stat, calc group totals, permanent/measure labels, selection value. | Matches the spec hard value rule. Larger than several reference artboard values (13px unit, 15px secondary/dimension). |
| 26px | 600 mono | Card hero number. | Matches hard minimum; reference hero is 25px. |

IBM Plex Sans and IBM Plex Mono come from the Technical-Clean font tokens. Distinct line
heights include default Tailwind line heights, 1.2 on dimension labels, and 1.45 on the
selection box.

### Colours

Core token colours used: background `#fafbfc`, surface `#ffffff`, accent `#2563eb`,
primary text `#16233a`, secondary `#43536e`, line `#e3e8ef`, and project status/card accent
tokens. The viewer shell locally overrides tertiary text to `#4a5568` and accent to
`#1e40af`.

Literal or non-token viewer colours:

| Value | Use | Technical-Clean status |
|---|---|---|
| `#f7fafc` | Viewport/Three scene background | Not a defined token. |
| `#991b1b` | Measure lines and labels | Not a defined token; darker than token error `#b91c1c`. |
| `#101820` | Selection box | Not a defined token. |
| `#cbd5e1` | Selection title | Not a defined token. |
| `#334155` | Default permanent Three line | Not a defined token. |
| `#aab6c4` | Hemisphere ground light | Not a UI token. |
| `#16233A`, `#FAFBFC` literals | Calc/copy notice and model section | Same numeric values as tokens but bypass token names. |
| `#7C8CA8`, `#22324D`, `#45577A` | Calc border, chip, remove icon | Not defined tokens. |
| Tailwind slate/red/emerald/white-alpha classes | Hover surfaces, copy feedback, gesture background | Not named Technical-Clean tokens. |
| `part.color.hex` | Model materials | Data-driven, not governed by UI tokens; appearance unknown. |

No static contrast measurement was run. Compliance with the 6:1 requirement is therefore
**unknown**, especially for secondary/tertiary text, translucent white, and feedback colours.

### Radii, shadows, and spacing

Named Technical-Clean radii are 12px (input), 16px (card), and 20px (large), plus pills.
Actual viewer radii include 4px dimension labels, 8px selection/status/gesture controls,
10px calc buttons, 14px cards and calc bubble, and full pills/toggles. The 4/8/10/14px
values are outside the named token set, although the reference itself uses 4px dimension
labels, 8px selection, 10px toolbar controls, and 14px cards/calc.

Named shadows are card `0 4px 16px rgba(20,30,50,.05)` and accent
`0 2px 8px rgba(37,99,235,.25)`. Actual additional shadows are:

- selection: `0 5px 18px rgba(15,24,32,.3)` — not a token;
- calc: `0 8px 28px rgba(20,30,50,.35)` — not a token, but matches the reference calc;
- Tailwind `shadow-sm` on cards — not a named Technical-Clean token;
- default `shadow` on toggle thumb — not a named Technical-Clean token.

Repeated spacing values include shell/panel padding 16px, header vertical padding 8px,
panel heading 14px top/10px bottom, card/calc radius 14px, card gaps 8–10px, calc padding
10px, dimension padding 4×9px, and selection padding 10×12px. These are utility values,
not spacing tokens in `@theme`; Technical-Clean defines no named spacing scale.

## 5. Touch and states

### Hit areas and hover

No viewer button has a computed CSS minimum below 44×44px because
`.viewer-next-shell button` sets both minimum dimensions to 44px. The panel handle is also
44px high and full width. The calc remove button is explicitly 44×44px, although its visible
inner circle is 20×20px. The conditions switch visual track is 36×20px, but its containing
button receives the 44px minimum.

The gesture hint and snap/copy notices are not interactive. Dimension labels, selection
connector, and overlay layer are pointer-free.

Hover styles (`hover:bg-slate-50`, `hover:bg-slate-100`, card/row hover styles) supplement
click/tap handlers. No identified viewer action is hover-only. Whether nested row targets
are comfortable on a physical touch device is unknown; this audit only establishes CSS hit
boxes.

### Rendered states

- **Loading:** no viewer-specific loading state was found. Measurement-derived cards and the
  model are built synchronously from already supplied data. If an upstream route suspends,
  its loading output is outside this viewer component and was not audited.
- **WebGL cannot start:** renderer/control construction is caught, `webglFailed` becomes
  true, the canvas is replaced by a centred message, and panel measurements remain. Render
  and resize exceptions use the same unavailable path.
- **Model cannot be built:** the model builder catch path returns an empty/degraded model
  plus a `model_failure` diagnostic. `ViewerNextClient` sets model state to `notready`;
  the viewport failure message is shown while panel data remains available.
- **Measurement failed:** warnings and references are shown in the quality-status section,
  and the bottom quality block retains warning strings and disclaimer. Null values remain
  as rows with “—”/verification or add-photo treatment and are not tallyable. A complete
  route-level fetch/extraction failure state is **unknown** because `/viewer-next` currently
  consumes a fixed fixture rather than initiating measurement.
- **Clipboard failure:** the calc reports failure text and does not claim success.
- **Add photo on fixture:** it produces an explicit “capture unavailable” notice; no upload
  occurs.

## 6. Deviations and open questions

### Factual deviations from `docs/viewer-reference/` and binding spec

1. Phone uses the tablet-portrait structure: textual header Reset/Conditions controls,
   a top-right measure pill, top-centre bounded calc bubble, and 72/42/12 grid tracks.
   `viewer-spec.md:152-159,172-173` instead specifies phone-only round viewport controls and
   a full-width calc bar above a bottom sheet.
2. Portrait panel geometry is interactive/detented. The portrait reference export is a
   fixed stacked artboard; it does not itself execute drag detents.
3. At 768 landscape the implementation assigns 480px to the panel and 288px to the model
   section. The spec says “desktop panel and header” but does not state this fixed panel
   width.
4. The implementation adds a quality-status disclosure, dynamic warning block, gesture
   hint, WebGL failure state, snap preview, copy notice, and interactive Three.js overlays
   beyond the static reference markup.
5. Hero is 26px rather than reference 25px. Hero units and secondary values are 17px rather
   than reference 13/15px. Dimension labels are 17px rather than reference 15px. These follow
   the hard legibility rule but are visual deviations.
6. Calc selected count is 14px rather than reference 12px; calc subtotal is 17px rather than
   reference 13px.
7. Reference/token radii conflict: implementation follows reference-like 14px cards and calc
   although Technical-Clean named card radius is 16px. Several other radii and shadows are
   literal values rather than tokens.
8. Several model and overlay colours are literals outside the named token set. Model surface
   colours come from data, so exact reference matching is not guaranteed by the CSS.
9. Permanent dimension labels are not edge-clamped; only the selection box is placement-
   clamped. A tall selection box has no max-height or internal scroll.
10. The full 12dvh portrait position can be shorter than the fixed header/stage. The model
    section scrolls rather than keeping all controls, calc, canvas, and selection visible
    simultaneously.

### Questions requiring visual or device inspection

- Does the 3D house framing remain useful at 288px model width and at each portrait detent?
- Do projected permanent labels collide with each other, the gesture hint, measure pill, calc
  bubble, or screen edges during orbit?
- Can any real selection detail produce a box taller than the exposed viewport and therefore
  be clipped?
- On real iOS/Android browsers, does orientation change reliably trigger host resize and
  correct Three viewport/scissor recomputation?
- Do pinch zoom, two-finger pan, drag-versus-tap gating, three-way sheet dragging, and model-
  section scrolling coexist without gesture conflict?
- Are the literal model materials, lighting intensities, line colours, 14px cards, and
  typography visually close enough to each reference artboard?
- At intermediate widths and with the longest localized labels, where do header controls,
  measure pill, gesture hint, and calc first overlap?
- Do all text/background pairs meet the required 6:1 contrast ratio? Static source review
  did not calculate contrast or inspect antialiasing/compositing.# `/viewer-next` review input

Scope: static code and reference-source audit. Responsiveness is evaluated first, look and
feel second. No measurement was run and no paid API was called. WebGL was not rendered for
this audit; statements about the 3D scene describe the code that constructs and positions it,
not its visual correctness.

## 1. Layout per width

The four review sizes below are the project reference sizes used for §11: desktop
1440×1000, tablet landscape 1024×768, tablet portrait 768×1024, and phone 390×844.

| Size | Actual layout and dimensions | Visible controls | Sheet/detents |
|---|---|---|---|
| Desktop 1440×1000 | Side by side. The panel is fixed at 480px on the right; the model section receives 960px. Both fill `100dvh`. | App-header Add photo, Reset view, and Show conditions. Measure pill bottom-centre. Calc bubble top-centre at 12px. Gesture hint hidden by the ≥1280px query. | Handle hidden; detent state does not affect geometry. |
| Tablet landscape 1024×768 | Side by side because width is ≥768 and orientation is landscape. Panel is 480px; model section receives 544px. | Same header controls. Measure pill bottom-centre. Calc top-centre at 12px. Gesture hint appears only if the pointer is coarse. | Handle hidden; detents do not apply. |
| Tablet portrait 768×1024 | Stacked two-row grid. Default/half model row is 42dvh = 430.08px; panel receives 593.92px. Peek is 72dvh = 737.28px; full is 12dvh = 122.88px. Panel is full width. | Header controls remain. Measure pill top-right at 16px. Calc top-centre at 80px. Gesture hint top-left only on a coarse pointer. | A 44px-high full-width handle cycles or drag-snaps to 72%/42%/12%. Model-section contents can scroll when the row is shorter than their fixed content. |
| Phone 390×844 | Stacked two-row grid. Default/half model row is 42dvh = 354.48px; panel receives 489.52px. Peek is 607.68px; full is 101.28px. Panel is full width. | Same textual header controls as portrait tablet. Measure is a pill at top 34px/right 12px; gesture hint at top 4px/left 12px; calc top-centre at 96px. | Same 72%/42%/12% detents and 44px handle. At full on a short screen, the model section scrolls because its stage is at least 240px or 380px with calc. |

Intermediate-width consequence: any landscape viewport from 768px through 1279px uses the
480px panel. At 768px landscape this leaves 288px for the model section. At 767px landscape
the layout changes to stacked because the landscape media query no longer matches.

The code does **not** create phone-only round Reset/Conditions controls or a bottom calc bar.
That differs from `docs/viewer-spec.md:152-159,167-176`; phone uses the portrait-tablet
composition.

Verbatim layout excerpt (`artifacts/aufmass-app/app/globals.css:181-210,245-250,274-287`;
35 lines):

```css
.viewer-next-shell {
  --color-schrift-tertiaer: #4a5568;
  --color-akzent: #1e40af;
  display: grid;
  grid-template-rows: var(--viewer-top, 42dvh) minmax(0, 1fr);
}
.viewer-next-shell[data-panel-detent="half"] {
  --viewer-top: 42dvh;
}
.viewer-next-shell[data-panel-detent="peek"] {
  --viewer-top: 72dvh;
}
.viewer-next-shell[data-panel-detent="full"] { --viewer-top: 12dvh; }
.viewer-next-model-section { overflow-y: auto; }

.viewer-next-shell button { min-height: 44px; min-width: 44px; }
.viewer-next-stage > .viewer-next-viewport {
  margin-top: max(var(--viewer-calc-bottom, 0px), var(--viewer-control-space, 0px));
}
.viewer-next-stage {
  --viewer-control-space: 80px;
  min-height: 240px;
  flex-shrink: 0;
}
.viewer-next-stage:has([data-calc-bubble]) { min-height: 380px; }
@media (max-width: 600px) {
  .viewer-next-gesture { max-width: calc(100% - 24px); top: 4px; left: 12px; }
  .viewer-next-measure-portrait { top: 34px; right: 12px; }
  .viewer-next-stage { --viewer-control-space: 96px; }
  .viewer-next-calc-bubble { top: 96px; }
}
@media (min-width: 768px) and (orientation: landscape) {
  .viewer-next-model-section { overflow: hidden; }
  .viewer-next-stage, .viewer-next-stage:has([data-calc-bubble]) { min-height: 0; }
  .viewer-next-shell { display: flex; flex-direction: row; }
  .viewer-next-panel { position: static; width: 480px; }
}
```

## 2. The 3D viewport

### Canvas sizing and resize

`ViewerViewport.tsx:645-683` observes the viewport host with `ResizeObserver`. Every observed
size change reads the host rectangle, caps device pixel ratio at 2, calls
`renderer.setSize(width, height, false)`, reapplies the exposed Three.js viewport, renders,
and updates DOM overlays. The same viewport synchronization occurs during orbit damping and
when the scrollable model section moves.

```ts
const setSize = () => {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  syncPainterViewport(state, host);
  renderer.render(scene, camera);
  updateOverlaysRef.current.invoke();
};
const resizeObserver = new ResizeObserver(setSize);
resizeObserver.observe(host);
const scrollContainer = host.closest(".viewer-next-model-section");
scrollContainer?.addEventListener("scroll", render, { passive: true });
```

There is no explicit `orientationchange` listener. Orientation changes are handled indirectly:
CSS switches between grid and side-by-side layout, then `ResizeObserver` reacts to the host
size. Whether every browser emits the needed resize sequence is **unknown** without device
testing.

`getViewportMetrics` (`ViewerViewport.tsx:221-240`) detects whether the panel overlaps the
host. The Three viewport and scissor are restricted to the exposed area above the sheet.
`applyExposedViewport` updates camera aspect, view offset, projection matrix, viewport, and
scissor. A side-by-side panel does not reduce canvas height.

### Camera and scene

The camera does not get a separate narrow-screen position. All widths start from the same
model-relative formula (`ViewerViewport.tsx:566-598`):

```ts
const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000000);
camera.up.set(0, 0, 1);
const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
const initialPosition = new THREE.Vector3(
  centre.x + span * 1.28,
  centre.y - span * 1.52,
  centre.z + span * 0.82,
);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = Math.max(span * 0.15, 100);
controls.maxDistance = span * 8;
```

The scene uses a `#f7fafc` background, hemisphere light intensity 1.9, directional light
intensity 2.2, data-driven material colours, and separate groups for geometry, conditions,
measure lines, permanent dimensions, and selection. Whether the building is framed well or
looks correct at any width is **unknown** because this audit did not render WebGL.

### Dimension labels and selection

Permanent width/ridge/eave labels and user-measure labels are projected from the midpoint of
their 3D segment into the exposed viewport (`ViewerViewport.tsx:343-370`). Their DOM labels
are absolutely positioned at that point and translated by `-50%,-50%`. They are 17px/600
IBM Plex Mono, single-line, with 4px × 9px padding. Permanent labels are white rectangles
with 4px radius; measure labels are white on `#991b1b`.

The selection placement code projects all selected-element corners, derives a screen-space
bounding rectangle, measures the actual selection box, and evaluates right/left/below/above
candidates. Control rectangles marked `data-control` are penalized. The chosen position is
then clamped:

```ts
const left = Math.max(0,
  Math.min(Math.max(0, viewport.width - box.width), chosen.left));
const top = Math.max(0,
  Math.min(Math.max(0, viewport.height - box.height), chosen.top));
```

The selection box is `max-width: calc(100% - 8px)`, uses normal wrapping, and the overlay
host clips overflow. Therefore, for content whose measured width and height fit the exposed
viewport, the box is clamped inside it. At 390px width the CSS maximum is 382px.

Can the selection box leave the visible area at the smallest width? **Horizontally, the code
prevents it for a measured box no wider than the CSS maximum. Vertically, unknown for every
possible content string:** if the rendered box becomes taller than the exposed viewport,
the clamp reduces `top` to 0 but cannot reduce its height; the overflow-hidden host will clip
the bottom. No max-height or internal selection-box scrolling is defined. Permanent
dimension labels are not clamped at all and can be clipped at any edge.

The smallest model-label type at every width is 17px for dimensions and selection values;
the selection title is 12px. Width does not change these sizes.

## 3. Fixed sizes and overflow

The table lists viewer-specific hard constraints and the first code-defined threshold where
they change, clip, or scroll. “Unknown” means the exact content-dependent failure width
cannot be derived without rendering.

| Constraint | File/value | Behaviour and threshold |
|---|---|---|
| Shell height | `ViewerNextClient.tsx:397`, `h-[100dvh]` | Page itself is fixed to the dynamic viewport height and hides outer overflow. Internal regions must scroll. |
| Side panel | `globals.css:287,316`, `width:480px` | Applies at landscape width ≥768 or any width ≥1280. Leaves 288px model width at 768 landscape, 544px at 1024, 960px at 1440. |
| Portrait tracks | `globals.css:186-194`, 72/42/12dvh | Full leaves only 68.16px at 320×568 and 101.28px at 390×844 for the model row. Fixed stage content then scrolls vertically. |
| Model stage | `globals.css:201-206`, minimum 240px; 380px with calc | On portrait full, vertical model-section scrolling starts whenever 12dvh is below header plus stage content. With the 56px header, that is all viewport heights below about 2467px without calc and 3633px with calc. |
| Reserved control space | `globals.css:202,248`, 80px; 96px at ≤600 | Canvas starts below this reservation or the measured calc bottom. It reduces visible canvas height; exact resulting size depends on bubble height. |
| Calc location/size | `globals.css:207-215`, top 80px/96px phone/12px landscape; max-width `min(680px,100%-24px)`; height 64–164px | It stays 12px from horizontal edges at narrow widths and scrolls vertically above 164px. At ≤600×700 with a selection, max-height becomes 64px. |
| Calc JSX width | `CalcBubble.tsx:63`, `max-w-[min(72%,680px)]` plus CSS `width:max-content` | Tailwind’s 72% maximum and the CSS 100%-24px maximum both apply; at 390px, 72% is about 281px. Count and subtotal are nowrap, so wrapping occurs between flex items; long content may force bubble scrolling/word breaks. Exact collision width is unknown. |
| Calc chip list | `CalcBubble.tsx:101`, max-height 128px, vertical scroll | Many chips wrap and scroll inside the list; the outer bubble can also scroll. Long labels can break via `overflow-wrap:anywhere`. |
| Calc buttons | 44px minimum height; 10px radius; horizontal padding 14px | Copy/Clear can wrap to another flex line. No fixed column count. |
| Panel heading | `globals.css:217-229`, min-height 48px, max-height panel-108px, vertical scroll | Status/filter header scrolls when it outgrows available panel height. Panel card scroller retains at least 64px. |
| Status detail | `ViewerNextClient.tsx:588`, max-height 144px, vertical scroll | Long warnings scroll inside status detail. |
| Header | `ViewerNextClient.tsx:401`, minimum 56px, flex-wrap | Project text truncates; controls wrap and increase header height. At phone width all header controls do not remain on one line. Exact first wrap width depends on localized labels and font metrics: unknown. |
| Conditions control | `ViewerNextClient.tsx:429`, `whitespace-nowrap`; switch 36×20px internally | The button itself is forced to at least 44×44 by viewer CSS. Its label does not break; it moves as a flex item when the header wraps. |
| Measure controls | absolute top-right or bottom-centre; 44px min target; nowrap button text | At phone, hint and measure occupy separate vertical offsets. Long localized labels can widen leftward; first overlap width is unknown. |
| Gesture hint | absolute; nowrap; at phone max-width `100%-24px` | Text itself does not declare wrapping; if wider than max-width it can overflow its box. Exact width depends on font rendering. |
| Selection box | max-width `100%-8px`, padding 10×12px, normal wrap | Horizontal position is clamped. No max-height; tall content can be clipped vertically. |
| Dimension labels | nowrap; 17px; padding 4×9px; absolute centred | Long dimension strings never wrap and are not clamped; they clip when their projected midpoint is less than half the label width from an edge. Content-dependent threshold unknown. |
| Row labels | `globals.css:230`, min-width `min(140px,100%)` | At panel container ≤420px, row buttons become a two-column grid and labels span both columns. Long labels wrap; no sideways document overflow is intentionally introduced. |
| Row values | 17px/600 mono; normal white-space, flex-wrap; descendants `overflow-wrap:anywhere` | Large numbers/units can wrap. No fixed value width remains. |
| Row action buttons | global minimum 44×44 | Actions occupy the auto column at panel ≤420px. Multiple actions remain side by side; exact width where they force wrapping is content-dependent. |
| Cards | 14px radius, horizontal panel padding 16px | At 390px, nominal card width is 358px before borders. At 320px, 288px. |
| Panel handle | 44px high, full width; visible below side-by-side breakpoint | Internal visual bar is 40×4px, but the button hit area is 44px high. |
| Camera marker | sphere radius `max(span*0.012,50)` | World-space fixed lower bound, not a CSS overflow issue. Visual scale at each width is unknown without rendering. |

Long IDs, labels, and numbers generally wrap in rows due to the ≤420px container layout
and `overflow-wrap:anywhere`. Exceptions are permanent dimension labels, the conditions
label, measure label, and the calc count/subtotal, which are nowrap. Many calc chips are
bounded by nested vertical scrolling rather than horizontal page scrolling.

## 4. Type, colour, spacing

### Type

| Actual value | Weight/family | Use | Reference/token status |
|---|---|---|---|
| 11px | 600 sans | Shared small measure controls if the shared `Button` size resolves to its project `text-[11px]` style; direct measure buttons are 12px. | **Below the spec’s 12px hard minimum if rendered here.** Exact shared Button output should be checked in the browser. |
| 12px | 400/500/600 sans or mono | Project status, conditions label, filters, card titles/subtext, gesture hint, quality/status text, chip text, selection title, copy feedback. | In token family; matches hard minimum. Desktop reference uses 10px status, so implementation intentionally differs there. |
| 14px | 600 sans | Project title, calc selected count, Copy/Clear. | Font family is token; calc count is 12px in reference. |
| 16px | 700 sans | “Measurements” heading. | Font family is token. |
| 17px | 600 mono | Row values and units, card hero units/secondary stat, calc group totals, permanent/measure labels, selection value. | Matches the spec hard value rule. Larger than several reference artboard values (13px unit, 15px secondary/dimension). |
| 26px | 600 mono | Card hero number. | Matches hard minimum; reference hero is 25px. |

IBM Plex Sans and IBM Plex Mono come from the Technical-Clean font tokens. Distinct line
heights include default Tailwind line heights, 1.2 on dimension labels, and 1.45 on the
selection box.

### Colours

Core token colours used: background `#fafbfc`, surface `#ffffff`, accent `#2563eb`,
primary text `#16233a`, secondary `#43536e`, line `#e3e8ef`, and project status/card accent
tokens. The viewer shell locally overrides tertiary text to `#4a5568` and accent to
`#1e40af`.

Literal or non-token viewer colours:

| Value | Use | Technical-Clean status |
|---|---|---|
| `#f7fafc` | Viewport/Three scene background | Not a defined token. |
| `#991b1b` | Measure lines and labels | Not a defined token; darker than token error `#b91c1c`. |
| `#101820` | Selection box | Not a defined token. |
| `#cbd5e1` | Selection title | Not a defined token. |
| `#334155` | Default permanent Three line | Not a defined token. |
| `#aab6c4` | Hemisphere ground light | Not a UI token. |
| `#16233A`, `#FAFBFC` literals | Calc/copy notice and model section | Same numeric values as tokens but bypass token names. |
| `#7C8CA8`, `#22324D`, `#45577A` | Calc border, chip, remove icon | Not defined tokens. |
| Tailwind slate/red/emerald/white-alpha classes | Hover surfaces, copy feedback, gesture background | Not named Technical-Clean tokens. |
| `part.color.hex` | Model materials | Data-driven, not governed by UI tokens; appearance unknown. |

No static contrast measurement was run. Compliance with the 6:1 requirement is therefore
**unknown**, especially for secondary/tertiary text, translucent white, and feedback colours.

### Radii, shadows, and spacing

Named Technical-Clean radii are 12px (input), 16px (card), and 20px (large), plus pills.
Actual viewer radii include 4px dimension labels, 8px selection/status/gesture controls,
10px calc buttons, 14px cards and calc bubble, and full pills/toggles. The 4/8/10/14px
values are outside the named token set, although the reference itself uses 4px dimension
labels, 8px selection, 10px toolbar controls, and 14px cards/calc.

Named shadows are card `0 4px 16px rgba(20,30,50,.05)` and accent
`0 2px 8px rgba(37,99,235,.25)`. Actual additional shadows are:

- selection: `0 5px 18px rgba(15,24,32,.3)` — not a token;
- calc: `0 8px 28px rgba(20,30,50,.35)` — not a token, but matches the reference calc;
- Tailwind `shadow-sm` on cards — not a named Technical-Clean token;
- default `shadow` on toggle thumb — not a named Technical-Clean token.

Repeated spacing values include shell/panel padding 16px, header vertical padding 8px,
panel heading 14px top/10px bottom, card/calc radius 14px, card gaps 8–10px, calc padding
10px, dimension padding 4×9px, and selection padding 10×12px. These are utility values,
not spacing tokens in `@theme`; Technical-Clean defines no named spacing scale.

## 5. Touch and states

### Hit areas and hover

No viewer button has a computed CSS minimum below 44×44px because
`.viewer-next-shell button` sets both minimum dimensions to 44px. The panel handle is also
44px high and full width. The calc remove button is explicitly 44×44px, although its visible
inner circle is 20×20px. The conditions switch visual track is 36×20px, but its containing
button receives the 44px minimum.

The gesture hint and snap/copy notices are not interactive. Dimension labels, selection
connector, and overlay layer are pointer-free.

Hover styles (`hover:bg-slate-50`, `hover:bg-slate-100`, card/row hover styles) supplement
click/tap handlers. No identified viewer action is hover-only. Whether nested row targets
are comfortable on a physical touch device is unknown; this audit only establishes CSS hit
boxes.

### Rendered states

- **Loading:** no viewer-specific loading state was found. Measurement-derived cards and the
  model are built synchronously from already supplied data. If an upstream route suspends,
  its loading output is outside this viewer component and was not audited.
- **WebGL cannot start:** renderer/control construction is caught, `webglFailed` becomes
  true, the canvas is replaced by a centred message, and panel measurements remain. Render
  and resize exceptions use the same unavailable path.
- **Model cannot be built:** the model builder catch path returns an empty/degraded model
  plus a `model_failure` diagnostic. `ViewerNextClient` sets model state to `notready`;
  the viewport failure message is shown while panel data remains available.
- **Measurement failed:** warnings and references are shown in the quality-status section,
  and the bottom quality block retains warning strings and disclaimer. Null values remain
  as rows with “—”/verification or add-photo treatment and are not tallyable. A complete
  route-level fetch/extraction failure state is **unknown** because `/viewer-next` currently
  consumes a fixed fixture rather than initiating measurement.
- **Clipboard failure:** the calc reports failure text and does not claim success.
- **Add photo on fixture:** it produces an explicit “capture unavailable” notice; no upload
  occurs.

## 6. Deviations and open questions

### Factual deviations from `docs/viewer-reference/` and binding spec

1. Phone uses the tablet-portrait structure: textual header Reset/Conditions controls,
   a top-right measure pill, top-centre bounded calc bubble, and 72/42/12 grid tracks.
   `viewer-spec.md:152-159,172-173` instead specifies phone-only round viewport controls and
   a full-width calc bar above a bottom sheet.
2. Portrait panel geometry is interactive/detented. The portrait reference export is a
   fixed stacked artboard; it does not itself execute drag detents.
3. At 768 landscape the implementation assigns 480px to the panel and 288px to the model
   section. The spec says “desktop panel and header” but does not state this fixed panel
   width.
4. The implementation adds a quality-status disclosure, dynamic warning block, gesture
   hint, WebGL failure state, snap preview, copy notice, and interactive Three.js overlays
   beyond the static reference markup.
5. Hero is 26px rather than reference 25px. Hero units and secondary values are 17px rather
   than reference 13/15px. Dimension labels are 17px rather than reference 15px. These follow
   the hard legibility rule but are visual deviations.
6. Calc selected count is 14px rather than reference 12px; calc subtotal is 17px rather than
   reference 13px.
7. Reference/token radii conflict: implementation follows reference-like 14px cards and calc
   although Technical-Clean named card radius is 16px. Several other radii and shadows are
   literal values rather than tokens.
8. Several model and overlay colours are literals outside the named token set. Model surface
   colours come from data, so exact reference matching is not guaranteed by the CSS.
9. Permanent dimension labels are not edge-clamped; only the selection box is placement-
   clamped. A tall selection box has no max-height or internal scroll.
10. The full 12dvh portrait position can be shorter than the fixed header/stage. The model
    section scrolls rather than keeping all controls, calc, canvas, and selection visible
    simultaneously.

### Questions requiring visual or device inspection

- Does the 3D house framing remain useful at 288px model width and at each portrait detent?
- Do projected permanent labels collide with each other, the gesture hint, measure pill, calc
  bubble, or screen edges during orbit?
- Can any real selection detail produce a box taller than the exposed viewport and therefore
  be clipped?
- On real iOS/Android browsers, does orientation change reliably trigger host resize and
  correct Three viewport/scissor recomputation?
- Do pinch zoom, two-finger pan, drag-versus-tap gating, three-way sheet dragging, and model-
  section scrolling coexist without gesture conflict?
- Are the literal model materials, lighting intensities, line colours, 14px cards, and
  typography visually close enough to each reference artboard?
- At intermediate widths and with the longest localized labels, where do header controls,
  measure pill, gesture hint, and calc first overlap?
- Do all text/background pairs meet the required 6:1 contrast ratio? Static source review
  did not calculate contrast or inspect antialiasing/compositing.# `/viewer-next` review input

Scope: static code and reference-source audit. Responsiveness is evaluated first, look and
feel second. No measurement was run and no paid API was called. WebGL was not rendered for
this audit; statements about the 3D scene describe the code that constructs and positions it,
not its visual correctness.

## 1. Layout per width

The four review sizes below are the project reference sizes used for §11: desktop
1440×1000, tablet landscape 1024×768, tablet portrait 768×1024, and phone 390×844.

| Size | Actual layout and dimensions | Visible controls | Sheet/detents |
|---|---|---|---|
| Desktop 1440×1000 | Side by side. The panel is fixed at 480px on the right; the model section receives 960px. Both fill `100dvh`. | App-header Add photo, Reset view, and Show conditions. Measure pill bottom-centre. Calc bubble top-centre at 12px. Gesture hint hidden by the ≥1280px query. | Handle hidden; detent state does not affect geometry. |
| Tablet landscape 1024×768 | Side by side because width is ≥768 and orientation is landscape. Panel is 480px; model section receives 544px. | Same header controls. Measure pill bottom-centre. Calc top-centre at 12px. Gesture hint appears only if the pointer is coarse. | Handle hidden; detents do not apply. |
| Tablet portrait 768×1024 | Stacked two-row grid. Default/half model row is 42dvh = 430.08px; panel receives 593.92px. Peek is 72dvh = 737.28px; full is 12dvh = 122.88px. Panel is full width. | Header controls remain. Measure pill top-right at 16px. Calc top-centre at 80px. Gesture hint top-left only on a coarse pointer. | A 44px-high full-width handle cycles or drag-snaps to 72%/42%/12%. Model-section contents can scroll when the row is shorter than their fixed content. |
| Phone 390×844 | Stacked two-row grid. Default/half model row is 42dvh = 354.48px; panel receives 489.52px. Peek is 607.68px; full is 101.28px. Panel is full width. | Same textual header controls as portrait tablet. Measure is a pill at top 34px/right 12px; gesture hint at top 4px/left 12px; calc top-centre at 96px. | Same 72%/42%/12% detents and 44px handle. At full on a short screen, the model section scrolls because its stage is at least 240px or 380px with calc. |

Intermediate-width consequence: any landscape viewport from 768px through 1279px uses the
480px panel. At 768px landscape this leaves 288px for the model section. At 767px landscape
the layout changes to stacked because the landscape media query no longer matches.

The code does **not** create phone-only round Reset/Conditions controls or a bottom calc bar.
That differs from `docs/viewer-spec.md:152-159,167-176`; phone uses the portrait-tablet
composition.

Verbatim layout excerpt (`artifacts/aufmass-app/app/globals.css:181-210,245-250,274-287`;
35 lines):

```css
.viewer-next-shell {
  --color-schrift-tertiaer: #4a5568;
  --color-akzent: #1e40af;
  display: grid;
  grid-template-rows: var(--viewer-top, 42dvh) minmax(0, 1fr);
}
.viewer-next-shell[data-panel-detent="half"] {
  --viewer-top: 42dvh;
}
.viewer-next-shell[data-panel-detent="peek"] {
  --viewer-top: 72dvh;
}
.viewer-next-shell[data-panel-detent="full"] { --viewer-top: 12dvh; }
.viewer-next-model-section { overflow-y: auto; }

.viewer-next-shell button { min-height: 44px; min-width: 44px; }
.viewer-next-stage > .viewer-next-viewport {
  margin-top: max(var(--viewer-calc-bottom, 0px), var(--viewer-control-space, 0px));
}
.viewer-next-stage {
  --viewer-control-space: 80px;
  min-height: 240px;
  flex-shrink: 0;
}
.viewer-next-stage:has([data-calc-bubble]) { min-height: 380px; }
@media (max-width: 600px) {
  .viewer-next-gesture { max-width: calc(100% - 24px); top: 4px; left: 12px; }
  .viewer-next-measure-portrait { top: 34px; right: 12px; }
  .viewer-next-stage { --viewer-control-space: 96px; }
  .viewer-next-calc-bubble { top: 96px; }
}
@media (min-width: 768px) and (orientation: landscape) {
  .viewer-next-model-section { overflow: hidden; }
  .viewer-next-stage, .viewer-next-stage:has([data-calc-bubble]) { min-height: 0; }
  .viewer-next-shell { display: flex; flex-direction: row; }
  .viewer-next-panel { position: static; width: 480px; }
}
```

## 2. The 3D viewport

### Canvas sizing and resize

`ViewerViewport.tsx:645-683` observes the viewport host with `ResizeObserver`. Every observed
size change reads the host rectangle, caps device pixel ratio at 2, calls
`renderer.setSize(width, height, false)`, reapplies the exposed Three.js viewport, renders,
and updates DOM overlays. The same viewport synchronization occurs during orbit damping and
when the scrollable model section moves.

```ts
const setSize = () => {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  syncPainterViewport(state, host);
  renderer.render(scene, camera);
  updateOverlaysRef.current.invoke();
};
const resizeObserver = new ResizeObserver(setSize);
resizeObserver.observe(host);
const scrollContainer = host.closest(".viewer-next-model-section");
scrollContainer?.addEventListener("scroll", render, { passive: true });
```

There is no explicit `orientationchange` listener. Orientation changes are handled indirectly:
CSS switches between grid and side-by-side layout, then `ResizeObserver` reacts to the host
size. Whether every browser emits the needed resize sequence is **unknown** without device
testing.

`getViewportMetrics` (`ViewerViewport.tsx:221-240`) detects whether the panel overlaps the
host. The Three viewport and scissor are restricted to the exposed area above the sheet.
`applyExposedViewport` updates camera aspect, view offset, projection matrix, viewport, and
scissor. A side-by-side panel does not reduce canvas height.

### Camera and scene

The camera does not get a separate narrow-screen position. All widths start from the same
model-relative formula (`ViewerViewport.tsx:566-598`):

```ts
const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000000);
camera.up.set(0, 0, 1);
const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
const initialPosition = new THREE.Vector3(
  centre.x + span * 1.28,
  centre.y - span * 1.52,
  centre.z + span * 0.82,
);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = Math.max(span * 0.15, 100);
controls.maxDistance = span * 8;
```

The scene uses a `#f7fafc` background, hemisphere light intensity 1.9, directional light
intensity 2.2, data-driven material colours, and separate groups for geometry, conditions,
measure lines, permanent dimensions, and selection. Whether the building is framed well or
looks correct at any width is **unknown** because this audit did not render WebGL.

### Dimension labels and selection

Permanent width/ridge/eave labels and user-measure labels are projected from the midpoint of
their 3D segment into the exposed viewport (`ViewerViewport.tsx:343-370`). Their DOM labels
are absolutely positioned at that point and translated by `-50%,-50%`. They are 17px/600
IBM Plex Mono, single-line, with 4px × 9px padding. Permanent labels are white rectangles
with 4px radius; measure labels are white on `#991b1b`.

The selection placement code projects all selected-element corners, derives a screen-space
bounding rectangle, measures the actual selection box, and evaluates right/left/below/above
candidates. Control rectangles marked `data-control` are penalized. The chosen position is
then clamped:

```ts
const left = Math.max(0,
  Math.min(Math.max(0, viewport.width - box.width), chosen.left));
const top = Math.max(0,
  Math.min(Math.max(0, viewport.height - box.height), chosen.top));
```

The selection box is `max-width: calc(100% - 8px)`, uses normal wrapping, and the overlay
host clips overflow. Therefore, for content whose measured width and height fit the exposed
viewport, the box is clamped inside it. At 390px width the CSS maximum is 382px.

Can the selection box leave the visible area at the smallest width? **Horizontally, the code
prevents it for a measured box no wider than the CSS maximum. Vertically, unknown for every
possible content string:** if the rendered box becomes taller than the exposed viewport,
the clamp reduces `top` to 0 but cannot reduce its height; the overflow-hidden host will clip
the bottom. No max-height or internal selection-box scrolling is defined. Permanent
dimension labels are not clamped at all and can be clipped at any edge.

The smallest model-label type at every width is 17px for dimensions and selection values;
the selection title is 12px. Width does not change these sizes.

## 3. Fixed sizes and overflow

The table lists viewer-specific hard constraints and the first code-defined threshold where
they change, clip, or scroll. “Unknown” means the exact content-dependent failure width
cannot be derived without rendering.

| Constraint | File/value | Behaviour and threshold |
|---|---|---|
| Shell height | `ViewerNextClient.tsx:397`, `h-[100dvh]` | Page itself is fixed to the dynamic viewport height and hides outer overflow. Internal regions must scroll. |
| Side panel | `globals.css:287,316`, `width:480px` | Applies at landscape width ≥768 or any width ≥1280. Leaves 288px model width at 768 landscape, 544px at 1024, 960px at 1440. |
| Portrait tracks | `globals.css:186-194`, 72/42/12dvh | Full leaves only 68.16px at 320×568 and 101.28px at 390×844 for the model row. Fixed stage content then scrolls vertically. |
| Model stage | `globals.css:201-206`, minimum 240px; 380px with calc | On portrait full, vertical model-section scrolling starts whenever 12dvh is below header plus stage content. With the 56px header, that is all viewport heights below about 2467px without calc and 3633px with calc. |
| Reserved control space | `globals.css:202,248`, 80px; 96px at ≤600 | Canvas starts below this reservation or the measured calc bottom. It reduces visible canvas height; exact resulting size depends on bubble height. |
| Calc location/size | `globals.css:207-215`, top 80px/96px phone/12px landscape; max-width `min(680px,100%-24px)`; height 64–164px | It stays 12px from horizontal edges at narrow widths and scrolls vertically above 164px. At ≤600×700 with a selection, max-height becomes 64px. |
| Calc JSX width | `CalcBubble.tsx:63`, `max-w-[min(72%,680px)]` plus CSS `width:max-content` | Tailwind’s 72% maximum and the CSS 100%-24px maximum both apply; at 390px, 72% is about 281px. Count and subtotal are nowrap, so wrapping occurs between flex items; long content may force bubble scrolling/word breaks. Exact collision width is unknown. |
| Calc chip list | `CalcBubble.tsx:101`, max-height 128px, vertical scroll | Many chips wrap and scroll inside the list; the outer bubble can also scroll. Long labels can break via `overflow-wrap:anywhere`. |
| Calc buttons | 44px minimum height; 10px radius; horizontal padding 14px | Copy/Clear can wrap to another flex line. No fixed column count. |
| Panel heading | `globals.css:217-229`, min-height 48px, max-height panel-108px, vertical scroll | Status/filter header scrolls when it outgrows available panel height. Panel card scroller retains at least 64px. |
| Status detail | `ViewerNextClient.tsx:588`, max-height 144px, vertical scroll | Long warnings scroll inside status detail. |
| Header | `ViewerNextClient.tsx:401`, minimum 56px, flex-wrap | Project text truncates; controls wrap and increase header height. At phone width all header controls do not remain on one line. Exact first wrap width depends on localized labels and font metrics: unknown. |
| Conditions control | `ViewerNextClient.tsx:429`, `whitespace-nowrap`; switch 36×20px internally | The button itself is forced to at least 44×44 by viewer CSS. Its label does not break; it moves as a flex item when the header wraps. |
| Measure controls | absolute top-right or bottom-centre; 44px min target; nowrap button text | At phone, hint and measure occupy separate vertical offsets. Long localized labels can widen leftward; first overlap width is unknown. |
| Gesture hint | absolute; nowrap; at phone max-width `100%-24px` | Text itself does not declare wrapping; if wider than max-width it can overflow its box. Exact width depends on font rendering. |
| Selection box | max-width `100%-8px`, padding 10×12px, normal wrap | Horizontal position is clamped. No max-height; tall content can be clipped vertically. |
| Dimension labels | nowrap; 17px; padding 4×9px; absolute centred | Long dimension strings never wrap and are not clamped; they clip when their projected midpoint is less than half the label width from an edge. Content-dependent threshold unknown. |
| Row labels | `globals.css:230`, min-width `min(140px,100%)` | At panel container ≤420px, row buttons become a two-column grid and labels span both columns. Long labels wrap; no sideways document overflow is intentionally introduced. |
| Row values | 17px/600 mono; normal white-space, flex-wrap; descendants `overflow-wrap:anywhere` | Large numbers/units can wrap. No fixed value width remains. |
| Row action buttons | global minimum 44×44 | Actions occupy the auto column at panel ≤420px. Multiple actions remain side by side; exact width where they force wrapping is content-dependent. |
| Cards | 14px radius, horizontal panel padding 16px | At 390px, nominal card width is 358px before borders. At 320px, 288px. |
| Panel handle | 44px high, full width; visible below side-by-side breakpoint | Internal visual bar is 40×4px, but the button hit area is 44px high. |
| Camera marker | sphere radius `max(span*0.012,50)` | World-space fixed lower bound, not a CSS overflow issue. Visual scale at each width is unknown without rendering. |

Long IDs, labels, and numbers generally wrap in rows due to the ≤420px container layout
and `overflow-wrap:anywhere`. Exceptions are permanent dimension labels, the conditions
label, measure label, and the calc count/subtotal, which are nowrap. Many calc chips are
bounded by nested vertical scrolling rather than horizontal page scrolling.

## 4. Type, colour, spacing

### Type

| Actual value | Weight/family | Use | Reference/token status |
|---|---|---|---|
| 11px | 600 sans | Shared small measure controls if the shared `Button` size resolves to its project `text-[11px]` style; direct measure buttons are 12px. | **Below the spec’s 12px hard minimum if rendered here.** Exact shared Button output should be checked in the browser. |
| 12px | 400/500/600 sans or mono | Project status, conditions label, filters, card titles/subtext, gesture hint, quality/status text, chip text, selection title, copy feedback. | In token family; matches hard minimum. Desktop reference uses 10px status, so implementation intentionally differs there. |
| 14px | 600 sans | Project title, calc selected count, Copy/Clear. | Font family is token; calc count is 12px in reference. |
| 16px | 700 sans | “Measurements” heading. | Font family is token. |
| 17px | 600 mono | Row values and units, card hero units/secondary stat, calc group totals, permanent/measure labels, selection value. | Matches the spec hard value rule. Larger than several reference artboard values (13px unit, 15px secondary/dimension). |
| 26px | 600 mono | Card hero number. | Matches hard minimum; reference hero is 25px. |

IBM Plex Sans and IBM Plex Mono come from the Technical-Clean font tokens. Distinct line
heights include default Tailwind line heights, 1.2 on dimension labels, and 1.45 on the
selection box.

### Colours

Core token colours used: background `#fafbfc`, surface `#ffffff`, accent `#2563eb`,
primary text `#16233a`, secondary `#43536e`, line `#e3e8ef`, and project status/card accent
tokens. The viewer shell locally overrides tertiary text to `#4a5568` and accent to
`#1e40af`.

Literal or non-token viewer colours:

| Value | Use | Technical-Clean status |
|---|---|---|
| `#f7fafc` | Viewport/Three scene background | Not a defined token. |
| `#991b1b` | Measure lines and labels | Not a defined token; darker than token error `#b91c1c`. |
| `#101820` | Selection box | Not a defined token. |
| `#cbd5e1` | Selection title | Not a defined token. |
| `#334155` | Default permanent Three line | Not a defined token. |
| `#aab6c4` | Hemisphere ground light | Not a UI token. |
| `#16233A`, `#FAFBFC` literals | Calc/copy notice and model section | Same numeric values as tokens but bypass token names. |
| `#7C8CA8`, `#22324D`, `#45577A` | Calc border, chip, remove icon | Not defined tokens. |
| Tailwind slate/red/emerald/white-alpha classes | Hover surfaces, copy feedback, gesture background | Not named Technical-Clean tokens. |
| `part.color.hex` | Model materials | Data-driven, not governed by UI tokens; appearance unknown. |

No static contrast measurement was run. Compliance with the 6:1 requirement is therefore
**unknown**, especially for secondary/tertiary text, translucent white, and feedback colours.

### Radii, shadows, and spacing

Named Technical-Clean radii are 12px (input), 16px (card), and 20px (large), plus pills.
Actual viewer radii include 4px dimension labels, 8px selection/status/gesture controls,
10px calc buttons, 14px cards and calc bubble, and full pills/toggles. The 4/8/10/14px
values are outside the named token set, although the reference itself uses 4px dimension
labels, 8px selection, 10px toolbar controls, and 14px cards/calc.

Named shadows are card `0 4px 16px rgba(20,30,50,.05)` and accent
`0 2px 8px rgba(37,99,235,.25)`. Actual additional shadows are:

- selection: `0 5px 18px rgba(15,24,32,.3)` — not a token;
- calc: `0 8px 28px rgba(20,30,50,.35)` — not a token, but matches the reference calc;
- Tailwind `shadow-sm` on cards — not a named Technical-Clean token;
- default `shadow` on toggle thumb — not a named Technical-Clean token.

Repeated spacing values include shell/panel padding 16px, header vertical padding 8px,
panel heading 14px top/10px bottom, card/calc radius 14px, card gaps 8–10px, calc padding
10px, dimension padding 4×9px, and selection padding 10×12px. These are utility values,
not spacing tokens in `@theme`; Technical-Clean defines no named spacing scale.

## 5. Touch and states

### Hit areas and hover

No viewer button has a computed CSS minimum below 44×44px because
`.viewer-next-shell button` sets both minimum dimensions to 44px. The panel handle is also
44px high and full width. The calc remove button is explicitly 44×44px, although its visible
inner circle is 20×20px. The conditions switch visual track is 36×20px, but its containing
button receives the 44px minimum.

The gesture hint and snap/copy notices are not interactive. Dimension labels, selection
connector, and overlay layer are pointer-free.

Hover styles (`hover:bg-slate-50`, `hover:bg-slate-100`, card/row hover styles) supplement
click/tap handlers. No identified viewer action is hover-only. Whether nested row targets
are comfortable on a physical touch device is unknown; this audit only establishes CSS hit
boxes.

### Rendered states

- **Loading:** no viewer-specific loading state was found. Measurement-derived cards and the
  model are built synchronously from already supplied data. If an upstream route suspends,
  its loading output is outside this viewer component and was not audited.
- **WebGL cannot start:** renderer/control construction is caught, `webglFailed` becomes
  true, the canvas is replaced by a centred message, and panel measurements remain. Render
  and resize exceptions use the same unavailable path.
- **Model cannot be built:** the model builder catch path returns an empty/degraded model
  plus a `model_failure` diagnostic. `ViewerNextClient` sets model state to `notready`;
  the viewport failure message is shown while panel data remains available.
- **Measurement failed:** warnings and references are shown in the quality-status section,
  and the bottom quality block retains warning strings and disclaimer. Null values remain
  as rows with “—”/verification or add-photo treatment and are not tallyable. A complete
  route-level fetch/extraction failure state is **unknown** because `/viewer-next` currently
  consumes a fixed fixture rather than initiating measurement.
- **Clipboard failure:** the calc reports failure text and does not claim success.
- **Add photo on fixture:** it produces an explicit “capture unavailable” notice; no upload
  occurs.

## 6. Deviations and open questions

### Factual deviations from `docs/viewer-reference/` and binding spec

1. Phone uses the tablet-portrait structure: textual header Reset/Conditions controls,
   a top-right measure pill, top-centre bounded calc bubble, and 72/42/12 grid tracks.
   `viewer-spec.md:152-159,172-173` instead specifies phone-only round viewport controls and
   a full-width calc bar above a bottom sheet.
2. Portrait panel geometry is interactive/detented. The portrait reference export is a
   fixed stacked artboard; it does not itself execute drag detents.
3. At 768 landscape the implementation assigns 480px to the panel and 288px to the model
   section. The spec says “desktop panel and header” but does not state this fixed panel
   width.
4. The implementation adds a quality-status disclosure, dynamic warning block, gesture
   hint, WebGL failure state, snap preview, copy notice, and interactive Three.js overlays
   beyond the static reference markup.
5. Hero is 26px rather than reference 25px. Hero units and secondary values are 17px rather
   than reference 13/15px. Dimension labels are 17px rather than reference 15px. These follow
   the hard legibility rule but are visual deviations.
6. Calc selected count is 14px rather than reference 12px; calc subtotal is 17px rather than
   reference 13px.
7. Reference/token radii conflict: implementation follows reference-like 14px cards and calc
   although Technical-Clean named card radius is 16px. Several other radii and shadows are
   literal values rather than tokens.
8. Several model and overlay colours are literals outside the named token set. Model surface
   colours come from data, so exact reference matching is not guaranteed by the CSS.
9. Permanent dimension labels are not edge-clamped; only the selection box is placement-
   clamped. A tall selection box has no max-height or internal scroll.
10. The full 12dvh portrait position can be shorter than the fixed header/stage. The model
    section scrolls rather than keeping all controls, calc, canvas, and selection visible
    simultaneously.

### Questions requiring visual or device inspection

- Does the 3D house framing remain useful at 288px model width and at each portrait detent?
- Do projected permanent labels collide with each other, the gesture hint, measure pill, calc
  bubble, or screen edges during orbit?
- Can any real selection detail produce a box taller than the exposed viewport and therefore
  be clipped?
- On real iOS/Android browsers, does orientation change reliably trigger host resize and
  correct Three viewport/scissor recomputation?
- Do pinch zoom, two-finger pan, drag-versus-tap gating, three-way sheet dragging, and model-
  section scrolling coexist without gesture conflict?
- Are the literal model materials, lighting intensities, line colours, 14px cards, and
  typography visually close enough to each reference artboard?
- At intermediate widths and with the longest localized labels, where do header controls,
  measure pill, gesture hint, and calc first overlap?
- Do all text/background pairs meet the required 6:1 contrast ratio? Static source review
  did not calculate contrast or inspect antialiasing/compositing.# `/viewer-next` review input

Scope: static code and reference-source audit. Responsiveness is evaluated first, look and
feel second. No measurement was run and no paid API was called. WebGL was not rendered for
this audit; statements about the 3D scene describe the code that constructs and positions it,
not its visual correctness.

## 1. Layout per width

The four review sizes below are the project reference sizes used for §11: desktop
1440×1000, tablet landscape 1024×768, tablet portrait 768×1024, and phone 390×844.

| Size | Actual layout and dimensions | Visible controls | Sheet/detents |
|---|---|---|---|
| Desktop 1440×1000 | Side by side. The panel is fixed at 480px on the right; the model section receives 960px. Both fill `100dvh`. | App-header Add photo, Reset view, and Show conditions. Measure pill bottom-centre. Calc bubble top-centre at 12px. Gesture hint hidden by the ≥1280px query. | Handle hidden; detent state does not affect geometry. |
| Tablet landscape 1024×768 | Side by side because width is ≥768 and orientation is landscape. Panel is 480px; model section receives 544px. | Same header controls. Measure pill bottom-centre. Calc top-centre at 12px. Gesture hint appears only if the pointer is coarse. | Handle hidden; detents do not apply. |
| Tablet portrait 768×1024 | Stacked two-row grid. Default/half model row is 42dvh = 430.08px; panel receives 593.92px. Peek is 72dvh = 737.28px; full is 12dvh = 122.88px. Panel is full width. | Header controls remain. Measure pill top-right at 16px. Calc top-centre at 80px. Gesture hint top-left only on a coarse pointer. | A 44px-high full-width handle cycles or drag-snaps to 72%/42%/12%. Model-section contents can scroll when the row is shorter than their fixed content. |
| Phone 390×844 | Stacked two-row grid. Default/half model row is 42dvh = 354.48px; panel receives 489.52px. Peek is 607.68px; full is 101.28px. Panel is full width. | Same textual header controls as portrait tablet. Measure is a pill at top 34px/right 12px; gesture hint at top 4px/left 12px; calc top-centre at 96px. | Same 72%/42%/12% detents and 44px handle. At full on a short screen, the model section scrolls because its stage is at least 240px or 380px with calc. |

Intermediate-width consequence: any landscape viewport from 768px through 1279px uses the
480px panel. At 768px landscape this leaves 288px for the model section. At 767px landscape
the layout changes to stacked because the landscape media query no longer matches.

The code does **not** create phone-only round Reset/Conditions controls or a bottom calc bar.
That differs from `docs/viewer-spec.md:152-159,167-176`; phone uses the portrait-tablet
composition.

Verbatim layout excerpt (`artifacts/aufmass-app/app/globals.css:181-210,245-250,274-287`;
35 lines):

```css
.viewer-next-shell {
  --color-schrift-tertiaer: #4a5568;
  --color-akzent: #1e40af;
  display: grid;
  grid-template-rows: var(--viewer-top, 42dvh) minmax(0, 1fr);
}
.viewer-next-shell[data-panel-detent="half"] {
  --viewer-top: 42dvh;
}
.viewer-next-shell[data-panel-detent="peek"] {
  --viewer-top: 72dvh;
}
.viewer-next-shell[data-panel-detent="full"] { --viewer-top: 12dvh; }
.viewer-next-model-section { overflow-y: auto; }

.viewer-next-shell button { min-height: 44px; min-width: 44px; }
.viewer-next-stage > .viewer-next-viewport {
  margin-top: max(var(--viewer-calc-bottom, 0px), var(--viewer-control-space, 0px));
}
.viewer-next-stage {
  --viewer-control-space: 80px;
  min-height: 240px;
  flex-shrink: 0;
}
.viewer-next-stage:has([data-calc-bubble]) { min-height: 380px; }
@media (max-width: 600px) {
  .viewer-next-gesture { max-width: calc(100% - 24px); top: 4px; left: 12px; }
  .viewer-next-measure-portrait { top: 34px; right: 12px; }
  .viewer-next-stage { --viewer-control-space: 96px; }
  .viewer-next-calc-bubble { top: 96px; }
}
@media (min-width: 768px) and (orientation: landscape) {
  .viewer-next-model-section { overflow: hidden; }
  .viewer-next-stage, .viewer-next-stage:has([data-calc-bubble]) { min-height: 0; }
  .viewer-next-shell { display: flex; flex-direction: row; }
  .viewer-next-panel { position: static; width: 480px; }
}
```

## 2. The 3D viewport

### Canvas sizing and resize

`ViewerViewport.tsx:645-683` observes the viewport host with `ResizeObserver`. Every observed
size change reads the host rectangle, caps device pixel ratio at 2, calls
`renderer.setSize(width, height, false)`, reapplies the exposed Three.js viewport, renders,
and updates DOM overlays. The same viewport synchronization occurs during orbit damping and
when the scrollable model section moves.

```ts
const setSize = () => {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  syncPainterViewport(state, host);
  renderer.render(scene, camera);
  updateOverlaysRef.current.invoke();
};
const resizeObserver = new ResizeObserver(setSize);
resizeObserver.observe(host);
const scrollContainer = host.closest(".viewer-next-model-section");
scrollContainer?.addEventListener("scroll", render, { passive: true });
```

There is no explicit `orientationchange` listener. Orientation changes are handled indirectly:
CSS switches between grid and side-by-side layout, then `ResizeObserver` reacts to the host
size. Whether every browser emits the needed resize sequence is **unknown** without device
testing.

`getViewportMetrics` (`ViewerViewport.tsx:221-240`) detects whether the panel overlaps the
host. The Three viewport and scissor are restricted to the exposed area above the sheet.
`applyExposedViewport` updates camera aspect, view offset, projection matrix, viewport, and
scissor. A side-by-side panel does not reduce canvas height.

### Camera and scene

The camera does not get a separate narrow-screen position. All widths start from the same
model-relative formula (`ViewerViewport.tsx:566-598`):

```ts
const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000000);
camera.up.set(0, 0, 1);
const span = Math.max(bounds.widthMm, bounds.depthMm, bounds.heightMm, 1);
const initialPosition = new THREE.Vector3(
  centre.x + span * 1.28,
  centre.y - span * 1.52,
  centre.z + span * 0.82,
);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = Math.max(span * 0.15, 100);
controls.maxDistance = span * 8;
```

The scene uses a `#f7fafc` background, hemisphere light intensity 1.9, directional light
intensity 2.2, data-driven material colours, and separate groups for geometry, conditions,
measure lines, permanent dimensions, and selection. Whether the building is framed well or
looks correct at any width is **unknown** because this audit did not render WebGL.

### Dimension labels and selection

Permanent width/ridge/eave labels and user-measure labels are projected from the midpoint of
their 3D segment into the exposed viewport (`ViewerViewport.tsx:343-370`). Their DOM labels
are absolutely positioned at that point and translated by `-50%,-50%`. They are 17px/600
IBM Plex Mono, single-line, with 4px × 9px padding. Permanent labels are white rectangles
with 4px radius; measure labels are white on `#991b1b`.

The selection placement code projects all selected-element corners, derives a screen-space
bounding rectangle, measures the actual selection box, and evaluates right/left/below/above
candidates. Control rectangles marked `data-control` are penalized. The chosen position is
then clamped:

```ts
const left = Math.max(0,
  Math.min(Math.max(0, viewport.width - box.width), chosen.left));
const top = Math.max(0,
  Math.min(Math.max(0, viewport.height - box.height), chosen.top));
```

The selection box is `max-width: calc(100% - 8px)`, uses normal wrapping, and the overlay
host clips overflow. Therefore, for content whose measured width and height fit the exposed
viewport, the box is clamped inside it. At 390px width the CSS maximum is 382px.

Can the selection box leave the visible area at the smallest width? **Horizontally, the code
prevents it for a measured box no wider than the CSS maximum. Vertically, unknown for every
possible content string:** if the rendered box becomes taller than the exposed viewport,
the clamp reduces `top` to 0 but cannot reduce its height; the overflow-hidden host will clip
the bottom. No max-height or internal selection-box scrolling is defined. Permanent
dimension labels are not clamped at all and can be clipped at any edge.

The smallest model-label type at every width is 17px for dimensions and selection values;
the selection title is 12px. Width does not change these sizes.

## 3. Fixed sizes and overflow

The table lists viewer-specific hard constraints and the first code-defined threshold where
they change, clip, or scroll. “Unknown” means the exact content-dependent failure width
cannot be derived without rendering.

| Constraint | File/value | Behaviour and threshold |
|---|---|---|
| Shell height | `ViewerNextClient.tsx:397`, `h-[100dvh]` | Page itself is fixed to the dynamic viewport height and hides outer overflow. Internal regions must scroll. |
| Side panel | `globals.css:287,316`, `width:480px` | Applies at landscape width ≥768 or any width ≥1280. Leaves 288px model width at 768 landscape, 544px at 1024, 960px at 1440. |
| Portrait tracks | `globals.css:186-194`, 72/42/12dvh | Full leaves only 68.16px at 320×568 and 101.28px at 390×844 for the model row. Fixed stage content then scrolls vertically. |
| Model stage | `globals.css:201-206`, minimum 240px; 380px with calc | On portrait full, vertical model-section scrolling starts whenever 12dvh is below header plus stage content. With the 56px header, that is all viewport heights below about 2467px without calc and 3633px with calc. |
| Reserved control space | `globals.css:202,248`, 80px; 96px at ≤600 | Canvas starts below this reservation or the measured calc bottom. It reduces visible canvas height; exact resulting size depends on bubble height. |
| Calc location/size | `globals.css:207-215`, top 80px/96px phone/12px landscape; max-width `min(680px,100%-24px)`; height 64–164px | It stays 12px from horizontal edges at narrow widths and scrolls vertically above 164px. At ≤600×700 with a selection, max-height becomes 64px. |
| Calc JSX width | `CalcBubble.tsx:63`, `max-w-[min(72%,680px)]` plus CSS `width:max-content` | Tailwind’s 72% maximum and the CSS 100%-24px maximum both apply; at 390px, 72% is about 281px. Count and subtotal are nowrap, so wrapping occurs between flex items; long content may force bubble scrolling/word breaks. Exact collision width is unknown. |
| Calc chip list | `CalcBubble.tsx:101`, max-height 128px, vertical scroll | Many chips wrap and scroll inside the list; the outer bubble can also scroll. Long labels can break via `overflow-wrap:anywhere`. |
| Calc buttons | 44px minimum height; 10px radius; horizontal padding 14px | Copy/Clear can wrap to another flex line. No fixed column count. |
| Panel heading | `globals.css:217-229`, min-height 48px, max-height panel-108px, vertical scroll | Status/filter header scrolls when it outgrows available panel height. Panel card scroller retains at least 64px. |
| Status detail | `ViewerNextClient.tsx:588`, max-height 144px, vertical scroll | Long warnings scroll inside status detail. |
| Header | `ViewerNextClient.tsx:401`, minimum 56px, flex-wrap | Project text truncates; controls wrap and increase header height. At phone width all header controls do not remain on one line. Exact first wrap width depends on localized labels and font metrics: unknown. |
| Conditions control | `ViewerNextClient.tsx:429`, `whitespace-nowrap`; switch 36×20px internally | The button itself is forced to at least 44×44 by viewer CSS. Its label does not break; it moves as a flex item when the header wraps. |
| Measure controls | absolute top-right or bottom-centre; 44px min target; nowrap button text | At phone, hint and measure occupy separate vertical offsets. Long localized labels can widen leftward; first overlap width is unknown. |
| Gesture hint | absolute; nowrap; at phone max-width `100%-24px` | Text itself does not declare wrapping; if wider than max-width it can overflow its box. Exact width depends on font rendering. |
| Selection box | max-width `100%-8px`, padding 10×12px, normal wrap | Horizontal position is clamped. No max-height; tall content can be clipped vertically. |
| Dimension labels | nowrap; 17px; padding 4×9px; absolute centred | Long dimension strings never wrap and are not clamped; they clip when their projected midpoint is less than half the label width from an edge. Content-dependent threshold unknown. |
| Row labels | `globals.css:230`, min-width `min(140px,100%)` | At panel container ≤420px, row buttons become a two-column grid and labels span both columns. Long labels wrap; no sideways document overflow is intentionally introduced. |
| Row values | 17px/600 mono; normal white-space, flex-wrap; descendants `overflow-wrap:anywhere` | Large numbers/units can wrap. No fixed value width remains. |
| Row action buttons | global minimum 44×44 | Actions occupy the auto column at panel ≤420px. Multiple actions remain side by side; exact width where they force wrapping is content-dependent. |
| Cards | 14px radius, horizontal panel padding 16px | At 390px, nominal card width is 358px before borders. At 320px, 288px. |
| Panel handle | 44px high, full width; visible below side-by-side breakpoint | Internal visual bar is 40×4px, but the button hit area is 44px high. |
| Camera marker | sphere radius `max(span*0.012,50)` | World-space fixed lower bound, not a CSS overflow issue. Visual scale at each width is unknown without rendering. |

Long IDs, labels, and numbers generally wrap in rows due to the ≤420px container layout
and `overflow-wrap:anywhere`. Exceptions are permanent dimension labels, the conditions
label, measure label, and the calc count/subtotal, which are nowrap. Many calc chips are
bounded by nested vertical scrolling rather than horizontal page scrolling.

## 4. Type, colour, spacing

### Type

| Actual value | Weight/family | Use | Reference/token status |
|---|---|---|---|
| 11px | 600 sans | Shared small measure controls if the shared `Button` size resolves to its project `text-[11px]` style; direct measure buttons are 12px. | **Below the spec’s 12px hard minimum if rendered here.** Exact shared Button output should be checked in the browser. |
| 12px | 400/500/600 sans or mono | Project status, conditions label, filters, card titles/subtext, gesture hint, quality/status text, chip text, selection title, copy feedback. | In token family; matches hard minimum. Desktop reference uses 10px status, so implementation intentionally differs there. |
| 14px | 600 sans | Project title, calc selected count, Copy/Clear. | Font family is token; calc count is 12px in reference. |
| 16px | 700 sans | “Measurements” heading. | Font family is token. |
| 17px | 600 mono | Row values and units, card hero units/secondary stat, calc group totals, permanent/measure labels, selection value. | Matches the spec hard value rule. Larger than several reference artboard values (13px unit, 15px secondary/dimension). |
| 26px | 600 mono | Card hero number. | Matches hard minimum; reference hero is 25px. |

IBM Plex Sans and IBM Plex Mono come from the Technical-Clean font tokens. Distinct line
heights include default Tailwind line heights, 1.2 on dimension labels, and 1.45 on the
selection box.

### Colours

Core token colours used: background `#fafbfc`, surface `#ffffff`, accent `#2563eb`,
primary text `#16233a`, secondary `#43536e`, line `#e3e8ef`, and project status/card accent
tokens. The viewer shell locally overrides tertiary text to `#4a5568` and accent to
`#1e40af`.

Literal or non-token viewer colours:

| Value | Use | Technical-Clean status |
|---|---|---|
| `#f7fafc` | Viewport/Three scene background | Not a defined token. |
| `#991b1b` | Measure lines and labels | Not a defined token; darker than token error `#b91c1c`. |
| `#101820` | Selection box | Not a defined token. |
| `#cbd5e1` | Selection title | Not a defined token. |
| `#334155` | Default permanent Three line | Not a defined token. |
| `#aab6c4` | Hemisphere ground light | Not a UI token. |
| `#16233A`, `#FAFBFC` literals | Calc/copy notice and model section | Same numeric values as tokens but bypass token names. |
| `#7C8CA8`, `#22324D`, `#45577A` | Calc border, chip, remove icon | Not defined tokens. |
| Tailwind slate/red/emerald/white-alpha classes | Hover surfaces, copy feedback, gesture background | Not named Technical-Clean tokens. |
| `part.color.hex` | Model materials | Data-driven, not governed by UI tokens; appearance unknown. |

No static contrast measurement was run. Compliance with the 6:1 requirement is therefore
**unknown**, especially for secondary/tertiary text, translucent white, and feedback colours.

### Radii, shadows, and spacing

Named Technical-Clean radii are 12px (input), 16px (card), and 20px (large), plus pills.
Actual viewer radii include 4px dimension labels, 8px selection/status/gesture controls,
10px calc buttons, 14px cards and calc bubble, and full pills/toggles. The 4/8/10/14px
values are outside the named token set, although the reference itself uses 4px dimension
labels, 8px selection, 10px toolbar controls, and 14px cards/calc.

Named shadows are card `0 4px 16px rgba(20,30,50,.05)` and accent
`0 2px 8px rgba(37,99,235,.25)`. Actual additional shadows are:

- selection: `0 5px 18px rgba(15,24,32,.3)` — not a token;
- calc: `0 8px 28px rgba(20,30,50,.35)` — not a token, but matches the reference calc;
- Tailwind `shadow-sm` on cards — not a named Technical-Clean token;
- default `shadow` on toggle thumb — not a named Technical-Clean token.

Repeated spacing values include shell/panel padding 16px, header vertical padding 8px,
panel heading 14px top/10px bottom, card/calc radius 14px, card gaps 8–10px, calc padding
10px, dimension padding 4×9px, and selection padding 10×12px. These are utility values,
not spacing tokens in `@theme`; Technical-Clean defines no named spacing scale.

## 5. Touch and states

### Hit areas and hover

No viewer button has a computed CSS minimum below 44×44px because
`.viewer-next-shell button` sets both minimum dimensions to 44px. The panel handle is also
44px high and full width. The calc remove button is explicitly 44×44px, although its visible
inner circle is 20×20px. The conditions switch visual track is 36×20px, but its containing
button receives the 44px minimum.

The gesture hint and snap/copy notices are not interactive. Dimension labels, selection
connector, and overlay layer are pointer-free.

Hover styles (`hover:bg-slate-50`, `hover:bg-slate-100`, card/row hover styles) supplement
click/tap handlers. No identified viewer action is hover-only. Whether nested row targets
are comfortable on a physical touch device is unknown; this audit only establishes CSS hit
boxes.

### Rendered states

- **Loading:** no viewer-specific loading state was found. Measurement-derived cards and the
  model are built synchronously from already supplied data. If an upstream route suspends,
  its loading output is outside this viewer component and was not audited.
- **WebGL cannot start:** renderer/control construction is caught, `webglFailed` becomes
  true, the canvas is replaced by a centred message, and panel measurements remain. Render
  and resize exceptions use the same unavailable path.
- **Model cannot be built:** the model builder catch path returns an empty/degraded model
  plus a `model_failure` diagnostic. `ViewerNextClient` sets model state to `notready`;
  the viewport failure message is shown while panel data remains available.
- **Measurement failed:** warnings and references are shown in the quality-status section,
  and the bottom quality block retains warning strings and disclaimer. Null values remain
  as rows with “—”/verification or add-photo treatment and are not tallyable. A complete
  route-level fetch/extraction failure state is **unknown** because `/viewer-next` currently
  consumes a fixed fixture rather than initiating measurement.
- **Clipboard failure:** the calc reports failure text and does not claim success.
- **Add photo on fixture:** it produces an explicit “capture unavailable” notice; no upload
  occurs.

## 6. Deviations and open questions

### Factual deviations from `docs/viewer-reference/` and binding spec

1. Phone uses the tablet-portrait structure: textual header Reset/Conditions controls,
   a top-right measure pill, top-centre bounded calc bubble, and 72/42/12 grid tracks.
   `viewer-spec.md:152-159,172-173` instead specifies phone-only round viewport controls and
   a full-width calc bar above a bottom sheet.
2. Portrait panel geometry is interactive/detented. The portrait reference export is a
   fixed stacked artboard; it does not itself execute drag detents.
3. At 768 landscape the implementation assigns 480px to the panel and 288px to the model
   section. The spec says “desktop panel and header” but does not state this fixed panel
   width.
4. The implementation adds a quality-status disclosure, dynamic warning block, gesture
   hint, WebGL failure state, snap preview, copy notice, and interactive Three.js overlays
   beyond the static reference markup.
5. Hero is 26px rather than reference 25px. Hero units and secondary values are 17px rather
   than reference 13/15px. Dimension labels are 17px rather than reference 15px. These follow
   the hard legibility rule but are visual deviations.
6. Calc selected count is 14px rather than reference 12px; calc subtotal is 17px rather than
   reference 13px.
7. Reference/token radii conflict: implementation follows reference-like 14px cards and calc
   although Technical-Clean named card radius is 16px. Several other radii and shadows are
   literal values rather than tokens.
8. Several model and overlay colours are literals outside the named token set. Model surface
   colours come from data, so exact reference matching is not guaranteed by the CSS.
9. Permanent dimension labels are not edge-clamped; only the selection box is placement-
   clamped. A tall selection box has no max-height or internal scroll.
10. The full 12dvh portrait position can be shorter than the fixed header/stage. The model
    section scrolls rather than keeping all controls, calc, canvas, and selection visible
    simultaneously.

### Questions requiring visual or device inspection

- Does the 3D house framing remain useful at 288px model width and at each portrait detent?
- Do projected permanent labels collide with each other, the gesture hint, measure pill, calc
  bubble, or screen edges during orbit?
- Can any real selection detail produce a box taller than the exposed viewport and therefore
  be clipped?
- On real iOS/Android browsers, does orientation change reliably trigger host resize and
  correct Three viewport/scissor recomputation?
- Do pinch zoom, two-finger pan, drag-versus-tap gating, three-way sheet dragging, and model-
  section scrolling coexist without gesture conflict?
- Are the literal model materials, lighting intensities, line colours, 14px cards, and
  typography visually close enough to each reference artboard?
- At intermediate widths and with the longest localized labels, where do header controls,
  measure pill, gesture hint, and calc first overlap?
- Do all text/background pairs meet the required 6:1 contrast ratio? Static source review
  did not calculate contrast or inspect antialiasing/compositing.