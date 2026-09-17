---
name: Viewport verification constraints
description: Geometry and snapping evidence when headless browsers cannot render WebGL
---

Verify geometry numerically and through two separately positioned SVG elevations before trusting a passing fixture test.

**Why:** Counts and opening containment alone missed an inverted projection, overlapping elevations, incorrect garage-wall placement, and input-order-dependent associations.

**How to apply:** Include input permutation checks, exact physical contact/plane assertions and screen-axis checks; do not change fixture data to fit the drawing.

Test screen-space snapping with the production camera's projection and physical raycast visibility, not arbitrary normalized depths.

**Why:** A depth threshold that separated synthetic test values allowed hidden geometry in the real perspective camera, where building-scale depth differences compress close to one.

**How to apply:** Check oblique edges and front/rear overlap at actual camera near/far settings. Keep headless missing-WebGL limitations explicit rather than claiming visual 3D verification.