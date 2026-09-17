# Viewer-next specification checklist

This checklist evaluates every rule in `docs/viewer-spec.md:1-224`. “Pass” means the
implementation and available evidence support the rule. “Override” is a deliberate binding
override (usually fixture data, minimum legibility, or phone layout). “Limited” means the
code path exists but the available browser captures cannot prove a physical-device or
pixel-perfect property. “Ambiguous” records a contradiction between the prose and an
export. Reference citations are given separately for desktop, tablet-landscape, and
tablet-portrait; there is no mobile reference export in this repository.

## 1. Sources of truth (`viewer-spec.md:7-25`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Reference governs structure, styling, order, row anatomy, type, spacing, colors | `desktop.html:21-42,238-417,687-810` | `tablet-landscape.html:21-42,231-410,680-803` | `tablet-portrait.html:21-42,220-418,683-806` | **Pass.** The implementation follows the shared shell/card/row grammar. The exports contain raw `{{...}}` placeholders and are not standalone rendered truth. |
| Four exports, including mobile | `desktop.html` | `tablet-landscape.html` | `tablet-portrait.html` | **Limited/ambiguous.** `mobile.html` is absent. Phone is assessed as the narrow portrait adaptation required by the user override, never as a fourth reference pass. |
| Rules and behavior come from this spec | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Viewer behavior is implemented in `ViewerNextClient.tsx`, `CalcBubble.tsx`, and `ViewerViewport.tsx`, not inferred from decorative export values. |
| Values come from `computeDerived` and the garage-house fixture; viewer does not hard-code them | card data `:474-512,687-810` | `:468-505,680-803` | `:471-507,683-806` | **Pass/override.** `viewerCards.ts:185-647` uses shared derived data plus raw fixture metadata. The export's demo values are intentionally not used. |
| Schema contract is measurement v1.6 | `desktop.html:474-512` | `tablet-landscape.html:468-505` | `tablet-portrait.html:471-507` | **Pass.** Typed null/source/class handling is retained; schema provenance/confidence is not rendered per value, as required by §12. |
| Reference demo is not the fixture and its numbers are decoration | `desktop.html:687-810` | `tablet-landscape.html:680-803` | `tablet-portrait.html:683-806` | **Pass.** The app shows fixture values: roof 2,097/21.0/6, walls net 2,779, openings 16+1+1+1+1, and the specified edge/drainage values. |
| Panel content is constant across sizes | `desktop.html:238-417` | `tablet-landscape.html:231-410` | `tablet-portrait.html:220-418` | **Pass with phone override.** Cards/data are shared. Only shell placement and responsive row/grid treatment change; phone stacks the same content in a sheet. |

## 2. Layout (`viewer-spec.md:27-37`)

| Rule | Desktop | Tablet landscape | Tablet portrait | Status/evidence |
|---|---|---|---|---|
| Viewport left, Measurements panel right, approximately 65/35 | `desktop.html:21-42,238-257` | `tablet-landscape.html:21-42,231-250` | `tablet-portrait.html:21-42,220-253` | **Pass wide; override portrait.** Wide captures show viewport/panel split. Portrait uses the observed stacked sheet. |
| Phone viewport full screen and panel bottom sheet | no mobile export | no mobile export | `tablet-portrait.html:220-284` | **Override/pass.** Phone uses the narrow portrait sheet with an exposed viewport. No claim of a mobile export comparison. |
| Phone detents, drag handle, always-visible header | no mobile export | no mobile export | `tablet-portrait.html:220-284` | **Pass under portrait override; explicit overflow adaptation.** Detents use exact `72/42/12` viewport proportions, even with tally active. The handle is 44px. Short-screen tests assert each proportion within 1px for tap cycles AND three-way drag snapping, including half; also selection-to-peek, persistent tally and at least 64px of card scrolling. Measurements stays visible while compressed status/filter content scrolls. The top viewport region also scrolls when compressed; not every viewport control and tally can be simultaneously visible at the 12% detent on a short phone. |
| Header title/status, expandable warnings, filters then cards | `desktop.html:238-288` | `tablet-landscape.html:231-279` | `tablet-portrait.html:220-284` | **Pass.** Header exposes counts/pointers; warning entries live only in the bottom quality block. |
| Filters are All, Roofing, Siding, Painting | `desktop.html:238-288` | `tablet-landscape.html:231-279` | `tablet-portrait.html:220-284` | **Pass.** `filterCards` uses the exact sets: Roofing = roof/edges/penetrations/gutters/height; Siding = height/walls/openings/trim; Painting = walls/openings/trim/condition. |
| Default filter is All | `desktop.html:238-288` | `tablet-landscape.html:231-279` | `tablet-portrait.html:220-284` | **Pass.** Initial state renders all nine cards. |

## 3. Nine cards and ownership (`viewer-spec.md:39-51`)

The card-level source ranges are listed individually to avoid treating the reference's
single data block as proof that every card was checked.

| Card/order and rule | Desktop exact range | Tablet-landscape exact range | Tablet-portrait exact range | Status/evidence |
|---|---|---|---|---|
| 1. Roof Area; title, hero/unit, context, material; collapse retains hero | `desktop.html:689-698` | `tablet-landscape.html:682-691` | `tablet-portrait.html:685-694` | **Pass/fixture override.** Fixture hero is 2,097 sq ft, 21.0 SQ, six facets. RF rows use raw area metadata; RF-1 + RF-2 rounds to 1,346 sq ft. |
| 2. Roof Edges; edge classes and unclassified edge remain visible | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass.** Eaves/ridge/rakes etc. are owned here; source badge derives from eaves+rakes; unclassified is not dropped. |
| 3. Penetrations; chimney and skylight count/type here | `desktop.html:727-731` | `tablet-landscape.html:720-724` | `tablet-portrait.html:723-727` | **Pass.** Pipe boots are labeled; repeated skylights sum; areas remain in owning roof/opening details. |
| 4. Gutters & Downspouts; runs and individually orderable drops | `desktop.html:732-740` | `tablet-landscape.html:725-733` | `tablet-portrait.html:728-736` | **Pass.** Four drops (18+18+18+9 = 63' 0") are shown as separate sub-rows. |
| 5. Height; separate roof-class card | `desktop.html:741-745` | `tablet-landscape.html:734-738` | `tablet-portrait.html:737-741` | **Pass.** Height is shared by the specified Roofing/Siding filters without value duplication. |
| 6. Walls; one row per wall, gables in context only | `desktop.html:746-766` | `tablet-landscape.html:739-759` | `tablet-portrait.html:742-762` | **Pass.** Net 2,779 sq ft; gables 322 sq ft contained in wall total; six wall breakdowns reconcile. |
| 7. Openings; all five ordered types and complete list | `desktop.html:767-799` | `tablet-landscape.html:760-792` | `tablet-portrait.html:763-795` | **Pass.** Fixture list is 16 windows plus one door, patio door, garage door, and skylight. More-than-six grouping is type-scoped. |
| 8. Trim & Roofline; separate trim vocabulary/rows | `desktop.html:800-805` | `tablet-landscape.html:793-798` | `tablet-portrait.html:796-801` | **Pass.** Fascia/soffit/corners remain separate; null fascia remains visible for verification. |
| 9. Condition Areas; list stays in card, model tint is separate toggle | `desktop.html:806-810` | `tablet-landscape.html:799-803` | `tablet-portrait.html:802-806` | **Pass/limited gesture proof.** Condition card belongs to Painting; model overlay path exists, but physical toggle/tint equality is not proven by screenshots. |
| Card anatomy and collapse behavior | `desktop.html:238-288` | `tablet-landscape.html:231-279` | `tablet-portrait.html:220-284` | **Pass.** Uppercase titles, context lines, optional chips, hero retention, and row lists are present. |
| One home per value across cards | `desktop.html:474-512,687-810` | `tablet-landscape.html:468-505,680-803` | `tablet-portrait.html:471-507,683-806` | **Pass.** Semantic ownership is Roof (roof/edges/penetrations/gutters/height), Walls, Openings, Trim, Condition. A hero plus its own detail row within the owning card is not a cross-card duplicate. |
| Derived row uses a `from …` chip instead of repeating sources | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** `sourceBadge` is derived from eaves+rakes. |

## 4. Rows and interaction (`viewer-spec.md:53-65`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| One tap opens/closes rows containing sub-rows/items/calcs | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Row click state in `ViewerNextClient.tsx:738-930`; rows with no children do not invent expansion. |
| Multiple rows can remain open; state survives filter switching | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Expansion is keyed per row/card and not reset by filter changes. |
| Left label + optional badge and sub-line | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Long badge/material cases use independent grid slots. |
| Right value + unit is 17px semibold tabular mono | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass/legibility override.** Implementation enforces 17px even where export text is 10/11px. |
| Copy and Σ actions on group, sub-row, item rows | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Actions are not restricted to only top-level rows. True target is at least 44px. |
| Badge, label, material, and value never overlap | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass at measured viewports.** Narrow grid and reflow solve overflow rather than shrinking type; all five browser geometry checks report no violations. |
| Uncaptured elevation says “Not captured — add photo” | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass/limitation.** Null wall path keeps row and CTA. Fixture-route Add photo is UI-only and cannot append a real photograph. |

### Row-type inventory

These are the distinct row anatomies in the exports and implementation, rather than a
single blanket “row anatomy” assertion:

| Type | Desktop exact range | Tablet-landscape exact range | Tablet-portrait exact range | Status |
|---|---|---|---|---|
| Standard flat value row | `desktop.html:294-333` | `tablet-landscape.html:287-326` | `tablet-portrait.html:290-329` | **Pass.** |
| Badge/material row | `desktop.html:296-304` | `tablet-landscape.html:289-297` | `tablet-portrait.html:292-300` | **Pass.** |
| Derived/source-badge row | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass.** |
| Expanded wall-calculation row | `desktop.html:327-344` | `tablet-landscape.html:320-337` | `tablet-portrait.html:323-340` | **Pass.** |
| Opening/downspout group row | `desktop.html:345-373` | `tablet-landscape.html:338-366` | `tablet-portrait.html:341-369` | **Pass.** |
| Nested opening/drop sub-row and item row | `desktop.html:374-401` | `tablet-landscape.html:367-394` | `tablet-portrait.html:370-397` | **Pass.** |
| Null/empty/uncaptured CTA row | `desktop.html:294-333,306-308` | `tablet-landscape.html:287-326,299-301` | `tablet-portrait.html:290-329,302-304` | **Pass with Add photo integration limit.** |
| Unclassified edge row | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass; no extra review label.** |
| Condition-area row | `desktop.html:806-810` | `tablet-landscape.html:799-803` | `tablet-portrait.html:802-806` | **Pass; physical toggle limited.** |

## 5. Walls (`viewer-spec.md:67-84`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| One WL-n row, elevation first, gross sub-line, net value, material chip | `desktop.html:746-766` | `tablet-landscape.html:739-759` | `tablet-portrait.html:742-762` | **Pass.** Fixture has six wall rows and net 2,779 sq ft. |
| Open row shows computeDerived calculation | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Width × height, optional gable, and opening deduction lines are rendered right-aligned. |
| At most three applicable lines; no zero lines; unit once | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Zero-area opening deduction is omitted and lines use the row's established net/gross values. |
| Lines reconcile to gross/net exactly | `desktop.html:746-766` | `tablet-landscape.html:739-759` | `tablet-portrait.html:742-762` | **Pass.** Fixture tests reconcile every populated wall; WL-4 gable formula is explicit. |
| Inputs are faces dimensions and openings by parent_face_id | `desktop.html:474-512` | `tablet-landscape.html:468-505` | `tablet-portrait.html:471-507` | **Pass.** No display-string parsing is used for tally or breakdown. |
| Gables context is 0.5 × width × gable height and never an extra total | `desktop.html:746-766` | `tablet-landscape.html:739-759` | `tablet-portrait.html:742-762` | **Pass.** Context is 322 sq ft from three gabled walls; no gable count row. |

## 6. Openings (`viewer-spec.md:86-93`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Type order: Windows, Doors, Patio Doors, Garage Doors, Skylights | `desktop.html:767-799` | `tablet-landscape.html:760-792` | `tablet-portrait.html:763-795` | **Pass.** Empty types are omitted; populated types appear in order. |
| More than six groups by parent wall and disambiguates shared elevations | `desktop.html:767-799` | `tablet-landscape.html:760-792` | `tablet-portrait.html:763-795` | **Pass.** Group IDs are scoped by type (`og_window_…`, `og_door_…`) and elevation/id is used when needed. |
| Item has id/W×H, area, and written “Perimeter” line | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Every fixture window is retained; no “more” truncation. |
| Elevation not repeated inside each item | `desktop.html:767-799` | `tablet-landscape.html:760-792` | `tablet-portrait.html:763-795` | **Pass.** It belongs to the type/group heading. |
| Opening ownership is not duplicated into Walls | `desktop.html:746-799` | `tablet-landscape.html:739-792` | `tablet-portrait.html:742-795` | **Pass.** Walls show deduction sums only; item list is Openings only. |

## 7. Gutters and Downspouts (`viewer-spec.md:95-100`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Gutter runs come from eave edges and stay on their row | `desktop.html:732-740` | `tablet-landscape.html:725-733` | `tablet-portrait.html:728-736` | **Pass.** Eaves are not copied into Roof Edges as a second gutter total. |
| Downspout group has count and total drop | `desktop.html:732-740` | `tablet-landscape.html:725-733` | `tablet-portrait.html:728-736` | **Pass.** Fixture displays four and 63' 0". |
| One sub-row per drop with elevation and own length; sub-rows add up | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Four lengths are independently visible and sum exactly. |
| Drops are individually orderable | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Each sub-row has its own action/tally surface. |

## 8. Selection box (`viewer-spec.md:102-109`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Click selects and syncs with panel | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass/limited physical input.** Browser capture shows selected RF box; code supports panel/model synchronization. |
| Wall → width × height + net, with exact wall breakdown | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Selection details share wall calculation semantics. |
| Opening → W×H + area; roof → pitch + area; edge → length | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** `ViewerViewport.tsx:550-863`; interaction tests cover all kinds. |
| Attachment → W×H×D | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Attachment dimensions are three-dimensional. |
| Box grows to fit, never truncates or drops below 12px | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass at measured sizes/limited all content.** Bounds and 12px floor are implemented; every possible long label is not screenshot-exhaustively proven. |
| Box does not cover element; connector on small viewports | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass/limited.** Placement tests avoid bounds and controls; captures show RF box beside model. |

## 9. Tally, measure line, and controls (`viewer-spec.md:111-136`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Same three functions everywhere plus calc bubble | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Measure, Reset, Conditions exist; only placement changes. |
| Free orbit; scroll/pinch zoom; no view/perspective/+/- controls | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass/physical gesture limited.** Real WebGL camera path and no forbidden buttons; pinch is not physically tested. |
| Reset returns initial framing | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass by implementation path; screenshot limited.** |
| Conditions toggles tint; list remains Condition Areas | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass/gesture limited.** Separate condition overlay and card are present. |
| Measure arms; two clicks draw independent ft-in line; multiple lines | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass/gesture limited.** `ViewerViewport.tsx:550-863`; browser evidence is not a physical pointer proof. |
| Esc/Clear removes lines; Clear only appears when lines exist | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Control state is conditional. |
| Snap only while placing; corners beat edges; free wall centre stays free | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass by interaction tests; physical fingertip range limited.** |
| Both endpoints independently snap and line shows snapped value | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass by interaction logic; physical gesture limited.** |

## 10. Calc bubble (`viewer-spec.md:138-143`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Σ adds row to floating dark bubble with removable chips, subtotal, Copy, Clear | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** `CalcBubble.tsx:13-134`; browser capture shows the rendered selected state. |
| Group only by same unit and semantic class | `desktop.html:474-512` | `tablet-landscape.html:468-505` | `tablet-portrait.html:471-507` | **Pass.** Roof/edges/penetrations/gutters/height follow reference CLS Roof; Walls/Openings/Trim/Condition remain separate. |
| Mixed selection gives separate subtotals | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Never merges unlike units/classes. |
| Repeated Σ removes; bubble survives chip changes and stays until cleared | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Zero is not treated as null. Parent + child source rows may intentionally double-count as explicit additive sums. |
| Copy is truthful if unavailable | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Copy failure is surfaced; no false success claim. |

## 11. Touch rules and placement (`viewer-spec.md:145-165`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| Phone/tablet drag orbit, pinch zoom, two-finger pan | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Implementation/limited.** Input gates and camera paths exist; no physical touch device was available. |
| Gesture hint is touch-only, exact wording, top-left | `desktop.html:813-1028` (desktop has none) | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** Desktop has no hint; touch layouts do. |
| Controls never below 44px and never hover-only | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass at measured sizes.** Browser geometry has no small-control violations. |
| Reset/conditions: header on desktop/tablets; round top-right phone | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass with phone override.** Header controls reflow on all devices; tablets do not duplicate them as floating buttons. |
| Measure: bottom-centre desktop/landscape, top-right portrait, phone above round buttons | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass; phone rule overridden.** Phone uses the portrait top-right pill and reflowed header controls, not a round button cluster. |
| Calc: top-centre wide/portrait, full-width above sheet phone | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass; phone rule overridden.** Phone uses portrait top-centre placement, never a bottom bar. Bubble height responds between 64px and 164px with scrolling; stage reserves its measured height without disabling detents. |
| Tablet keeps desktop header controls rather than phone duplicates | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass.** |

The exports themselves have a contradiction: the earlier portrait prose suggests side by
side, while the portrait artboard is stacked. The implementation follows the observed
stacked artboard and the explicit narrow-phone override.

## 12. Screen sizes and legibility (`viewer-spec.md:167-176`)

| Rule | Desktop | Tablet landscape | Tablet portrait | Phone |
|---|---|---|---|---|
| Desktop reference layout and hover is optional, not required | **Pass.** `desktop.html:21-42,238-417` | n/a | n/a | n/a |
| Tablet desktop panel/header and touch viewport; no round reset/condition buttons | n/a | **Pass.** `tablet-landscape.html:21-42,231-410` | **Pass.** `tablet-portrait.html:21-42,220-418` | n/a |
| Phone bottom sheet, round buttons, gesture hint, identical content | n/a | n/a | portrait basis `tablet-portrait.html:220-418` | **Override/pass.** Narrow portrait adaptation; no mobile export. |
| Minimum text 12px | `desktop.html:21-42,238-417` (**Pass/override:** reference includes 10/11px examples; implementation is scoped to 12px minimum.) | `tablet-landscape.html:21-42,231-410` (**Pass/override.**) | `tablet-portrait.html:21-42,220-418` (**Pass/override.**) | **Pass at five measured viewports.** |
| Values 17px semibold tabular mono | `desktop.html:294-417` (**Pass/override.**) | `tablet-landscape.html:287-410` (**Pass/override.**) | `tablet-portrait.html:290-418` (**Pass/override.**) | **Pass.** |
| Hero/stat numbers 26px+ semibold | `desktop.html:238-288` (**Pass/override:** implementation is 26px; reference shows 25px.) | `tablet-landscape.html:231-279` (**Pass/override.**) | `tablet-portrait.html:220-284` (**Pass/override.**) | **Pass.** |
| Contrast ≥6:1 where rule applies | `desktop.html:21-42,238-417` (**Pass scoped:** lightest text on white is treated as #636363; not a blanket claim for every image/canvas composite.) | `tablet-landscape.html:21-42,231-410` (**Pass scoped.**) | `tablet-portrait.html:21-42,220-418` (**Pass scoped.**) | **Pass scoped.** |
| Tap targets ≥44px and layout solves overflow | `desktop.html:294-417,813-1028` | `tablet-landscape.html:287-410,806-1022` | `tablet-portrait.html:290-418,809-1056` | **Pass at five measured viewports.** Browser results report no overflow/small-text/small-control violations. |

## 13. Cross-cutting rules (`viewer-spec.md:178-215`)

| Rule | Desktop reference | Tablet-landscape reference | Tablet-portrait reference | Status/evidence |
|---|---|---|---|---|
| No confidence dots/reasons/raw mm/field-verified action | `desktop.html:294-417,474-512` | `tablet-landscape.html:287-410,468-505` | `tablet-portrait.html:290-418,471-507` | **Pass.** Static data badges such as “Verify material” and “verify on site” remain and are not confidence readouts. |
| Quality warnings and references appear exactly once at bottom below last card | `desktop.html:238-288,813-1028` | `tablet-landscape.html:231-279,806-1022` | `tablet-portrait.html:220-284,809-1056` | **Pass.** Bottom block scrolls with cards and is not pinned. Header gives counts/generic pointers only; it does not duplicate warning entries. |
| Original warning strings retained; generic model warnings added | `desktop.html:238-288,813-1028` | `tablet-landscape.html:231-279,806-1022` | `tablet-portrait.html:220-284,809-1056` | **Pass.** `warningPresentation.ts` keeps source strings and maps diagnostics to localized generic lines, capped to avoid internals. |
| Disclaimer exact, static, every size/export | `desktop.html:238-288` | `tablet-landscape.html:231-279` | `tablet-portrait.html:220-284` | **Pass.** It is not data-derived and remains when warnings are empty. |
| Null row remains “— / verify on site” | `desktop.html:294-417` | `tablet-landscape.html:287-410` | `tablet-portrait.html:290-418` | **Pass.** Null walls, downspout totals, and trim values retain rows and are excluded from tally. |
| Unclassified edges are listed without extra review label | `desktop.html:699-726` | `tablet-landscape.html:692-719` | `tablet-portrait.html:695-722` | **Pass.** |
| Viewer never throws on unsupported geometry; panel survives model failure | `desktop.html:813-1028` | `tablet-landscape.html:806-1022` | `tablet-portrait.html:809-1056` | **Pass by fallback paths/limited exhaustive inputs.** WebGL/model failure is localized and cards remain. Unsupported geometry is degraded, omitted, or warned rather than taking down route. |
| Rounding: ft-in inch, whole sq ft, squares 1 decimal, pitch x/12 | `desktop.html:687-810` | `tablet-landscape.html:680-803` | `tablet-portrait.html:683-806` | **Pass/override.** Whole-number sq ft and whole-ft/LF are intentional binding formatting overrides to the reference's two-decimal tally decoration. |
| Quote vocabulary (Squares, Eaves/gutter run, Rakes, Drip edge, etc.) | `desktop.html:687-810` | `tablet-landscape.html:680-803` | `tablet-portrait.html:683-806` | **Pass.** Flashing/Step flashing, Pipe boots, corners, Soffit/Fascia, and Net facade remain distinct. |
| Technical Clean style, IBM Plex Sans/Mono, restrained color, no gradients | `desktop.html:21-42,238-417` | `tablet-landscape.html:21-42,231-410` | `tablet-portrait.html:21-42,220-418` | **Pass with binding override.** Reference gradient/zoom affordances conflict with no-gradient/free-orbit binding; implementation follows binding. |

The reference exports also contain source/demo contradictions: raw placeholders prevent
them from being a standalone rendered truth; reference 10/11px text and 25px heroes
conflict with the hard 12px/26px rules; gradient and zoom affordances conflict with the
binding style/control rules. These are recorded as overrides rather than silently called
passes.

## 14. Fixture acceptance (`viewer-spec.md:217-224`)

| Acceptance value/rule | Evidence | Status |
|---|---|---|
| Roof 2,097 sq ft, 21.0 SQ, six facets | `viewerCards` fixture tests and implementation; browser panel | **Pass** |
| Walls net 2,779 sq ft; gables 322 (131+131+60); no extra gable row | fixture tests and wall card | **Pass** |
| 16 windows, 1 door, 1 patio door, 1 garage door, 1 skylight | opening card tests and panel | **Pass** |
| Four downspouts, 63' 0" (18+18+18+9) | gutter card tests and panel | **Pass** |
| Eaves 118' 0", ridge 70' 0", rake 109' 9" | edge/gutter card tests | **Pass** |
| Every wall breakdown adds up; six walls pass reconciled check | wall calculation tests | **Pass** |

## 15. Browser and screenshot verification summary

The five conformance captures are actual application screenshots, not raw standalone
reference exports. They show the browser-rendered panel/cards, real WebGL model, viewport
controls, and a selected RF box. The selected box includes the expected pitch/dimension
presentation and a visible model-side placement; this confirms the UI is not merely static
HTML. The phone and narrow-phone captures show the stacked sheet/reflow, including the
control-space reservation.

Final `browser-results.json` records **27 browser checks passed, 0 failed**, including
orbit/reset, multiple measure lines/Clear/Esc, conditions state, tallies, mixed units/classes,
clipboard success/rejection, and the five viewport measurements. No measured viewport
reports horizontal document overflow, small text, or small controls. Unit suite: **147 passed, 0 failed**;
all workspace typechecks pass. Three additional active-tally cases (390×844, 320×640,
320×568) verify distinct handle tap/drag detents, row-selection focus, persistent tallies,
further additions and usable card scrolling. This report does not claim:

* physical iOS/Android touch, pinch, two-finger pan, or fingertip snap success;
* exhaustive screenshot/pixel equality against every reference region;
* every possible long label, unsupported geometry, or responsive width;
* that the fixture-route Add photo control can ingest a real photo (it cannot);
* that the absent `mobile.html` was compared.

Those are verification limits, not hidden failures. The implementation's current status is
therefore: **binding behavior/data/layout pass; intentional reference overrides documented;
physical-device and complete visual-equality claims limited**.