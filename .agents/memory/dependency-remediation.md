---
name: Dependency remediation boundaries
description: Compatibility constraints when fixing transitive dependency advisories.
---

Prefer a narrow patched transitive override when a compatible parent upgrade still carries the vulnerability and a parent major upgrade would broaden the work.

**Why:** The storage SDK's existing request transports load UUID generation through CommonJS. Choosing an ESM-only UUID release solely because it is newest would break those callers. A security-only change should not implicitly migrate the storage transport or framework.

**How to apply:** Check the current parent's supported dependency versions and module format before changing an override. Exercise actual consumer resolution, UUID generation, and patched bounds checks, not just successful installation. Reconsider the override when the parent supports the patched dependency natively.
