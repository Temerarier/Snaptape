---
name: Public pages and printable reports
description: Provider boundaries for public navigation and the privacy constraints on measurement exports.
---

When the shared root layout selects providers from the request pathname, navigation
between provider-free public pages and authenticated pages must reload the document.

**Why:** Next.js retains shared root layouts during client navigation. A public-to-login
transition can otherwise mount Clerk UI without ClerkProvider; the reverse transition
can retain authentication scripts on a supposedly provider-free public page.

**How to apply:** Preserve native links across this boundary, or move providers into
appropriate route layouts before converting those links to client navigation. Test
the actual sign-in link, not just a direct visit to the login URL.

The printable measurement sheet must contain only project metadata, existing panel
values, quality information and the verbatim disclaimer, not the surrounding app or
the complete language dictionary.

**Why:** The owner explicitly forbids credit, cost and model information in the report
HTML, including hidden payloads. The normal root's serialized dictionary contains
billing and public pricing strings even when those elements are not displayed.

**How to apply:** Keep the print response independent of the app/RSC shell, select
project fields explicitly, and reuse the viewer's preparation and formatted cards.
Do not introduce another measurement calculation. The required English disclaimer
is unchanged even on a German measurement sheet.

Public marketing and legal pages are English-only for the US trial. Supplied legal
texts are drafts, not verified legal or operational assurances.

**Why:** The owner required verbatim text with placeholders left for later completion
and legal review before paid use.

**How to apply:** Do not silently replace placeholders or rewrite those drafts.
Changes to factual privacy claims need confirmation against actual service behavior.
