# THRESHOLD V0.2.1 / INVERT — SPATIAL CONFLICT REVIEW CR1

**Status:** corrected design proposal with analytical calculations; NOT a Three.js/Rapier collision, visibility, or frame-rate certification. 2026-11-07. Original frozen V0.2.1 materials remain unchanged; this patch supersedes conflicting fields only.

## Priority findings and exact corrections

| ID | Severity | V0.2.1 issue | CR1 correction |
|---|---|---|---|
| C-01 | BLOCKER | Arc exit P4=(4.7,3.2,-7) immediately turns to -Z directly at support surface join; risk of corner contact and duplicate supporting colliders | Add P4A=(4.7,4.0,-7), 0.8m continuation along wall tangent +Y before -Z travel; arc and wall support generated as one collision contact surface at seam |
| C-02 | BLOCKER | Side enclosure at z=-5 and z=-9 unspecified: opaque guard can block C1/C2 and entry/exit | Explicit glazed sight openings and *actual clear walk-through apertures* defined below; glass is visibly solid collision barrier, not invisible walls |
| C-03 | HIGH | C1=(0,1.55,-4), aim (4.7,3.2,-7): arc start normalized vertical screen y≈-2.13, out of frame | C1 eye=(0,1.55,-2), aim=(3,1,-7), up=(0,1,0), vFOV50° |
| C-04 | HIGH | Old distant pier and upper slab lie largely outside C3 proof shot | Move slab and pier as new mutually anchoring structural pieces; C3 updated, screen coordinates checked |
| C-05 | HIGH | End P6 at z=-16.5 only 0.5m from wall edge z=-17 | Extend wall to z=-18.2; end guard at -18.2. P6 remains z=-16.5, centre-to-guard distance 1.7m; capsule 0.3m outer radius leaves 1.4m. |
| C-06 | HIGH | Wall y[0.4,6] at arc z extent can duplicate/cross physical curved support | Wall y[3.2,7.2]; unify arc and wall collision geometry; physical guards after transition, no overlapping duplicate support colliders. |
| C-07 | MEDIUM | Camera 45° aiming toward z=-12 can be blocked by rear guard | Set C2 eye=(2.6667,2.0333,-7), up=(-.7071,.7071,0), aim=(0,7.8,-14.5). Rays to slab & pier cross rear glass. |
| C-08 | MEDIUM | Mobile joystick can lead diagonally off arc edge or into same seam | 4m wide guarded arc, 3.4m min capsule centre Z span; true wall landing P4A and physical framed gate, no forced camera movement. |

## Fixed geometry retained

- Coordinates: INVERT local metres, right handed, world +Y up, exploration -Z.
- Portal centre (0,2.8,+18.2), forward front normal -Z, actual passage 3.6 × 5.6m, world gravity -Y near portal.
- Arc radius R=3.2m, centre in XY at (1.5,3.2), z∈[-9,-5]. Foot (x,y,z)=(1.5+3.2 sinθ, 3.2(1-cosθ), z), θ∈[0,π/2]. Local up (-sinθ,cosθ,0), gravity = -9.81·up.
- Capsule radius0.30m total height1.74m, foot-to-centre0.87m, foot-to-eye1.55m. Capsule orientation rotates physically; cannot use camera-roll-only imitation.

## Revised route (foot-contact points)

| Marker | X | Y | Z | Role |
|---|---:|---:|---:|---|
| P0 | 0 | 0 | +15.2 | Exit portal, -Y gravity |
| P1 | 0 | 0 | +8 | Entry corridor |
| P2 | 0 | 0 | -4 | Look at arc and turn +X |
| P3 | 1.5 | 0 | -7 | Enter genuine arc, gravity 0° |
| P4 | 4.7 | 3.2 | -7 | Arc reaches 90°, **not yet safe turn point** |
| P4A | 4.7 | 4.0 | -7 | Input-driven wall tangent landing +0.8m; safe turn towards -Z |
| P5 | 4.7 | 4.0 | -12 | New world-axis witness view |
| P6 | 4.7 | 4.0 | -16.5 | Recessed terminal; return along same surfaces |

Total ideal centreline walking distance ≈37.9m, not including user detours. Player must also be able to stop/reverse at any theta.

## Arc enclosure, sight apertures, guards

**At z=-5 (front side of arc):**
- Actual entry opening x[-0.5,1.55], y[0,2.6]. Route crosses at approximately (0.5,0,-5); capsule can fit.
- Separate glass observation area x[1.75,3.85], y[0.65,4.6]. It is transparent but physically solid with an explicit frame and collision. C1 rays toward arc midpoint and top end pass through glazing; toward arc start pass via entry void. Do not leave the entire side unguarded.

**At z=-9 (rear side of arc):**
- Transparent physically solid witness window x[0.6,2.45], y[2.5,7.3], framed in original-world architecture.
- Real wall-walk exit opening x[2.6,4.7], y[3.4,6.8]. Only player after stabilising at P4A fits and walks through.
- Solid mullion separates witness window and pass aperture. Avoid a thin fragile collider edge; provide real frame depth and sweeps.

**Wall support:** surface X=4.7, Y[3.2,7.2], Z[-18.2,-5], solid thickness towards +X. Under arc Z[-9,-5], wall starts at arc endpoint Y=3.2; no wall surface below arc endpoint. Use single contiguous support mesh/collider along arc end. Once out of rear gate, keep architectural side rails around Y=3.05 and Y=7.35, extending toward player -X; far end cap z=-18.2 is fully closed. No invisible walls away from modelled architecture.

## Cross-axis architectural witnesses (updated AABBs)

- Original axis cantilever: X[-12,+9], Y[7.6,8.4], Z[-15.3,-13.6]. Still world-horizontal; fixed geometry.
- Original axis pier: X[-0.3,+1.0], Y[0,20], Z[-15.4,-13.8]. Still world-vertical; anchored at ground.
- Right support anchor: X[8.6,9.8], Y[0,9], Z[-15.4,-13.5]. Supports slab on far side.
- Slab/pier/right-anchor volumes overlap **intentionally** at support joints; visual meshes must have credible junctions and no coplanar z-fighting.
- Old lower void X[-13,-5], Y[-7,0], Z[-17,-2] and anomalous object X[6.4,9.6] stay separate. They do not intersect the specified player route.

**Conservative straight wall player capsule AABB at P5:** x[2.96,4.7], y[3.7,4.3], z[-12.3,-11.7]. Approximate lower bounds to pier x≤1.0 gives 1.96m X gap, slab y≥7.6 gives 3.3m Y gap, anomaly x≥6.4 gives 1.7m X gap. Not a replacement for exact shape queries.

## Camera proofs — 50° vFOV, 16:9 aspect

| Camera | Foot position | Eye position | Up | Look-at |
|---|---|---|---|---|
| C1 | (0,0,-2) | (0,1.55,-2) | (0,1,0) | (3,1,-7) |
| C2 | (3.7627,0.9373,-7) | (2.6667,2.0333,-7) | (-.7071,.7071,0) | (0,7.8,-14.5) |
| C3 | (4.7,4,-12) | (3.15,4,-12) | (-1,0,0) | (1.4,7,-18) |

Projection convention: centre (0,0), edges ±1. **Negative screen Y = lower screen.** Conservative representative points only, not full mesh visibility or occlusion certificate.

### Calculated normalized screen positions

**C1:** arc_start (-0.299,-0.442), depth 5.18m, arc_mid (+0.126,-0.009), depth 6.25m, arc_end (+0.270,+0.747), depth 6.52m.

**C2:** cross_slab (+0.121,-0.157), depth 9.58m, axis_pier (+0.044,-0.039), depth 9.89m.

**C3:** cross_slab (+0.689,+0.435), depth 4.34m, axis_pier (+0.633,+0.777), depth 4.64m.

**Sight aperture checks:** from C1, rays cross front z=-5 plane at arc start (0.90,0.62), midpoint (2.258,1.182), end (2.82,2.54). First is inside real entry; remaining are through the defined front window. From C2, rays cross rear z=-9 at slab (≈2.273,3.635), pier (≈2.05,3.64); both within rear glass window. Exact ray intersection against all final architecture must be tested in-engine.

## Swept capsule and numerical validation requirements

1. Arc/ground at θ0 and arc/wall at θ90 must be tangent-continuous; no duplicate coplanar physical walls or gaps. Visual and collider sampling share source vertices.
2. For 64 angular tessellation segments, chord sagitta ≈0.24mm; that only bounds geometric approximation, **not** solver error or ability to smoothly traverse. Report actual engine contact stability.
3. Validate capsule against neighbouring side walls and frames at θ in {0,5,15,30,45,60,75,85,90}°, also each direction of motion, stop, reverse, and oblique joystick input. Perform position and orientation shape sweeps; camera-only motion is forbidden.
4. Contact angle from true valid raycast/closest support, never camera position. Support normal threshold≥0.995 in steady state, and a separately handled transient tolerance such as 0.98 during handoff (numbers are initial design criteria).
5. Player capsule must safely fit in rear doorway at P4A: capsule bbox x[2.96,4.7], y[3.7,4.3], opening x[2.6,4.7], y[3.4,6.8]. Effective X support face at 4.7 is intentionally in contact with the capsule, not counted as blocking architecture.
6. At P6 z=-16.5 the end cap is z=-18.2: centre 1.7m from barrier and conservative outer radius clearance 1.4m.
7. Real engine tests must verify 30 reversible arc runs, 100 repeat wall-route traversals, blocked invalid paths, no stuck state and full-body rotation, not only screenshot quality.
8. On 19.5:9 and 20:9 Android landscape, keep arc and witnesses outside 10% screen edge UI protection zones where feasible; default look must be manually overridable. Reduce-motion mode changes camera roll interpolation, not gravity or support contact.
9. Original G0 portal mapping, reverse crossing, exit-overlap safety and -Y entrance gravity must remain stable and regression-tested.

## Gate decisions

**Analytical design gate:** Revised coordinates, P4A, doorway envelopes, structural witness projections, and large AABB route separation are internally coherent.

**Blocked from final engine/art freeze until:** (a) running character capsule sweep verifies all seams; (b) rendered raycasts from C1/C2/C3 verify non-occlusion by actual meshes; (c) automated reversible movement proves support and gravity continuous; (d) mobile controls, reduced-motion and GPU performance receive real-device tests.

If a physical engine conflict is found, use minimum-coordinate corrections with documented before/after diagrams; do not solve by replacing motion with teleportation, scripted camera-only rotation or invisible walls.
