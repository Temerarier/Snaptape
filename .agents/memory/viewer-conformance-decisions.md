---
name: Viewer conformance decisions
description: Authority of portrait source for phone conformance
---

Phone conformance uses the tablet-portrait source export, adapted through wrapping and reflow, not a distinct phone artboard.

**Why:** The user explicitly overrode the spec's phone-only round controls and bottom tally bar; no mobile source export was supplied. The export source, not unresolved placeholders rendered in a browser, is the comparison material.

**How to apply:** Keep the portrait header controls and top-centre tally/top-right measure arrangement on narrow screens. Follow hard legibility requirements when a reference uses undersized text or targets. Preserve fixture values rather than copying decorative reference data.
