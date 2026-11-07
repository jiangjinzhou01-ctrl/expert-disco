# THRESHOLD V0.2.1 — INVERT Spatial Proof
**Architectural / Gameplay Spatial Design Freeze · Rev 1.0 · 2026-11-07**

> Status: design-locked coordinate specification, not yet validated in a real Three.js/Rapier build. Coordinates are in INVERT-local metres. The authoritative numeric data file is `invert_spatial_manifest.json`; drawings 01–03 are visual explanations of the same geometry. Do not confuse image-generation concept art with a verified 3D scene.

## A. Axes and physical conventions
- Right-hand world; X right, Y up, +Z toward the entrance; exploration primarily moves toward -Z.
- Player coordinates in this specification are **support-contact foot points**, not Rapier rigid-body translations. Original G0 PlayerState.position represents capsule centre: `bodyCenter = foot + 0.87 * localUp` (capsule total height 1.74m). Camera position: `eye = foot + 1.55 * localUp`. Radius 0.30m.
- INVERT logical shell: X=[-15,+15], Z=[-19,+19], main Y=[0,22]. One optional **non-walkable** lower void extends to Y=-7.
- Portal INVERT side: door plane center (0,2.8,+18.2), actual clear aperture width 3.6m, height 5.6m, threshold bottom Y=0; world-facing front normal = (0,0,-1), yaw=π. G0 front-door convention is local +Z; this means portal transform mapping must use pose rotation, not be inferred from visuals.
- Previous architectural frame was 8m tall and centred at Y=4.0, **but the physical portal aperture is separately centred at Y=2.8**. Do not set aperture center to Y=4, or an unintended 1.2m sill is created.
- Portal safe zone and entrance corridor remain under normal gravity (0,-9.81,0); gravity reorientation begins only within the dedicated arc enclosure.

## B. Geometry atlas (fixed baseline)
| ID | Bounds or geometric anchors (m) | Role / constraint |
|---|---|---|
| I-ENV | X[-15,15], Y[0,22], Z[-19,19] | Main architectural envelope |
| I-POR | center (0,2.8,+18.2), 3.6w × 5.6h | Bidirectional G0 transfer plane |
| I-ENT | X[-3,3], Y[0,7.5], Z[+7,+18.2] | Portal exit + compressed arrival |
| I-HALL | X[-10,12], Y[0,18], Z[-5,+7] | Shows an orthogonally moving monolith |
| I-FLOOR | X around [0,1.5], Y=0, Z[-9,-4] | Safe approach to gravity arc |
| I-ARC | x=1.5+3.2sinθ, y=3.2(1-cosθ), Z[-9,-5], θ∈[0,π/2] | Physical quarter-circle foot surface |
| I-WALL | X=4.7, Y[0.4,6.0], Z[-17,-5] | Local-gravity supporting wall; use narrower Y limits at arc seam |
| I-VOID | X[-13,-5], Y[-7,0], Z[-17,-2] | Non-walkable dramatic depth; guarded from the accessible floor |
| I-ORIGINAL-A | X[-12,11], Y[9.5,10.5], Z[-13.5,-10.9] | Cross-axis horizontal cantilever at original world-up |
| I-ORIGINAL-B | X[-11,-9], Y[2,20], Z[-15,+4] | Original-world vertical pier mass |
| I-ANOMALY | X[6.4,9.6], Y[3.2,5.0], Z[-0.3,+1.5] | Restricted witness object area, gravity +X |
| I-END | foot (4.7,3.2,-16.5) | Terminal stop and reverse journey |

The shell itself must be modelled with architectural voids, ledges and seams; these bounds are not instructions to instantiate one large solid box. Cross-axis structures remain aligned to original world X/Y/Z while the player rotates.

## C. Gravity curve and supporting contact
Define R=3.2m and θ measured from the normal floor toward the side-wall support:

- Foot contact: `p(θ,z) = (1.5 + R sin θ, R(1 − cos θ), z)` where `z∈[-9,-5]`.
- Tangent of travel on arc: `t(θ)=(cos θ,sin θ,0)`.
- Local up/contact normal: `u(θ)=(-sin θ, cos θ, 0)`.
- Designed local gravity: `g(θ)=−9.81 u(θ)=9.81(sin θ,−cos θ,0)`.
- Capsule centre: `c(θ,z)=p(θ,z)+0.87u(θ)`.
- Eye: `e(θ,z)=p(θ,z)+1.55u(θ)`.
- Arc length: `Rπ/2 ≈ 5.027m`. Start: foot (1.5,0,-7); endpoint: foot (4.7,3.2,-7).
- To infer angle from foot contact, use `θ = atan2(x−1.5, 3.2−y)` clamped to [0,π/2] **only when** a valid raycast/contact shows the player is on the arc and within the Z enclosure. Do not infer it from camera location.
- The visual floor and collision mesh must be derived from the same parameter mesh. Initial collision tessellation ≥48 angular segments; evaluate contact jitter and capsule corner clearance in engine.
- The arc is 0.55m thick toward the local gravity side; geometry is a static mesh with collision surface on the inside of the quarter circle. At start, it connects to the horizontal floor; at end, to wall X=4.7. No seam gaps or duplicate overlapping support colliders.
- Progress must result from actual input-driven character movement along the tangent of the contact surface; do not secretly move the camera along a scripted spline regardless of collisions.

## D. Reverse-able movement path
All waypoint values below are **foot contact points**, not character centres:

| Step | Foot (X,Y,Z)m | Up | Physical action |
|---|---|---|---|
| P0 | (0,0,+15.2) | +Y | Arrive safely from portal, face -Z |
| P1 | (0,0,+8) | +Y | Move through normal entry |
| P2 | (0,0,-4) | +Y | See sideways-falling object, turn toward +X |
| P3 | (1.5,0,-7) | +Y | Enter the first tangent of the real arc |
| P4 | (4.7,3.2,-7) | -X | Exit quarter-circle on wall, steer toward -Z |
| P5 | (4.7,3.2,-12) | -X | View original gravity architecture sideways |
| P6 | (4.7,3.2,-16.5) | -X | Activate terminal then physically retrace path |

Full route is P0→P1→P2→P3→arc P4→P5→P6, with the same traversable geometry permitting P6→P0. No teleport between the arc and wall. Player can pause and look around at any position.

**Arc seam restriction:** within the arc Z range [-9,-5], the side wall's immediately traversable landing width begins at Y≈3.2 and extends toward Y=6.0; the curved surface occupies the lower area. Once the player proceeds beyond Z<-9, the wall opens to Y[0.4,6.0]. Physical guiderails and sloped enclosure prevent falling into obstructed seam regions; these are intentionally geometric, not invisible blocking walls in midair. Geometry modelling and real overlap queries must validate the seam.

## E. Reference viewpoints (same continuous route)
Three genuine user-reachable positions, no detached showcase cameras:

| Shot | Foot point | Eye / camera world-local position | Local up | Look-at target |
|---|---|---|---|---|
| C1 Pre-arc | (0,0,-4) | (0,1.55,-4) | (0,1,0) | (4.7,3.2,-7) |
| C2 At 45° | (3.7627,0.9373,-7) | (2.6667,2.0333,-7) | (-.7071,+.7071,0) | (3.7,4.8,-12) |
| C3 On wall | (4.7,3.2,-12) | (3.15,3.2,-12) | (-1,0,0) | (0.5,7.8,-17.5) |

C1 should read a *physical bend* ahead; C2 reads both original-world vertical lines and rotated user up; C3 reveals the same cross-axis cantilever now reinterpreted sideways, while the navigable wall remains consistent. No rendering trick may rotate the background world to fake the effect.

## F. Collision groups, recovery, and motion controls
- `STATIC_ARCH`: building floors, piers, guard edges, portal jambs and lower void barriers.
- `GRAVITY_ARC`: tessellated static quarter-circle; derived from exactly the same geometry parameters as the render mesh.
- `WALL_SUPPORT`: static colliders at X=4.7 with user-relative guards, separate from non-walkable original-axis cantilever.
- `TRIGGER_ARC`: contact-aware state transition NORMAL↔ARC↔WALL; spatial hysteresis prevents gravity flicker near the seams.
- `DYNAMIC_WITNESS`: one small test rigidbody in an isolated area under sideways gravity, never allowed to cross the player's path or portal.
- `PORTAL_SAFE`: source G0 doorway & its colliders and teleport validation; normal gravity only.
- `RESET_CHECKPOINT`: P0, P3, P4, P6 safe contact poses; restore full position, local-up, velocity and gravity state.

The current G0 `PhysicsRuntime` locks rigid-body rotation and `PlayerController` hardcodes gravity in the world -Y direction. Both constraints must be explicitly changed when gravity rotation is implemented. Rapier's character controller supports a configurable up vector but does not itself perform a rotational sweep or body rotation; manual capsule-rotation collision checks are required. Avoid using a 'camera-only' roll. Preserve G0 portal math and reverse transfer tests.

## G. Art direction and witness objects
- Retain architectural mineral concrete, basalt, restrained natural light, but **remove snow landscape and avoid golden hotel-style rails** from earlier concept art.
- The primary contrast is **physical**: the static cantilever at Y≈9.5 remains world-horizontal, the vertical pier stays world-Y aligned, and the player's up turns from world +Y to world -X.
- At C3, show at least one world-Y plumb element and one world-X-span cross slab; their differing orientation in player space must be obvious. No artificial tilted overlays or screen-space rotation tricks.
- Keep navigable path broad and legible: dynamic witness object falls toward +X behind protected architectural glass or an inaccessible recess.

## H. Acceptance before asset production
1. Numerical arc mesh and wall support share a continuous boundary at X=4.7,Y=3.2.
2. Capsule centre and eye follow the given local-up offsets; change from normal to wall changes the body's actual collider orientation.
3. Six route waypoint contacts are actually reachable, and route reversal is possible without teleport or high jump.
4. Curved collision surface can be traversed slowly and quickly, stopping and reversing at θ=0°,45°,90° without penetrating meshes.
5. At C3, camera up is world -X but original cantilever and vertical pier keep original transforms; screenshot shows real contradictory orientation.
6. Portal room remains under normal -Y gravity; repeated crossings preserve G0 correctness.
7. Android dual-touch input stays usable in the arc; reduced-motion mode changes camera presentation only, not physical rules.
8. Runtime tests must confirm collision contacts, orientation/overlap checks and performance, not just a cinematic image.

**Design freeze:** geometry placement, local axis and physical relations are fixed for a first playable INVERT slice. This does NOT imply in-engine validation, performance certification, or final authored material quality.
