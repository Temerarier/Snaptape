REFERENCE CATALOG - the ONLY source for assumed sizes.
STRUCTURE: four sections, marked with === banners: [US], [DE/DACH], [OTHER], [INVARIANT]. Rule: pick EXACTLY ONE country section based on the detected country, and combine it with [INVARIANT] only. NEVER use an anchor from another country's section - a DE door height on a US house is a wrong scale.
Reliability classes: standardized > market-typical > statistical.

=== [US] United States - imperial profile ===
- entry door 2032 mm high x 914 mm wide (6 ft 8 in x 36 in) [standardized] - the primary US anchor; verify height against knob height
- door knob/deadbolt center ~914-965 mm (36-38 in) above floor [market-typical] - use to VERIFY the assumed door height
- garage door width single 2743 / double 4877 mm (9 / 16 ft), height 2134 mm (7 ft) [standardized]
- sliding patio door width 1829 mm (6 ft) [standardized]
- brick course incl. joint 67.7 mm (modular) [standardized]
- CMU concrete block course incl. joint 203.2 mm (8 in nominal) [standardized] - count courses on foundation/garage walls
- lap-siding exposure 101.6 mm (4 in); vinyl double-4 101.6 / double-4.5 114.3 mm [market-typical] - verify by counting courses over one storey
- asphalt shingle course exposure: 3-tab 127 mm (5 in), architectural ~143 mm [market-typical] - roof-plane chains only
- common window widths 610 / 762 / 915 mm, heights 1219 / 1524 mm [market-typical]
- storey height floor-to-floor 2600-3000 mm (8-9 ft ceilings) [market-typical] - cross-check eave height against stories
- porch/deck guard rail 914 mm (36 in, IRC) [standardized]
- exterior stair riser 178-190 mm, code max 196 mm [market-typical]
- curbside mailbox: bottom of box 1041-1143 mm (41-45 in) above road surface, USPS rule [standardized]
- full-size pickup truck length 5300-5900 mm [statistical - last resort]

=== [DE/DACH] Germany, Austria, Switzerland - metric profile ===
- entry door height 1985 or 2110 mm - state which and why [market-typical]. HISTORIC (pre-1950 Gruenderzeit/villa) doors are 2300-2600 mm: if facade age suggests pre-1950, treat any door-based scale as [statistical] and verify it against brick coursing or handle height.
- door handle height 1050 mm above finished floor, DIN 18101 [standardized] - use it to VERIFY the assumed door height (handle sits at ~50 percent of a 2110 mm door).
- brick coursing incl. joint - CLASSIFY the format first: NF raster 250 x 83.3 (12 courses per m), DF raster 250 x 62.5 (16 courses per m), Reichsformat pre-1950 ~78 mm. Format stated: [standardized]; ambiguous: [market-typical] at best, list both candidates.
- storey height floor-to-floor: modern residential 2600-3000 mm; Gruenderzeit/pre-1918 3500-4000 mm [market-typical] - cross-check eave height against stories x storey height + plinth.
- window sill height ground floor 800-900 mm [market-typical]
- standard 1-leaf window 1230 x 1480 mm [market-typical - wide spread]
- roller shutter box height 165-300 mm [market-typical]
- balcony/stair guard rail 900 mm (up to 12 m fall height); 1000-1100 mm above [standardized]
- exterior stair riser 160-185 mm [market-typical]
- roof window (Velux-type raster) 780 x 1400 or 1140 x 1400 mm [market-typical]
- PV module modern 1722 x 1134 mm, older 1650 x 992 mm [standardized - excellent when visible]
- downspout DN 87 or DN 100 [market-typical - short distances only]

=== [OTHER] single anchors only, all market-typical ===
 UK entry door 1981 mm, brick course 75 mm; NL entry door 2315 mm; FR entry door 2040 mm.

=== [INVARIANT] valid in ANY country - always usable on top of the country section ===
- license plate: EU 520 x 110 mm; US/CA 305 x 152 mm (12 x 6 in) [standardized] - identify the plate type first
- pallet: Euro 1200 x 800 x 144 mm; US GMA 1219 x 1016 mm (48 x 40 in) [standardized - excellent when visible]
- IBC tote 1000 L incl. pallet 1200 x 1000 x 1160 mm [standardized - usually in_front of the facade: apply plane/parallax handling]
- wheelie bin EN 840 240 L: height 1075 mm, width 580 mm [standardized - usually in_front]
- adult person 1650-1850 mm [statistical - last resort]

If the detected country has no section here and no INVARIANT object or user reference is visible: set affected values to null with low_reason "no reliable country reference".
