/**
 * Runtime design tokens for viewer-next.
 *
 * Reference-derived values are transcribed from
 * docs/viewer-reference/desktop.html. Values in the final block are explicitly
 * proposed because the desktop reference does not define WebGL materials.
 */
export const viewerTokens = {
  fontSans: "'IBM Plex Sans', sans-serif",
  fontMono: "'IBM Plex Mono', monospace",

  pageBackground: "#FAFBFC",
  surface: "#FFFFFF",
  textPrimary: "#16233A",
  textSecondary: "#43536E",
  textMuted: "#5B6B85",
  textTertiary: "#6B7A93",
  border: "#E3E8EF",
  borderStrong: "#D5DEEA",
  accent: "#2563EB",
  accentHover: "#1D4ED8",
  accentSoft: "#EAF1FE",
  surfaceHover: "#F1F5F9",

  viewportBackgroundStart: "#F6F8FB",
  viewportBackgroundEnd: "#EEF2F7",
  gridLine: "#E3E8EF",
  gridSize: "48px",
  gridOpacity: 0.5,

  dimensionLine: "#3A4A63",
  modelOutline: "#8A97AB",
  measure: "#991B1B",
  condition: "#EA580C",
  danger: "#DC2626",
  warning: "#B45309",
  warningSoft: "#FCEEDC",
  dangerSoft: "#FDE8E8",
  success: "#0E7490",
  successSoft: "#E0F2F7",

  categoryRoof: "#0E7490",
  categoryEdges: "#7C3AED",
  categoryPenetrations: "#475569",
  categoryGutters: "#64748B",
  categoryHeight: "#64748B",
  categoryWalls: "#B45309",
  categoryOpenings: "#C026D3",
  categoryTrim: "#64748B",
  categoryConditions: "#EA580C",

  tallyBackground: "#16233A",
  tallyChip: "#22324D",
  tallyChipControl: "#45577A",
  tallyControlBorder: "#45577A",
  tallyShadow: "0 8px 28px rgba(20,30,50,0.35)",
  floatingControlShadow: "0 2px 10px rgba(20,30,50,0.12)",
  cardShadow: "0 1px 2px rgba(20,30,50,0.04)",
  toastShadow: "0 4px 16px rgba(20,30,50,0.25)",

  modelRoofLight: "#C9CFD8",
  modelRoofMedium: "#BFC7D2",
  modelRoofLightAlt: "#D4DAE2",
  modelWallLight: "#EDE8DB",
  modelWallBrick: "#D9C4B2",
  modelGarageDoor: "#E7EBF1",
  modelDoor: "#B08968",
  modelWindow: "#DCE8F2",
  modelChimney: "#C4B5A5",
  modelFascia: "#F5F0E6",

  // proposed — not derived from reference: preserves buildModel's low-confidence fallback.
  modelNeutral: "#8B9299",
  // proposed — not derived from reference: preserves buildModel's condition fallback.
  modelConditionFallback: "#D97706",
  // proposed — not derived from reference: preserves buildModel's semantic opening colors.
  modelOpeningGarage: "#46505A",
  // proposed — not derived from reference: preserves buildModel's semantic opening colors.
  modelOpeningSkylight: "#79A8C7",
  // proposed — not derived from reference: preserves buildModel's semantic opening colors.
  modelOpeningDefault: "#DCE7EF",
  // proposed — not derived from reference: preserves buildModel's attachment palette.
  modelAttachmentPrimary: "#A6ADB5",
  // proposed — not derived from reference: preserves buildModel's attachment palette.
  modelAttachmentSecondary: "#66727D",
  // proposed — not derived from reference: preserves the existing bottom quality warning's orange-50.
  qualityWarningBackground: "#FFF7ED",
  // proposed — not derived from reference: preserves the existing bottom quality warning's orange-900.
  qualityWarningText: "#7C2D12",
  // proposed — not derived from reference: neutral Three.js hemisphere ground light.
  rendererGroundLight: "#AAB6C4",
  // proposed — not derived from reference: neutral Three.js key/sky light.
  rendererLight: "#FFFFFF",
  // proposed — not derived from reference: higher ambient for balanced fill in the Z-up scene.
  rendererHemisphereIntensity: 2.2,
  // proposed — not derived from reference: reduced directional contrast against the ambient fill.
  rendererKeyIntensity: 1.3,
  // proposed — not derived from reference: readable selection without hiding material color.
  selectionFillOpacity: 0.32,
  // proposed — not derived from reference: render-only decal spacing and hatch period.
  conditionOffsetMm: 3,
  // proposed — not derived from reference: opening layer below conditions,
  // selection one further millimetre above its selected surface.
  openingOffsetMm: 2,
  selectionOffsetMm: 1,
  conditionHatchMm: 240,
  // proposed — not derived from reference: translucent decal/hatch alpha.
  conditionFillOpacity: 0.25,
  conditionHatchOpacity: 0.82,
  // proposed — not derived from reference: restrained glazing over the reference window blue.
  glassOpacity: 0.38,
  // proposed — not derived from reference: subtle footprint-scaled grounding.
  contactShadowOpacity: 0.2,
} as const;

type ViewerTokenName = keyof typeof viewerTokens;
type ViewerTokenProperty = `--viewer-${string}`;

function toKebabCase(name: ViewerTokenName): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** CSS custom properties; clients may cast this object to React.CSSProperties. */
export const viewerTokenStyles = Object.freeze(
  Object.fromEntries(
    Object.entries(viewerTokens).map(([name, value]) => [
      `--viewer-${toKebabCase(name as ViewerTokenName)}`,
      value,
    ]),
  ),
) as Readonly<Record<ViewerTokenProperty, string | number>>;