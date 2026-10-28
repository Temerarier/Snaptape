---
name: Viewport verification constraints
description: Actual-camera geometry checks and reuse of the proven software-WebGL inventory harness
---

Verify geometry numerically and through two separately positioned SVG elevations before trusting a passing fixture test.

**Why:** Counts and opening containment alone missed an inverted projection, overlapping elevations, incorrect garage-wall placement, and input-order-dependent associations.

**How to apply:** Include input permutation checks, exact physical contact/plane assertions and screen-axis checks; do not change fixture data to fit the drawing.

Test screen-space snapping with the production camera's projection and physical raycast visibility, not arbitrary normalized depths.

**Why:** A depth threshold that separated synthetic test values allowed hidden geometry in the real perspective camera, where building-scale depth differences compress close to one.

**How to apply:** Check oblique edges and front/rear overlap at actual camera near/far settings. Keep headless missing-WebGL limitations explicit rather than claiming visual 3D verification.

Before declaring WebGL visual acceptance blocked, check the existing inventory
SwiftShader harness rather than relying only on the standard testing browser.

**Why:** The standard browser failed to create WebGL, but the user pointed out
that the project's inventory harness had already captured 32 projects with
SwiftShader. Reusing it also rendered the new A-viewer successfully.

**How to apply:** Reuse `scripts/inventory/viewer-harness.mjs` for real
component-level rendering and CDP interactions. Distinguish its isolated
component host from authenticated route testing. Report actual picking errors
separately from browser/WebGL startup failures, and do not edit product code
when the user authorizes only harness work.