# Control icon proposal

The four round controls use 22px SVG glyphs with 2px rounded strokes.
These values and glyph paths are **proposed — not derived from reference**.
They retain the existing 44px control circles and use `currentColor`, without
introducing new colors or changing control spacing.

# Viewer v4 runtime tokens

Runtime source: `artifacts/aufmass-app/lib/viewer-next/tokens.ts`. Its `viewerTokens` export is the single named runtime source; `viewerTokenStyles` exposes every entry as `--viewer-<kebab-name>`. Values are primitive strings/numbers.

All `L…` citations below refer exactly to `docs/viewer-reference/desktop.html`; context identifies the original declaration or script object. Hex values retain the reference value exactly (including channel values), rather than screenshot sampling or approximation.

## Typography and UI

| Token | Value | Source / original context |
|---|---:|---|
| `fontSans` | `'IBM Plex Sans', sans-serif` | L21, viewer root `font-family` |
| `fontMono` | `'IBM Plex Mono', monospace` | L29, status-line `font-family` |
| `pageBackground` | `#FAFBFC` | L14, `html, body … background` |
| `surface` | `#FFFFFF` | L26, header `background` |
| `textPrimary` | `#16233A` | L21, viewer root `color` |
| `textSecondary` | `#43536E` | L32, Add photos `color` |
| `textMuted` | `#5B6B85` | L29, status-line `color` |
| `textTertiary` | `#6B7A93` | L437, upload help `color` |
| `border` | `#E3E8EF` | L26, header `border-bottom` |
| `borderStrong` | `#D5DEEA` | L32, Add photos `border` |
| `accent` | `#2563EB` | L15, link `color` |
| `accentHover` | `#1D4ED8` | L16, link hover `color` |
| `accentSoft` | `#EAF1FE` | L33, Reset hover `background` |
| `surfaceHover` | `#F1F5F9` | L32, Add photos hover `background` |

## Viewport, state, and category colours

| Token(s) | Value | Source / original context |
|---|---:|---|
| `viewportBackgroundStart` | `#F6F8FB` | L41, viewport gradient 0% |
| `viewportBackgroundEnd` | `#EEF2F7` | L41, viewport gradient 100% |
| `gridLine`; `gridSize`; `gridOpacity` | `#E3E8EF`; `48px`; `0.5` | L42, grid gradients, `background-size`, `opacity` |
| `dimensionLine` | `#3A4A63` | L151, permanent dimension group `stroke` |
| `modelOutline` | `#8A97AB` | L163, dimension box `stroke` (also model strokes L117–133) |
| `measure` | `#991B1B` | L176, user measure line `stroke` |
| `condition`; `categoryConditions` | `#EA580C` | L138, condition callout `stroke`; L806 card `color` |
| `danger` | `#DC2626` | L136, severe condition `stroke` |
| `warning`; `categoryWalls` | `#B45309` | L140, moderate condition text; L746 Walls card `color` |
| `warningSoft` | `#FCEEDC` | L807, moderate badge `badgeBg` |
| `dangerSoft` | `#FDE8E8` | L808, severe badge `badgeBg` |
| `success`; `categoryRoof` | `#0E7490` | L689, Roof card `color` |
| `successSoft` | `#E0F2F7` | L803, verify badge `badgeBg` |
| `categoryEdges` | `#7C3AED` | L699, Roof Edges card `color` |
| `categoryPenetrations` | `#475569` | L727, Penetrations card `color` |
| `categoryGutters`; `categoryHeight`; `categoryTrim` | `#64748B` | L732 Gutters, L741 Heights, L800 Trim card `color` |
| `categoryOpenings` | `#C026D3` | L767, Openings card `color` |

## Tally, elevation materials, and shadows

| Token(s) | Value | Source / original context |
|---|---:|---|
| `tallyBackground` | `#16233A` | L203, calculation bubble `background` |
| `tallyChip` | `#22324D` | L215, tally chip `background` |
| `tallyChipControl`; `tallyControlBorder` | `#45577A` | L211 Clear `border`; L215 remove control `background` |
| `tallyShadow` | `0 8px 28px rgba(20,30,50,0.35)` | L203, calculation bubble `box-shadow` |
| `floatingControlShadow` | `0 2px 10px rgba(20,30,50,0.12)` | L221, measure pill `box-shadow` |
| `cardShadow` | `0 1px 2px rgba(20,30,50,0.04)` | L270, measurement card `box-shadow` |
| `toastShadow` | `0 4px 16px rgba(20,30,50,0.25)` | L420, toast `box-shadow` |
| `modelRoofLight` | `#C9CFD8` | L508, `FILLS` RF1/RF5/RF7 |
| `modelRoofMedium` | `#BFC7D2` | L508, `FILLS` RF3 |
| `modelRoofLightAlt` | `#D4DAE2` | L508, `FILLS` RF6 |
| `modelWallLight` | `#EDE8DB` | L508, `FILLS` WL1 |
| `modelWallBrick` | `#D9C4B2` | L508, `FILLS` WL3/WL5 |
| `modelGarageDoor` | `#E7EBF1` | L508, `FILLS` GD1 |
| `modelDoor` | `#B08968` | L508, `FILLS` DR1 |
| `modelWindow` | `#DCE8F2` | L508, `FILLS` W1–W7 |
| `modelChimney` | `#C4B5A5` | L508, `FILLS` CH1 |
| `modelFascia` | `#F5F0E6` | L508, `FILLS` FC1 |

## Brief-defined constraints (not HTML design tokens)

These are behavioural, geometry, or accessibility requirements from `.local/tasks/viewer-responsive-rendering-polish.md`, not values derived from the desktop HTML and not entries in `viewerTokens`: exactly two portrait states (split/full model, L8 and L15); phone controls below `768px` (L16); `44px` minimum touch targets plus accessible names and clear active states (L16 and L22); phone dimension/tooltip labels at `14px` (L19); all text at least `12px` (L19); and a `260px` minimum model viewport height in split state (L15). They must remain implementation constraints rather than being presented as reference styling.

## Consolidated proposal list

Every entry below is **proposed — not derived from reference**. The HTML has no corresponding WebGL/build defaults or orange bottom-warning treatment.

| Token | Value | Rationale |
|---|---:|---|
| `modelNeutral` | `#8B9299` | Preserve current low-confidence fallback (`buildModel.ts:34`). |
| `modelConditionFallback` | `#D97706` | Preserve current condition fallback (`buildModel.ts:35`). |
| `modelOpeningGarage` | `#46505A` | Preserve current garage-door material (`buildModel.ts:841`). |
| `modelOpeningSkylight` | `#79A8C7` | Preserve current skylight material (`buildModel.ts:841`). |
| `modelOpeningDefault` | `#DCE7EF` | Preserve current default opening material (`buildModel.ts:841`). |
| `modelAttachmentPrimary` | `#A6ADB5` | Preserve current addition/bay/dormer fallback (`buildModel.ts:942`). |
| `modelAttachmentSecondary` | `#66727D` | Preserve current other-attachment fallback (`buildModel.ts:944`). |
| `qualityWarningBackground` | `#FFF7ED` | Preserve existing bottom quality block `bg-orange-50` (`ViewerNextClient.tsx:705`); do not recolour it. |
| `qualityWarningText` | `#7C2D12` | Preserve existing bottom quality block `text-orange-900` (`ViewerNextClient.tsx:705`); do not recolour it. |
| `rendererGroundLight` | `#AAB6C4` | Preserve neutral hemisphere ground hue; avoids a colour cast. |
| `rendererLight` | `#FFFFFF` | Neutral sky/key light preserves measured material colours. |
| `rendererHemisphereIntensity` | `2.2` | Higher ambient fill balances the renderer's Z-up hemisphere lighting. |
| `rendererKeyIntensity` | `1.3` | Reduced directional intensity lowers contrast against the stronger ambient fill. |
| `selectionFillOpacity` | `0.32` | Visible selection while retaining material identity. |
| `glassOpacity` | `0.38` | Restrained glazing over the reference window blue. |
| `contactShadowOpacity` | `0.2` | Subtle grounding without resembling model geometry. |

### Render-only surface placement and hatch spacing

These four values are **proposed — not derived from reference**. They are renderer implementation parameters in millimetres, not measured building quantities or reference-derived design dimensions. The brief requires slight outward placement and hatching, but does not prescribe these numeric values. Canonical model corners, measurement totals and snapping locations remain authoritative and unchanged.

| Token | Value | Purpose / rationale |
|---|---:|---|
| `openingOffsetMm` | `2` mm | Translate surface-opening visuals outward along the parent normal to separate them from the parent face, supplementing negative polygon offset. |
| `conditionOffsetMm` | `3` mm | Translate condition patches outward along the parent normal, above the opening layer, without changing recorded condition geometry or area. |
| `selectionOffsetMm` | `1` mm | Add outward separation relative to the selected visual: selected openings sit at 3 mm and selected conditions at 4 mm, with stronger negative polygon offset for selection fills. |
| `conditionHatchMm` | `240` mm | Set the repeating condition-texture period in surface coordinates; this is presentation spacing, not a condition measurement or a pixel size copied from the reference. |

### Condition decal transparency

These two values are **proposed — not derived from reference**. They control WebGL texture alpha; the existing reference-derived semantic colour tokens remain the colour source.

| Token | Value | Purpose / rationale |
|---|---:|---|
| `conditionFillOpacity` | `0.25` | Keep the patch background translucent so the actual parent material remains visible. |
| `conditionHatchOpacity` | `0.82` | Give hatch strokes stronger contrast than the patch background while retaining translucency. |