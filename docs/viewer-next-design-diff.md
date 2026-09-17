# Viewer-next design/conformance diff

## Pre-edit reference inventory

This inventory was repeated and reported to the user before application edits.

| Source export | Bytes | Literal `cardsData` | Literal `Roof Area` | Used |
|---|---:|---|---|---|
| desktop.html | 82,461 | Present | Present | Yes |
| tablet-landscape.html | 82,325 | Present | Present | Yes |
| tablet-portrait.html | 83,926 | Present | Present | Yes; also phone source |
| mobile.html | — | — | — | Missing; superseded by user's portrait-at-phone-width direction |

## Executive result

This is a comparison of the implemented `/viewer-next` against the binding rules in
`docs/viewer-spec.md` and the three reference exports that are actually present in this
repository. It is not a claim that an HTML export and the application are pixel-identical.
The exports contain a demo house, raw `{{...}}` template placeholders, and no executable
model; the conformance captures are browser captures of the application, with a real
Three.js/WebGL canvas running under SwiftShader. Consequently, the result below separates
structural/style passes, intentional binding overrides, unresolved reference ambiguities,
and things that cannot be established from a screenshot.

**Overall:** the implementation follows the specified shell, nine-card order, row anatomy,
fixture values, controls, selection, tally semantics, null handling, and quality-warning
model. The hard legibility rules are implemented as overrides to some reference typography
and the phone is an intentional narrow adaptation of portrait, not a fourth reference
artboard. Physical touch-device behavior, complete visual equality, and every gesture cannot
be proven by the available headless browser evidence.

## Evidence and comparison limits

### Sources inspected

* Binding behavior and acceptance numbers: `docs/viewer-spec.md:1-224`.
* Reference shell and card exports: `desktop.html:21-42,238-288,294-417,474-512,
  687-810,813-1028`; `tablet-landscape.html:21-42,231-279,287-410,468-505,
  680-803,806-1022`; `tablet-portrait.html:21-42,220-284,290-418,471-507,
  683-806,809-1056`.
* Implementation: `ViewerNextClient.tsx:134-930`, `CalcBubble.tsx:13-134`,
  `ViewerViewport.tsx:221-918`, `viewerCards.ts:185-647`, and `globals.css:103-297`.
* Browser evidence: `attached_assets/viewer-conformance/browser-results.json:1-170`
  and the five captures in `attached_assets/viewer-conformance/` (desktop,
  tablet-landscape, tablet-portrait, phone, narrow-phone).

Only `desktop.html`, `tablet-landscape.html`, and `tablet-portrait.html` exist. There is no
`docs/viewer-reference/mobile.html`; the source specification's “four exports” statement
therefore cannot be checked for the phone. Phone findings below are explicitly marked
**Override/adapted portrait**, not “mobile reference pass”.

Final verification: **147 tests passed, 0 failed; 27 browser checks passed, 0 failed;
all workspace typechecks passed.** Browser checks use the current document only and
report no uncaught application errors.
The browser measurements report no overflow, undersized text, or undersized-control
violations at the five captured viewports. This is test-summary evidence, not a substitute
for physical-device testing.

## Global visual diff

| Area | Desktop | Tablet landscape | Tablet portrait | Phone/narrow phone |
|---|---|---|---|---|
| Shell | **Pass.** Viewport left, Measurements panel right, header and lens filters follow the reference structure (`desktop.html:21-42,238-288`). | **Pass.** Same desktop shell (`tablet-landscape.html:21-42,231-279`). | **Override/pass.** Portrait sheet/grid keeps the same content but reserves the viewport above it (`tablet-portrait.html:21-42,220-284`). | **Override/pass.** Bottom sheet is stacked and narrow; no mobile export exists to compare. |
| Header and filters | **Pass with reflow.** Header controls remain available and filters precede cards. | **Pass with reflow.** Desktop header is retained as required for tablet. | **Pass with reflow.** Header does not duplicate floating tablet buttons. | **Pass with reflow.** Header controls wrap rather than shrink below the legibility floor. |
| Viewport/control placement | Measure pill bottom-centre; reset/conditions in header. | Same, plus touch hint top-left. | Measure top-right because the sheet occupies the bottom; reset/conditions remain header controls. | Same portrait header Reset/Conditions; top-right measure and top-centre calc, reflowed below the touch hint. No phone-only round controls or bottom calc bar. |
| Panel geometry | Narrowed row grid gives label/badge/value/actions separate space. | Same narrowed grid. | Sheet content scrolls independently. | Uses exact portrait `72/42/12` viewport proportions, including with active tally. Short viewport contents scroll instead of changing those proportions. Panel retains at least 64px of card scrolling at tested short sizes. |
| Typography | **Override/pass.** Hero is 26px, values 17px, minimum text 12px; reference has 25px and 10/11px examples. | Same. | Same. | Same; narrow layouts reflow instead of reducing type. |
| Canvas | **Pass/observed.** Captures show an actual rendered 3D model and selected RF box. | **Pass/observed.** | **Pass/observed.** | **Pass/observed** at phone and narrow-phone captures; SwiftShader is not a physical GPU/touch device. |
| Calc bubble | Top-centre, bounded, and scrollable where necessary. | Same. | Same, below the top controls. | Top-centre below reflowed controls, never the superseded bottom bar; selected chips remain removable. |
| Gradients/zoom | **Binding override.** Implementation uses restrained solid styling and free orbit, not reference gradient/zoom affordances. | Same. | Same. | Same. |

The reference uses a visual skin, not a rendered truth: its demo values (for example
2,448 sq ft and 17 openings) must not be copied. The implementation uses the raw
`fixtures/garage-house.json` through the shared derivation path. The observed fixture
values are 2,097 sq ft / 21.0 SQ / 6 facets, walls net 2,779 sq ft, 16 windows plus
one each of door, patio door, garage door, and skylight, four downspouts totalling
63' 0", eaves 118' 0", ridge 70' 0", and rake 109' 9".

## Card-by-card diff

All cards preserve the reference anatomy: uppercase title, hero/value and unit, context
line, optional material/derived badge, rows, and collapse state. A collapsed card retains
the hero. The reference card source ranges below are intentionally individual: they point
to the specific card object rather than merely citing the enclosing export.

### 1. Roof Area

* **Reference:** desktop `:689-698`; tablet-landscape `:682-691`; tablet-portrait
  `:685-694`.
* **Implementation:** `viewerCards.ts:185-647` creates one Roof Area card with fixture roof
  area, squares, facet context, pitch context, and roof-face rows. The browser capture
  visibly shows the card/rows in the rendered panel; automated fixture checks assert
  2,097, 21.0 SQ, and six facets.
* **Status: Pass with data override.** The reference's 2,448/24.5/8 decoration is not
  reproduced, as required. Each RF row has value/unit/actions and can be tallied. RF-1
  and RF-2 use their raw fixture areas; their rounded sum is 1,346 sq ft. This is not a
  second derived number hidden in another card.

### 2. Roof Edges

* **Reference:** desktop `:699-726`; tablet-landscape `:692-719`; tablet-portrait
  `:695-722`.
* **Implementation:** eaves, ridge, rake, hip, valley, flashing, and an explicit
  unclassified edge row are represented in the edge card. `sourceBadge` is derived from
  eaves+rakes (`viewerCards.ts:185-647`), rather than a copied reference string.
* **Status: Pass.** Drip edge is owned here; unclassified edges remain visible. “From
  eaves + rakes” is a source badge, not a duplicate tally. Whole-foot/LF formatting
  follows the binding rounding override rather than the reference's decorative precision.

### 3. Penetrations

* **Reference:** desktop `:727-731`; tablet-landscape `:720-724`; tablet-portrait
  `:723-727`.
* **Implementation:** penetration counts are typed rows, including pipe boots and a
  repeated skylight count/type. Chimney EA and skylight EA are owned here while their
  areas remain in their owning roof/opening detail as specified.
* **Status: Pass.** The fixture hero is seven and `Pipe boots (AT-2)` is preserved.
  Repeated skylights are summed rather than silently discarded. The reference's demo
  “six” is not application data.

### 4. Gutters & Downspouts

* **Reference:** desktop `:732-740`; tablet-landscape `:725-733`; tablet-portrait
  `:728-736`.
* **Implementation:** gutter runs remain on the gutter row; the downspout group carries
  count and total, with one expandable drop row per elevation/length
  (`viewerCards.ts:185-647`, `ViewerNextClient.tsx:738-930`).
* **Status: Pass.** Four drops are 18', 18', 18', and 9', adding to 63' 0". A missing
  downspout total stays visible as “— / verify on site” and is not tallied. The actions
  are available on group, sub-row, and item rows.

### 5. Height

* **Reference:** desktop `:741-745`; tablet-landscape `:734-738`; tablet-portrait
  `:737-741`.
* **Implementation:** height is a separate card and is included in roofing/siding filter
  sets without duplicating a wall or roof-area total.
* **Status: Pass.** Eave/ridge context and height rows use quote vocabulary and ft-in
  formatting. There is no invented height row in another card.

### 6. Walls

* **Reference:** desktop `:746-766`; tablet-landscape `:739-759`; tablet-portrait
  `:742-762`.
* **Implementation:** one row per wall face, elevation-first label, gross sub-line,
  net value, material badge, and expandable derivation lines
  (`ViewerNextClient.tsx:738-930`; `viewerCards.ts:185-647`).
* **Status: Pass.** Fixture net is 2,779 sq ft and gables context is 322 sq ft; gables
  are contained in wall area and no gable-count row is added. Width/height/gable and
  parent-face opening deductions come from the shared derived model. At most three
  applicable lines are shown, zero deductions are omitted, and the lines reconcile to
  the row's stored gross/net. A null wall or explicit stored area is retained instead
  of throwing; a missing breakdown says “verify on site”.

### 7. Openings

* **Reference:** desktop `:767-799`; tablet-landscape `:760-792`; tablet-portrait
  `:763-795`.
* **Implementation:** Windows, Doors, Patio Doors, Garage Doors, and Skylights are
  emitted only when present, in that order. Groups are scoped by opening type and wall
  ID when a type has more than six items; item rows retain ID, W×H, area, and a written
  Perimeter line. Every fixture window is listed.
* **Status: Pass.** The fixture context is 16 windows, one door, one patio door, one
  garage door, and one skylight. Group IDs are type-scoped (`og_window_WL-1` versus
  `og_door_WL-1`), preventing collisions. Elevation is not redundantly placed inside
  each item. The reference demo's 17 is not used.

### 8. Trim & Roofline

* **Reference:** desktop `:800-805`; tablet-landscape `:793-798`; tablet-portrait
  `:796-801`.
* **Implementation:** fascia, soffit, outside/inside corners and other trim rows remain
  separate semantic rows. An unknown/null fascia remains visible as “— / verify on site”.
* **Status: Pass with null-data limitation.** No confidence/source/low-reason metadata
  is rendered as a per-value decoration. A static “verify on site” value is data-quality
  handling, not a confidence display.

### 9. Condition Areas

* **Reference:** desktop `:806-810`; tablet-landscape `:799-803`; tablet-portrait
  `:802-806`.
* **Implementation:** condition rows remain in this card; Show conditions toggles the
  model tint without moving the list into another card (`ViewerNextClient.tsx:385-731`,
  `ViewerViewport.tsx:550-863`).
* **Status: Pass.** The card is included only in Painting, not Roofing/Siding, and the
  screenshot/model path shows an actionable condition toggle. Exact touch gesture
  success and visual tint equality remain verification-limited.

## Row anatomy and interaction diff

The reference row grammar is documented in `desktop.html:294-417`,
`tablet-landscape.html:287-410`, and `tablet-portrait.html:290-418`. Across all nine
cards, the implementation provides:

* uppercase/card title and context; hero remains visible while collapsed;
* label on the left, optional derived/material badge, and sub-line below it;
* right-aligned 17px semibold tabular-mono value plus unit;
* copy and Σ actions on group, sub-row, and item rows;
* sub-rows/items for downspouts and openings, and calc lines for wall rows;
* a single-row tap target for opening/closing any row with content; several rows may stay
  open and chip changes do not erase expansion state;
* narrowed CSS grid and independent content slots for the “badge + material + value”
  porch-style long row, preventing overlap rather than shrinking text;
* “Not captured — add photo” behavior for an uncaptured elevation, while preserving the
  row. The fixture route's Add photo control explicitly explains that capture is unavailable
  for this fixed demo. It cannot append real fixture photographs, so photo ingestion is an
  integration limitation, not a completed capture flow.

The row types are individually accounted for here:

| Row type/anatomy | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Result |
|---|---|---|---|---|
| Standard flat value row (label, optional sub-line, value/unit, actions) | `desktop.html:294-333` | `tablet-landscape.html:287-326` | `tablet-portrait.html:290-329` | **Pass.** 17px tabular value and independent action slots. |
| Badge/material row (including the reference's porch-style extra element) | `desktop.html:296-304` | `tablet-landscape.html:289-297` | `tablet-portrait.html:292-300` | **Pass.** Badge, label, material note, value, and actions get separate responsive slots. |
| Derived/source-badge row (“from …”) | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass.** Source provenance is compactly labeled without repeating a source value. |
| Calculation row (expanded wall breakdown) | `desktop.html:327-344` | `tablet-landscape.html:320-337` | `tablet-portrait.html:323-340` | **Pass.** Right-aligned, max three applicable lines, unit once, zero deductions omitted. |
| Group row (opening type or downspout count/total) | `desktop.html:345-373` | `tablet-landscape.html:338-366` | `tablet-portrait.html:341-369` | **Pass.** One tap opens its children; group itself retains value/actions. |
| Nested sub-row and item row (opening/drop) | `desktop.html:374-401` | `tablet-landscape.html:367-394` | `tablet-portrait.html:370-397` | **Pass.** Each item has its own dimensions/length, action, and tally surface. |
| Null/empty/uncaptured CTA row | `desktop.html:294-333,306-308` | `tablet-landscape.html:287-326,299-301` | `tablet-portrait.html:290-329,302-304` | **Pass with integration limit.** Row stays as “— / verify on site” or “Not captured — add photo”; Add photo cannot ingest a real photo on fixture route. |
| Unclassified edge row | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass.** It is a normal visible edge row, without an invented review badge. |
| Condition-area list row | `desktop.html:806-810` | `tablet-landscape.html:799-803` | `tablet-portrait.html:802-806` | **Pass/gesture-limited.** List remains in Condition Areas while model tint is toggled independently. |

The implementation's “one home per value” means no duplicate ownership across cards; it
does **not** prohibit a hero and its row-level detail inside the same owning card.
Roof edges/penetrations/gutters/height are semantically Roof in the reference CLS, while
Walls, Openings, Trim, and Condition remain separate classes. Parent and child source rows
can both be selected and intentionally double-count as explicit additive sums. That is
the documented tally behavior, not an accidental visual duplicate.

## Selection, tally, and model diff

* Selection dimensions match the binding types: wall width × height + net (with gable and
  opening lines), opening W×H + area, roof pitch + area, edge length, attachment W×H×D.
  Relevant source structure is in `desktop.html:813-1028`,
  `tablet-landscape.html:806-1022`, and `tablet-portrait.html:809-1056`; implementation
  is `ViewerViewport.tsx:343-423,550-863`.
* The captures visibly show the selected RF box (including a front RF-1-style box with
  8/12 pitch and 673 sq ft in the browser-rendered fixture view), with dimensions and
  a connector/placement beside the selected element. This is evidence of rendering, not
  a claim that the reference demo has the same number.
* The box is 17px for the main value, grows to fit, is bounded to the viewport, and
  avoids the selected element and reserved controls. The placement unit tests cover
  viewport bounds and control avoidance. Screenshot equality and every off-screen
  placement are verification-limited.
* Σ uses raw typed values grouped by **same semantic class and same unit**, gives separate
  mixed subtotals, and has removable chips, Copy, and Clear. Repeated Σ toggles remove a
  selected item. It survives filter switches.
* The calc bubble is top-centre on wide layouts and bounded to 164px with scrolling;
  on portrait/phone it is positioned so it does not consume the sheet/control space.
  `CalcBubble.tsx:13-134` has truthful copy handling when copying is unavailable.
* The implementation has real WebGL picking, snap, permanent dimensions, and reset/focus
  paths (`ViewerViewport.tsx:508-918`). Unit/browser evidence establishes logic and
  SwiftShader rendering; it does not establish physical pinch, two-finger pan, or
  fingertip snap on a real touch device.

## Controls, quality, accessibility, and known deviations

The reference control/layout source is individually `desktop.html:813-1028`,
`tablet-landscape.html:806-1022`, and `tablet-portrait.html:809-1056`; behavioral binding
is `viewer-spec.md:111-176`.

* Free orbit, scroll/pinch zoom, Reset view, Show conditions, and Measure line are
  implemented; no perspective switch or +/- zoom buttons were introduced.
* Wide controls place the measure pill bottom-centre. Portrait places it top-right.
  Phone uses the same header reset/conditions controls as tablet portrait, with reflow.
  No phone-only round reset/condition buttons remain.
* Clear appears only after a line exists; Esc/clear paths are implemented. Measurement
  snaps independently at both endpoints with corner priority in the model logic.
* The gesture hint is touch-only, top-left, and absent on desktop. “No hover-only
  control” is respected.
* Hero is 26px (not the reference's 25px), every numeric value is 17px, minimum text is
  12px, and true controls are at least 44px. Contrast is scoped to the relevant light
  surfaces/text rather than a blanket claim that every possible compositing state is
  ≥6:1. The reference's 10/11px labels are therefore intentionally overridden.
* The quality block is exactly one bottom, scrolling block below the last card. It retains
  original warning strings and appends at most generic model warnings; the header exposes
  counts/pointers and does not duplicate entries. The required disclaimer remains static
  and verbatim. A failed model leaves the panel usable.
* Reference gradients and reference zoom affordances conflict with the binding no-gradient/
  free-orbit rules; the implementation follows the binding rules. The portrait export is
  stacked even though earlier prose describes a side-by-side arrangement; implementation
  follows the observed portrait artboard and the explicit phone override.

## Verification status legend

### Individual viewport changes

1. Phone-only round control cluster removed; Reset and Conditions stay in the reflowing header.
2. Phone now uses the portrait stacked composition, rather than an independently translated overlay.
3. Portrait and phone retain the exact reference 72/42/12 viewport proportions through a 44px tap/drag handle. Drag release snaps to the nearest of all three positions, including half. The short viewport region scrolls to preserve readable controls instead of clamping the three positions together. Row selection opens peek and scrolls the model into view. At least 64px remains for scrolling cards at tested short sizes; compressed status/filter sections scroll separately under the Measurements title.
4. Measure remains bottom-centre on desktop/landscape; portrait/phone place it top-right. At narrow widths the hint and measure pill occupy separate rows.
5. Calc is top-centre everywhere, with a scroll area responsive between 64px and 164px and true 44px remove targets. Neither a bottom phone bar nor zoom buttons were added.
6. The canvas reserves the measured calc/control height; resizing uses the existing painter resize path. The bubble cannot cover the canvas or a selected model element.
7. Dimension labels now use 17px semibold mono and reference-style rectangular corners. Measure labels use white text on dark red; measure lines also use dark red.
8. Selection dimensions now use 17px type; title remains 12px and primary value is semibold. Geometry, picking, snapping and connector placement were preserved.
9. Reset drains pending orbit damping before setting the initial camera position. A new unit regression and the actual browser drag/reset check cover the formerly drifting reset.
10. No model reconstruction, legacy viewer edits, shared computation edits, schema edits, fixture edits, or extraction changes were made.

### Final verification details

The browser run uses desktop 1440×1000, landscape 1190×830, portrait 830×1190,
phone 390×844, and narrow phone 320×740. The two tablet sizes match the exports.
Additional active-tally regressions use 390×844, 320×640 and 320×568: handle tap
cycles and pointer drags each reach peek, half and full within 1px of 72%, 42% and 12%
of screen height (not merely three unequal positions). Row selection returns
to peek, tallies persist, additional rows can be added, and the card scroller remains usable.
When the top region is only 12% of a short screen, its header, controls and persistent
tally cannot all be visible simultaneously at the required type and target sizes. They remain
accessible by scrolling that region; this is an explicit overflow adaptation, not a claim
that all viewport content fits inside 68px. Row values and their units are both 17px semibold;
hero values remain 26px, with 17px semibold units.
The system screenshot browser lacks WebGL and correctly shows the local viewport fallback
while retaining the panel; the separate Chromium/SwiftShader run renders real WebGL and
passes the interaction checks. Neither environment establishes physical GPU/device behavior.
Clipboard tests intercept the browser API to test success and rejection; they do not claim
verification of the operating system clipboard. The raw results and screenshots are in
`attached_assets/viewer-conformance/`.

**Pass** means supported by source and/or a browser capture/unit evidence. **Override**
means an intentional binding rule (fixture data, typography, no gradients, or phone
adaptation) differs from the export. **Ambiguous** means the reference/spec conflict is
recorded rather than silently resolved. **Verification-limited** means the implementation
has a path or test, but the available screenshots/browser cannot prove physical-device
behavior, every responsive breakpoint, or pixel-perfect equality. **Limitation** means an
integration boundary such as fixture-route photo ingestion, not a hidden fallback.