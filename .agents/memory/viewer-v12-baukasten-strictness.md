---
name: Viewer v1.2 Baukasten strictness
description: The Etappe-2 3D viewer only accepts an exact simple-gable component set; richer measurement JSON must be reduced by a display adapter.
---

The v2 viewer's Baukasten (`lib/viewer/baukasten.ts`) throws on anything beyond its exact simple-gable set: 1 wall per elevation, exactly 2 roof faces with elevation "roof", edges limited to ridge×1, eave front/back ×1 each, rake left/right ×2 each, outside_corner×4 (belongs_to_elevation null); soffit/fascia faces, attachments, valleys, base edges, roof/unknown openings, and openings without position_mm x/y all throw.

**Why:** It was built 1:1 against `fixtures/testhaus.json`; group-count matching is bidirectional (leftover fixture parts also throw).

**How to apply:** Any richer measurement JSON (e.g. v1.5 garage-house) shown in this viewer must be reduced first — see the throwaway `lib/messung/anzeigeAdapterV15.ts`. When the viewer learns v1.5 natively, delete that adapter. Also: e2e testers have no WebGL; the viewer shows its fallback message there, which is expected, not a bug.
