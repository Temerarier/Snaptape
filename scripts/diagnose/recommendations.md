## 7. Recommended general approach

### Establish a shared spatial model before drawing surfaces

Use both the footprint outline and individual measured faces, but give them different responsibilities. The footprint describes horizontal topology: closed rings, courtyards, boundaries, and the junctions between volumes. Faces describe measured surfaces, including their dimensions, openings, appearance, and ownership. Neither should silently overwrite the other.

Create an intermediate spatial model with explicit building volumes, attachment ownership, wall segments, roof patches, shared vertices/edges, and local coordinate frames. Every output surface must retain its source IDs and state whether its location is measured, derived, assumed, or unresolved. Elevation names are viewing/orientation labels, not addresses that uniquely locate surfaces. A single elevation may contain many walls on different planes.

Check dimensional agreement with stated tolerances derived from measurement uncertainty. If a face length disagrees with its mapped footprint segment, record the conflict and preserve both measurements; do not resize the source or stretch a whole building to hide it. Prefer explicitly located, higher-confidence observations only under a documented conflict policy. When topology is incomplete, draw a clearly marked massing approximation separately from measured surfaces. Do not call that approximation a placed measurement.

```text
stored measurement (unchanged)
    |
    +--> calculation quantities and source provenance
    |
    +--> spatial interpretation + conflicts + unresolved elements
             |
             +--> volumes / local frames / shared boundary graph
                      |
                      +--> closed surface geometry + validation
                               |
                               +--> rendering + anchored annotations
```

### Construct roofs as a connected surface graph

A roof type restricts possible topology; it does not uniquely locate a ridge or identify which surfaces belong to which volume. Resolve roof ownership before classifying roof planes. Use measured boundary vertices or explicit ridge/hip/valley/eave adjacency when available. Otherwise, solve the smallest supported topology consistent with footprint, pitch, eave constraints, and gable heights, and disclose any remaining ambiguity. Do not select the main roof by area or assign sides by IDs.

Each roof plane should share exact boundary vertices with adjacent planes and the supporting wall tops. For supported parameterized primitives, gable, hip, half-hip, mono-pitch, and flat roofs require different construction rules. Pitches and gable heights are constraints to reconcile, not interchangeable values silently overridden by a global ridge height. More complex roofs need explicit intersections and valleys, not intersecting independent rectangles.

Validate watertight boundary loops, nonzero area, consistent normals, shared ridge/hip/valley endpoints, non-self-intersection, and wall-to-roof contact. Roof vertices must not fall below their supporting *local* eave boundary, allowing documented overhangs and intentionally lower roof volumes. If the constraints cannot produce a valid closed roof, show unresolved measured patches or a labelled coarse envelope rather than a false complete roof. Geometry validation belongs before rendering; a renderer-generated skirt to ground must not masquerade as a measured wall.

### Treat attachments as owned geometry, not a single universal box

Use a common placement/ownership interface: parent surface or independent site transform, local position, orientation, dimensions, and evidence. Then distinguish geometry families:

- **Enclosed volumes:** garages, annexes, and enclosed bays own their wall faces, openings, roof patches, and materials. Connected volumes have junctions; a detached volume has an independent transform.
- **Roof insertions:** dormers intersect a parent roof and own their vertical walls and gable/mono-pitch/other roofs. A dormer cannot be represented correctly merely by extruding a block along a roof normal.
- **Thin surfaces and assemblies:** panels, awnings, balconies, canopies, and open porches need slab/plate thickness, slope, support/open-side semantics where measured, and distinct local axes.
- **Penetrations:** chimneys and vents need an axis/orientation and a roof intersection; they are not automatically normal to the roof plane.

Preserve positive measured dimensions, including thin panels. Do not infer physical size from a name, story count, identifier, or a generic minimum thickness. Do not copy a host roof's pitch unless explicitly declared as an assumption. Build attachment-owned walls and roof first; suppress a proxy only when ownership proves that the detailed representation covers it. Appearance belongs to the owned surfaces, not to a type-based proxy palette.

### Degrade explicitly and locally

Incomplete topology should not erase valid measured quantities. Distinguish “measurement missing”, “placement unresolved”, “unsupported topology”, “conflicting evidence”, and “represented by owned detailed geometry”. List affected IDs with concrete reasons and preserve them in takeoff views. A missing depth is unknown, not equal to width; a missing independent location is unresolved, not the world origin.

Keep any illustrative placeholder visually distinct and out of exact snapping/dimension calculations. Show what is known without implying closure or accuracy that is not supported. Preserve the raw measurement and make interpretation deterministic under collection reordering and identifier renaming. Identifier changes must not alter geometry.

### Render the resolved model without changing its meaning

Render structural surfaces opaque unless their actual material is translucent; secondary color must not make alternating structural triangles translucent. Resolve duplicate/coincident structural surfaces in the spatial model rather than hiding them with broad depth bias. Use local render offsets only for intentional overlays such as opening decals and selection highlights.

Anchor dimensions to the actual boundary vertices and edges, retaining per-volume and per-side height information. Screen-space collision avoidance may move labels and drawing rails, but witnesses must still identify the measured endpoints. Keep camera/framing/visibility decisions separate from the geometric quantity and its provenance. Test multiple views because a plausible silhouette can conceal intersecting or misplaced parts.

## 8. What the measurement must deliver that it does not today

The present schema has useful measurements and some ownership/position fields, but it is not a complete spatial topology contract. Adding fields alone will not fix the builder: existing fields must also be consumed correctly. In particular, footprint concavity, individual wall heights, attachment dimensions/positions, and supplied face-to-attachment ownership must not be dismissed as wholly absent information.

| Needed information | Why the viewer cannot reliably infer it | General measurement/schema requirement |
|---|---|---|
| Volume identity and relationships | A collection of facade widths does not identify distinct connected buildings or lower wings. | Identify each principal/secondary volume, its footprint/boundary, level/base datum, and connection to other volumes. |
| Wall-to-outline correspondence | “Front” and a length cannot distinguish two recessed or overlapping front-facing walls. | Link a wall to an ordered footprint segment or provide its spatial/local endpoints and parent volume. |
| Common coordinate frames | A two-dimensional position has no unambiguous world meaning without origin and axes, especially on a rear wall or sloped roof. | Define units, handedness, origin, local x/y direction, face normal, placement anchor, and whether height is vertical or normal-to-surface. |
| Roof topology and orientation | Roof type and edge lengths do not locate shared ridge, hip, valley, and eave endpoints. | Provide patch ownership and adjacency plus located vertices/edges, or a fully specified supported roof primitive with ridge direction, endpoints, slopes, and per-boundary eaves. |
| Precise pitch with uncertainty | A shallow roof may snap to zero rise-over-12; the snapped display value discards useful geometry information. | Preserve measured degrees/slope and uncertainty as geometry inputs; identify rounding explicitly. |
| Terrain and local base heights | Existing per-elevation grade offsets and datum notes are ignored; even when used, they do not uniquely locate grade at every corner or recessed wall. | First consume existing offsets; extend to a shared vertical datum and grade/base values at relevant vertices or wall endpoints when per-side data is insufficient. |
| Complete attachment ownership | A supplied roof ownership link does not resolve unlinked attachment walls; the current schema describes `parent_attachment_id` as roof-only. | Extend ownership semantics to applicable wall faces and populate them consistently; preserve existing opening-to-face links and distinguish unknown from explicitly main-building ownership. |
| Independent placements | `attached: false` does not specify where a detached garage sits. | Independent translation/orientation or a surveyed site relationship; otherwise retain unresolved location. |
| Attachment geometry family | Existing `dormer.style` and `dormer.face_pitch_deg` distinguish important dormer variants but are ignored; other generic types do not describe open sides, panel orientation, or detailed boundaries. | Consume existing dormer fields, then extend structured primitive/assembly semantics with own roof, wall/open-side state, thickness, and orientation where necessary. |
| Face boundaries and holes | Width, height, and area do not uniquely define clipped, nonrectangular, or multiply connected surfaces. | Ordered polygon boundary and opening/void loops, or a supported shape specification sufficient to derive them. |
| Positional uncertainty and conflict evidence | A confidence label on a scalar does not explain incompatible spatial observations. | Preserve measurement references, uncertainty/tolerance and unresolved alternatives, especially for inferred topology. |

Measurement generation must be allowed to say “not identifiable from these inputs”. A prompt cannot extract an unseen detached-building position or exact roof junction from insufficient evidence. Never make a mandatory topology field force fabricated certainty. Retain compatibility with older records and display their limits without rewriting them.

## 9. Suggested order of work and dependencies

1. **Agree on spatial meanings and acceptance criteria.** Define coordinate frames, ownership, volume/face identity, uncertainty, and conflict policy; decide which shapes are directly supported and which require honest unresolved display. Use this diagnosis matrix as a baseline, not as a collection of buildings to special-case.
2. **Specify the measurement contract and compatibility boundary.** Depends on 1. Separate fields already supplied but ignored from genuinely missing topology. Validate parent references, units, face dimensions, and ownership without mutating stored measurements. Define backward-compatible unresolved states for historical data.
3. **Build a spatial interpretation layer with diagnostics.** Depends on 1–2. Map volumes, footprint segments, measured faces, and attachment transforms; reconcile conflicting constraints. Make every omission or simplification attributable to an ID and station. This must precede individual roof/attachment fixes.
4. **Build walls and roof topology on the same shared boundary graph.** Depends on 3. Support concave footprints and local base/eave heights; construct separate gable/hip/half-hip/flat/shed primitives, then multi-volume intersections. Validate closure, contact, and source provenance before producing render meshes.
5. **Build attachment families and owned detail.** Depends on 3–4 for enclosed volumes and roof intersections; thin/open assemblies can proceed after the placement contract is stable. Use own walls, openings, roof and materials; remove proxy suppression based on coincidental lengths.
6. **Correct rendering and annotation independently of measurement.** Depends on 4–5 for final geometry. Opaque structural material behavior can be corrected independently after its source audit, but dimensions, closure removal, contact shadows, selection, and snapping must be checked against the final spatial model.
7. **Gate rollout with shape-based tests and real-record regression checks.** Begin the tests in 1 and extend at every stage; final acceptance depends on 2–6. Assert topology, contact, dimensional fidelity, no below-grade placement unless supplied, identifier-renaming invariance, collection-order invariance, and understandable missing-data states. Include multiple camera views and both original and prepared inputs. A screenshot or retained-ID count alone is insufficient.

Do not start by changing a particular project's roof pitch, moving one attachment, renaming face IDs to influence placement, or stretching one wall. Those changes would preserve the assumptions responsible for failures on the next unseen house.