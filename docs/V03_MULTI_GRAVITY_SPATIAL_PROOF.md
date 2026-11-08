# V0.3 Multi-Gravity Spatial Proof — D1 candidate

**Status: analytical candidate, not frozen and not a finished in-engine collision proof.** Source baseline: 0a307c666006f11cd66879153f97a9aa1283650b. All coordinates below are room-local metres; INVERT global positions add (100,0,0).

The source audit uses the actual 285 box descriptors: VESTIBULE has 135, bounds X[-17,17], Y[-4.48,24.3], Z[-22,36.8]; INVERT has 150, bounds X[-16,16], Y[-7.6,22.3], Z[-20,19.1]. Those are collision-box bounds, not a complete final mesh-occupancy proof.

The input baseline is preserved in v03-spatial/Gravity_Freedom_Design_Baseline.md. Full coordinates, node vectors, camera matrices and numerical results are in v03-spatial/spatial-proof-D1.json. Coordinate projection diagram: v03-spatial/spatial-layout-D1.svg.

## Candidate placement

| Region | Proposed local placement | Required connection work |
| --- | --- | --- |
| A / G01–G02 | VESTIBULE ring centre (34,4.5,0), supporting radius 4.5m; outer shell X[29.1,38.9], Y[-.4,9.4], Z[-1.9,1.9] | Real opening through east wall X[16,17], Y[0,3.2], Z[-1.6,1.6]; new floor and entry apron |
| B / G03 | Original CR1 radius 3.2m at Z[-9,-5] | Preserve P0–P6, P4A, support solid, framing and end cap |
| B / G04 | Branch starts at wall (4.7,6.2,-12.5); radius 5.4m to upper foot (10.1,11.6,-12.5) | Rebuild a welded support collar and upper guard opening Z[-14.1,-10.9]; centreline Y=4 remains clear |
| B / G05–G06 | External radial ring centre (25,5.8,8.5), supporting radius 5.8m; outer convex face | Upper deck and real east-shell opening; top foot joins at (25,11.6,8.5) |
| C / G07–G08 | XY inner ring centre (39,5,9), radius 5m; shell X[33.65,44.35], Y[-.35,10.35], Z[7.2,10.8] | Ground corridor outside the INVERT shell; actual side/entry port |
| C / G09–G10 | YZ closed spiral centred (52,5.2,9); r=5.2+.30(1-cos angle) | Separate side port and access corridor; exact normal follows derivative, not radial approximation |
| D / G11–G12 | Enclosed module X[60,86], Y[0,14], Z[3,22] | Low-g lane, free-flight cell, reattachment buffer and parallel return corridor |

This is spatial reservation data. It must not be converted directly into twelve isolated boxes or false entrances. Entry collars and detachment aprons still require their own shared visual/collision assets.

## Capsule envelope and calculations

Standing capsule: radius .30m, half-segment .57m. Centre is foot+.87up; axis endpoints are centre±.57up. Exact AABB half-extents are .30+.57×abs(axis component). Prone uses radius .26m and half-segment .365m; it is oriented horizontally in the local gravity frame.

The analytical script samples the proposed B branch/deck/exterior ring at 2756 poses and computes capsule-segment distance to all unmodified existing box colliders. It reports zero intersections after excluding explicitly planned wall/guard edits. Nearest retained box clearances are about .55m to lower handrail, .56m to lower parapet and .80m to the original-axis cantilever.

**This result excludes the old support trimesh and the new support collar.** It is therefore insufficient to certify the branch seam. The exact edited support mesh, intermediate posture sweeps, guard opening and normal handoff must pass Rapier before this region can be frozen or constructed as a finished route.

A 3.2m ribbon width gives 1.3m lateral centreline clearance per side for a standing .3m-radius capsule. On the inner 4.5m ring, the standing head reaches radius about 2.76m; a central prop is limited to radius 1.8m in this candidate. Those are nominal clearances, not substitutes for mesh queries.

## Topology and proof gaps

A: main hall → real side port → entry apron → reversible inner gravity ring → main hall.

B: P0 → original CR1 arc → P4A → P5/P6 → return to branch bay near Z=-12.5 → upper connector → exterior gravity ring → return through continuous support. P6 remains a safe terminal spur; its end cap is retained.

C: central hub → east-shell port → cross-axis ring and orthogonal spiral galleries → shared floor gallery → hub.

D: hub → low-g lane → freely navigable zero-g cell → reattachment buffer → separate return lane → hub.

The initial D1 centreline drawing is not sufficient to certify ring entry/exit choice or the four route cycles. In particular, a floor corridor cannot be routed through a ring shell simply because their AABBs overlap at a tangent point. Detailed side-entry collars, real apertures, connection geometry and uninterrupted forward/reverse input tests remain required. These are open engineering gates, not silently accepted coordinates.

## Camera projections

A_RING_VIEW: eye (24,1.55,6), target (34,4.5,0), up +Y, vFOV50°, aspect16:9. Ring top projects to NDC approximately (0,.712), left (-.337,.245), right (.177,-.129).

B_AXIS_VIEW: eye (25,10.05,33), target (43,11,20). This requires a reachable observation ramp/landing. The fixed X girder, Y mast and Z beam representative points project inside the viewport; complete row-major view/projection matrices are in the JSON.

The calculations establish frustum coordinates only. They do not establish rendered first-hit visibility, frame quality or acceptable controls. Original C1/C2/C3 views still require rendered regression after new assets are actually registered.

## Reproduction

From the repository root, with Python 3, numpy and matplotlib installed:

    python3 scripts/v03/spatial-proof.py

Generated numerical output and diagrams go to evidence/v03/spatial-proof/. The generator records the actual source revision and input hashes. The fixed D1 JSON retains the original baseline revision.

**Freeze decision: NOT PASSED.** Build and certify the junction/support assets and reversible routes before calling the twelve-node spatial arrangement frozen.
