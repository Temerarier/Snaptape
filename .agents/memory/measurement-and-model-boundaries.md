---
name: Measurement and optional 3D boundaries
description: Product and security rules separating paid measurements from generated 3D extras.
---

The measurement is the paid product and the sole source of all panel numbers.
AI-generated 3D is an optional extra. Its failure must not change the successful
measurement or refund its credit, and it must not write its own credit charge.

**Why:** The user explicitly defined this product boundary when adding the second
model step. Geometry can be unavailable while the purchased measurement remains
valid and usable.

**How to apply:** Commit the measurement before the optional model finishes.
Keep independent stale-job protection for the model instead of extending the
measurement's active-processing state. Check it again before paying for a
correction; do not let old jobs replace a newer project's model.

AI-written buildHouse code must execute only in isolated-vm, never in node:vm or
the host process. Keep the handed-over core and both buildhouse prompts byte-for-
byte unchanged. If isolated-vm cannot install/build, stop rather than substitute
a weaker execution boundary.

**Why:** This is executable, untrusted model output, not a trusted app plugin.
The core defines the accepted geometry and checking behavior independently of
the model.

**How to apply:** The trusted host core may convert measurements and check copied
JSON only; never call its code-execution method on the host. The child process
adds containment for native isolate failures and must receive no app credentials.
Bound copied results before host-side checks.

Generated code and private model reports are server-only audit data and must
never reach customer responses or React props, including dev Flight debug data.

**Why:** The user explicitly required customers to receive plain geometry JSON,
not generated JavaScript or private check reports.

**How to apply:** Use explicit public-field projections/DTOs at customer
boundaries. Do not pass full database project/model-run objects through component
props or actions.
