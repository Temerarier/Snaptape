# Viewer correctness verification

## Result

The five requested corrections are implemented on `/viewer-next` without changing
the canonical fixture, stored measurements, portrait split states or 480px panel.

### Opening groups

Counts, areas and perimeters originate in `computeDerived`, using unrounded mm/mm².
Every grouped row has copy and typed area-tally payloads. Grouped doors use the same
adapter. Parent identity is retained when multiple walls share an elevation.
Unknown operands produce an explicitly unknown aggregate, not a partial total.

| Window parent | Count | Displayed perimeter | Displayed area |
| --- | ---: | ---: | ---: |
| Front, WL-1 | 6 EA | 90′ 8″ | 81 sq ft |
| Back, WL-2 | 5 EA | 77′ 4″ | 71 sq ft |
| Left, WL-3 | 3 EA | 45′ 4″ | 41 sq ft |
| Right, WL-4 | 2 EA | 26′ 8″ | 21 sq ft |
| All windows | 16 EA | 240′ 0″ | 214 sq ft |

The unrounded window total is 19,881,982.08 mm² and 73,153.2 mm perimeter.
The brief's example numbers were not substituted for fixture values.

### Conditions diagnosis: mixed (b) and (c), not (a)

The input already contained two conditions. The original patches were coplanar
with their parents and hidden from the initial front/right camera; an actual-model
raycast regression confirms the occlusion. Callouts and condition selection were
also missing. No fixture records were added or replaced.

- CA-1: failing paint, left wall WL-3, 45 sq ft, moderate, photo 4.
- CA-2: rot, back wall WL-2, approximately 6 sq ft, light, photo 3.

They now use translucent hatched patches, red outlines, connected dark callouts
and the shared measured-label collision/clamp solver. Selecting a hidden condition
reveals and highlights it. Hidden conditions reserve no label space. Empty input
displays “No conditions recorded.”

### Surface rendering

Openings are displaced 2mm outward, conditions 3mm, and selection adds 1mm above
the selected surface. Negative polygon offsets complement the displacement.
Measured geometry is unchanged; picking restores the canonical hit position.
Depth testing and camera freedom remain enabled. Camera clipping remains near=1,
far=1,000,000; neither value was changed.

### Dimensions and ordered checkpoint

Before adding any dimension switch, actual WebGL screenshots at 1440×1000 and
390×844 confirmed exactly length 40′ 0″, depth 28′ 0″ and eave height 18′ 0″.
Ridge labels and associated strokes were absent. Ground rails retain the measured
edge direction and are displayed outside the projected building silhouette.
Unknown measured depth produces no depth dimension.

The checkpoint is saved in `attached_assets/viewer-final-fixes/step5A-checkpoint.json`.
The later default-on switch removes all permanent labels, strokes and placement
reservations, without removing user measurements, selection or conditions.
The phone switch is the fourth 44px control, below reset.

## Verification

- 200 unit tests passed across 21 files.
- Workspace type checks passed.
- 30 real Chromium WebGL interaction checks passed.
- 11 orbit/render checks passed; 96 commanded orbit steps and 288 rendered frames.
- Desktop full orbits at approximately 39.9m, 57.0m and 96.9m camera distances;
  phone full orbit at approximately 57.0m. Each uses 24 steps with a 100ms pause.
- Sampled quarter-turn screenshots showed no visible floating or flicker.
- Screen sizes: 1440×1000, 768×1024, 390×844, 375×667, 768×600 and 840×600.
- Browser exceptions: none in the successful interaction and orbit runs.

Browser testing uses local Chromium with software WebGL. Clipboard writes were
stubbed for deterministic assertions. Documented test-only live React access
injects user-measure endpoints, temporarily empties conditions, and controls the
camera; no production test hook was added.

Physical-device GPU rendering and Safari are **not verified**. Sampled frames are
not a guarantee of flicker-free rendering on every graphics driver.

## Evidence

All paths are under `attached_assets/viewer-final-fixes/`:

- `step5A-1440.png`, `step5A-390.png`: dimensions before switch implementation.
- `browser-results.json`: interactive checks.
- `orbit/orbit-results.json`: orbit, camera and material checks.
- `orbit/rear-left-oblique-1440-conditions.png`: both condition faces and callouts.
- `orbit/rear-left-oblique-390-conditions.png`: phone condition/dimension evidence.
- `orbit/clean-default-front-390-four-controls.png`: all four phone controls.
- `orbit/clean-desktop-window-groups-open.png`: grouped opening values.
- `orbit/desktop-orbit-contact-sheet.png`: twelve sampled desktop quarter turns.
- `orbit/phone-orbit-contact-sheet.png`: four sampled phone quarter turns.

## Proposed values

Explicitly **proposed — not derived from reference**: 2mm opening offset, 3mm
condition offset, +1mm selection offset, 240mm hatch spacing, 0.25 fill opacity,
0.82 hatch opacity, and 22px control glyphs with 2px rounded strokes.
Reference-derived colors and existing control dimensions remain unchanged.