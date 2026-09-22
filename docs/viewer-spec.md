# SnapTape Viewer v4 — Spec (`docs/viewer-spec.md`)

Binding rules for the new viewer at `/viewer-next`. Read together with the four exported
v4 artboards under `docs/viewer-reference/`. The reference is binding for structure and
styling; this file adds the behavior and data rules the export cannot carry.

## 1. Sources of truth

- **Structure & styling (binding):** `docs/viewer-reference/desktop.html`, plus
  `tablet-portrait.html`, `tablet-landscape.html` and `mobile.html` for their layouts. Card
  order, row anatomy (including the row action icons exactly as shown), type, spacing,
  colors. They render standalone in a browser (only Google Fonts external).
- **Rules & behavior:** this file.
- **Numbers:** `computeDerived(measurement)` from the shared lib, fed with
  `fixtures/garage-house.json`. The viewer never calculates and never hard-codes a value.
- **Contract:** `shared/schema/measurement-v1.7.json`.

## 2. One thing to know about the reference

It shows a **demo house that is not the fixture** (8 facets, a chimney, 17 openings). Its
numbers are decoration, partly inconsistent with each other — never copy a number from the
reference. Check numbers for the fixture are in §13.

Panel **content** is the same on every screen size; the four artboards differ only in
layout (§11).

## 3. Layout

Desktop / tablet: 3D viewport left (~65%), "Measurements" panel right. Phone: viewport full
screen, panel as a bottom sheet with three detents (peek 128px / half 52% / full 88%), drag
handle, header always visible.

Panel top to bottom: header "Measurements" with a status line (references used, warnings —
expandable, as in the reference), then the trade-lens chips **All · Roofing · Siding ·
Painting**, then the cards. Chips only filter which cards are visible: Roofing = Roof Area,
Roof Edges, Penetrations, Gutters & Downspouts, Height; Siding = Walls, Openings, Trim &
Roofline, Height; Painting = Walls, Openings, Trim & Roofline, Condition Areas. Default All.

## 4. The nine cards, in this order

Roof Area · Roof Edges · Penetrations · Gutters & Downspouts · Height · Walls · Openings ·
Trim & Roofline · Condition Areas. Card anatomy per the reference: uppercase title, hero
number large with unit, context line, material chip where the data has one. A collapsed card
keeps its hero number visible — collapsing never hides a quote number.

**One home per value.** Every number appears in exactly one card. Penetrations only in
Penetrations (incl. chimney EA and skylight EA-row if present — their areas stay in Roof /
Openings); gutter runs and downspouts only in Gutters & Downspouts; drip edge (= eaves +
rakes) only in Roof Edges; fascia/soffit/corners only in Trim & Roofline; the opening list
only in Openings (Walls shows per-wall deductions as a sum, never the openings themselves).
A derived row carries a small "from …" chip instead of repeating its sources.

## 5. Rows and interaction

- **One tap opens.** Every row that has lines underneath (sub-rows, items, calc) opens on a
  single tap anywhere on the row; a second tap closes. No separate expand control is ever
  required. Several rows may be open at once; state persists while switching chips.
- Row anatomy per the reference: label + optional badge left, sub-line under it, value +
  unit right in 17px semibold tabular mono, then the row actions (copy ⧉, tally Σ) exactly
  as the reference places them, on group rows, sub-rows and item rows alike.
- **A row with badge and material note must lay out cleanly** — badge, label, material and
  value each have their own place at every width (the reference's porch row shows the case:
  it carries one element more than its neighbors; nothing may overlap).
- Uncaptured elevations render as a row with "Not captured — add photo" (see WL-4 in the
  reference), never silently missing.

## 6. Walls card

One row per wall face (WL-n), elevation-first label ("Front (WL-1)"), gross in the sub-line,
net as the value, material chip. Opening the row shows the calculation from computeDerived,
right-aligned, unit once, at most three lines, lines that don't apply are omitted (no zero
lines):

    42' 0" × 17' 8"                 742
    + gable 24' 0" × 6' 0" / 2       72
    − 6 openings                   −124

The lines must add up exactly to the gross and net already on the row; gross and net are not
repeated inside. Width/height/gable come from `faces[].width_mm / height_mm /
gable_height_mm`, deductions from openings whose `parent_face_id` is this wall.

**Gables:** the card's context line carries "of which gables N sq ft" (sum of
0.5 × width × gable_height over all walls with a gable). It is contained in the wall areas —
it must never add on top of the walls total. There is no gable count row.

## 7. Openings card

Type sections in this order — Windows, Doors, Patio Doors, Garage Doors, Skylights — and a
type section exists only if that type has at least one opening. Inside a type with more than
6 openings: group by parent wall (subheader = elevation; if two walls share an elevation,
append the id: "Front (WL-5)"); otherwise list items directly. Item row: id and W×H left,
area right; perimeter in the line below, "Perimeter" written out. Every opening is listed —
no "more" line at any level. The elevation is never repeated inside an item row.

## 8. Gutters & Downspouts card

Gutter runs come from the eave edges and stay on their own row. Downspouts: count and total
drop on the group row, one sub-row per drop with its elevation and its own length — the
sub-rows must add up to the total on the group row. Drops are cut to length individually, so
a single total is not orderable on its own.

## 9. Selection box on the model

Clicking an element shows the black box: name small on top, dimensions in the middle, main
value large at the bottom (17px semibold tabular mono). Dimensions per element type: wall →
width × height + net; opening → W×H + area; roof facet → pitch + area; edge → length only;
attachment → W×H×D. Wall dimensions match the wall row's breakdown exactly. The box grows to
fit, never truncates, never drops below 12px, never covers its element (beside it with a
connector on small viewports). Selection syncs both ways with the panel.

## 10. Tally, measure line, viewport controls

Same three functions everywhere — **Measure line**, **Reset view**, **Show conditions** —
plus the calc bubble. What changes per screen size is only *where* they sit, and each
artboard already shows it. Behavior first, placement in §10.4.

### 10.1 What the controls do

- **Free orbit only:** drag to orbit, scroll (or pinch) to zoom. No view buttons, no
  perspective toggle, no +/− zoom buttons on any screen size.
- **Reset view** returns the camera to its initial framing.
- **Show conditions** tints the condition_areas patches on the model. It is a toggle with a
  visible on/off state — a switch on desktop and tablet, a highlighted icon button on the
  phone. The condition *list* rows stay in the Condition Areas card.
- **Measure line** arms the tool; two clicks draw a dimension line with its ft-in label;
  several lines may exist at once; Esc or the **Clear** button removes them. Clear appears
  next to "Measure line" only while at least one line exists, on every screen size.
  The measure line **snaps while a point is being placed** — this belongs to the measure
  tool and to nothing else in the viewer: a point near a model edge or corner jumps onto
  it, corners winning over edges, while a point away from any edge stays exactly where it
  was placed, so a spot in the middle of a wall stays measurable. A small marker shows
  while a point has caught and disappears once it is placed. The line reads the snapped
  value, not the freehand one, so a line drawn along an eave reads that eave's exact
  length. Both ends snap independently. Snapping works the same on every screen size; on
  touch the snap range is generous enough that a fingertip finds an edge without precise
  aiming.

### 10.2 The calc bubble

Σ on a row adds its value to a floating dark bubble listing the collected rows as removable
chips, with the subtotal, **Copy** and **Clear**. It sums only same unit AND same class —
a mixed selection shows separate subtotals, never one merged number. It survives chip
switches and stays open until cleared.

### 10.3 Touch rules

On phone and tablet: drag orbit, pinch zoom, two-finger pan, and the gesture hint
"drag orbit · pinch zoom · 2-finger pan" sits in the top-left of the viewport. It is
touch-only and has no desktop counterpart. Every control keeps a 44px tap target, and no
control may be hover-only anywhere.

### 10.4 Where each control sits (from the artboards — binding)

| | Desktop | Tablet landscape | Tablet portrait | Phone |
|---|---|---|---|---|
| Reset view · Show conditions | app header | app header | app header | round icon buttons, top-right of viewport |
| Measure line (+ Clear) | pill, bottom-centre of viewport | pill, bottom-centre of viewport | pill, **top-right** of viewport | round icon button, top-right, above the other two |
| Gesture hint | — | top-left | top-left | top-left |
| Calc bubble | top-centre of viewport | top-centre | top-centre | full-width bar at the bottom, above the sheet |

Two things that look like inconsistencies but are not: the tablet keeps the **desktop**
header controls rather than the phone's round buttons (it has the header, so duplicating
them as floating buttons would offer the same function twice); and the measure pill moves
to the top-right in **tablet portrait** only, because the bottom sheet covers the bottom
edge in that orientation.

## 11. Screen sizes

- **Desktop:** as the reference. Hover states allowed, but nothing may be hover-only.
- **Tablet (both orientations):** desktop panel and header, touch viewport — see §10.4 and
  §10.3. No round floating buttons for Reset view or Show conditions.
- **Phone:** bottom sheet (§3), round icon buttons and gesture hint per §10.4; panel content
  identical to desktop (§2).
- **Legibility everywhere (hard):** nothing under 12px; values 17px semibold tabular mono;
  stat/hero numbers 26px+ semibold; contrast ≥ 6:1 (lightest text on white #636363); tap
  targets ≥ 44px; overflow is solved by layout, never by shrinking type.

## 12. Cross-cutting

- **No per-value confidence display.** The viewer shows no confidence dots, no per-row
  reason notes, no raw-mm readout and no "mark as field-verified" action — the schema
  fields `confidence`, `source` and `low_reason` are not rendered on rows at all. Static
  badges that come from the data — "Verify material", "verify on site" — are not
  confidence display and stay.
- **Measurement quality block:** the run-level honesty lives in exactly one place, at the
  **bottom of the panel, below the last card**: the entries of `quality.warnings`
  (uncaptured elevations, occlusions, edges needing review) and the references used. It
  scrolls with the cards and is not pinned; it is the last thing in the panel on every
  screen size.
- **Disclaimer:** the quality block closes with this sentence, verbatim, on every screen
  size and in every export of the panel:

      AI-generated estimates from photographs, for estimating purposes only. Accuracy
      depends on photo coverage and quality. The user remains responsible for verifying
      all numbers on site.

  It is static text, not derived from the data, and it appears whether or not the run has
  warnings. Do not reword it, shorten it, or state any accuracy figure anywhere in the
  viewer.
- **Empty/null:** value null → row stays, "—" and "verify on site". Unclassified edges are
  always listed as their own row, never dropped — without any extra review label.
- **The viewer never throws.** Geometry it cannot model — an unexpected roof type, a face
  class it does not know, an opening it cannot place, an attachment it does not draw — is
  degraded, never fatal: show the building as a simple massing, or leave that one element
  out, and say so in one line in the quality block. The panel is independent of the model:
  every card, number and interaction must work even when the 3D model cannot be built at
  all, and a model that fails must never take the page down with it. (The old viewer got
  this wrong: `lib/viewer/baukasten.ts` throws on any roof_type other than `gable`, which
  takes down the whole route for a real measurement. Do not repeat that pattern.)
- **Rounding:** lengths ft-in to the inch, areas whole sq ft, squares 1 decimal, pitch x/12.
- **Vocabulary:** quote language, never schema language — Squares, Eaves / gutter run,
  Rakes, Drip edge, Ridge, Hip, Valley, Flashing vs Step flashing (never merged), Pipe
  boots, Outside/Inside corners, Soffit, Fascia (always separate rows), Net facade.
- **Style:** Technical Clean — IBM Plex Sans/Mono per the reference, restrained color,
  tabular numerals, no gradients. The reference is the skin; do not invent a new one.

## 13. Fixture check numbers (acceptance)

From `fixtures/garage-house.json` via computeDerived — the viewer must show:
roof **2,097 sq ft · 21.0 SQ · 6 facets**; walls net **2,779 sq ft**, of which gables
**322 sq ft** (3 gabled walls: 131 + 131 + 60); **16 windows**, 1 door, 1 patio door,
1 garage door, 1 skylight; **4 downspouts · 63' 0"** (18' + 18' + 18' + 9'); eaves
**118' 0"**; ridge **70' 0"**; rake **109' 9"**; every wall row's breakdown adds up (the
fixture was reconciled on 2026-09-10 — all six walls pass the 2% check).
