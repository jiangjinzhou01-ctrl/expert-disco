# Orbital revision — source research and implementation boundaries

Research performed against public primary sources on 2026-11-07. These are engineering references, not evidence that this project has the same capabilities or performance as the referenced engines. No new streaming library was installed by this research task.

## What the requested optimization means

| Technique | Work it saves | What it does not do |
| --- | --- | --- |
| Frustum culling | Omits draw submission for geometry outside a camera's view | Does not prevent network downloads or reclaim GPU allocations by itself |
| Spatial streaming | Defers detailed asset requests/decoding until a region is relevant | Requires explicit asynchronous loading, fallback geometry, and a memory lifecycle |
| LOD | Displays a cheaper representation when fine detail is unnecessary | A scene can still download and retain every LOD at startup |
| Occlusion culling | Avoids drawing geometry hidden behind opaque surfaces | A frustum test alone cannot establish occlusion |
| Batching/instancing | Reduces repeated CPU submissions and shared geometry cost | Does not automatically decide which world regions to load |

The orbital revision uses a small authored chunk manifest rather than a planetary 3D Tiles dataset. Always-resident structural geometry and physical collision remain available; optional detailed architecture can be requested independently. Proxy geometry remains valid while detail is unavailable. A fast 180° turn must never reveal absent floors or an unguarded collision boundary.

The interest set must include **both the player camera and the visible portal's mapped destination camera**. Loading only the room containing the player would remove precisely the destination geometry the portal needs to display. Nearby destination regions may be prefetched before transfer. Asynchronous visual refinement must never mutate character world ownership or the portal transfer transaction.

## Verified GitHub references

### Three.js — LOD and conservative visibility

Repository snapshot inspected: `f2b6a71bdd088d9da387fcc62802323341099b92` (`dev` at research time).

- [Official LOD example](https://github.com/mrdoob/three.js/blob/f2b6a71bdd088d9da387fcc62802323341099b92/examples/webgl_lod.html): demonstrates `LOD.addLevel(mesh, distance)`. The example constructs its levels in advance; it is a reference for representation selection, not proof of deferred network loading.
- [Frustum implementation](https://github.com/mrdoob/three.js/blob/f2b6a71bdd088d9da387fcc62802323341099b92/src/math/Frustum.js): `setFromProjectionMatrix` and `intersectsBox` provide conservative camera visibility. Conservative false positives are acceptable; missing visible geometry is not.
- [License](https://github.com/mrdoob/three.js/blob/f2b6a71bdd088d9da387fcc62802323341099b92/LICENSE): MIT. The installed application dependency is pinned separately in `package-lock.json`; current upstream examples are not used to replace its render scheduling.

The installed Three.js 0.187.0 source was also inspected for these actual APIs. Existing React Three Fiber scheduling remains the single core render/simulation loop.

### NASA AMMOS — bounded refinement and lifecycle

Repository snapshot inspected: `30889c190c051d7a278027d5818e7d2dd6b70a6f`.

- [Project README at inspected revision](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/30889c190c051d7a278027d5818e7d2dd6b70a6f/README.md): distinguishes multiple rendering integrations and warns that cache caps can stop refinement, leaving coarser representations visible.
- [PriorityQueue](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/30889c190c051d7a278027d5818e7d2dd6b70a6f/src/core/renderer/utilities/PriorityQueue.js): bounds concurrent work and sorts queued jobs by an explicit comparator.
- [LRUCache](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/30889c190c051d7a278027d5818e7d2dd6b70a6f/src/core/renderer/utilities/LRUCache.js): tracks use, item count, byte estimates, and cleanup callbacks for eviction.
- [TilesRendererBase](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/30889c190c051d7a278027d5818e7d2dd6b70a6f/src/core/renderer/tiles/TilesRendererBase.js): separates queued/loading/parsing/loaded states and prioritizes refinement using actual traversal information.
- [License](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/30889c190c051d7a278027d5818e7d2dd6b70a6f/LICENSE): Apache 2.0, California Institute of Technology.

THRESHOLD borrows the design principles—bounded concurrent work, visible/nearby priority, explicit lifecycle, coarse fallback, and unused-content eviction. It does not import the renderer, claim 3D Tiles support, or copy NASA datasets. Public code availability also does not license unrelated data or third-party models.

## Validation required for THRESHOLD

1. Record actual detailed GLB requests; prove at least one irrelevant region is deferred.
2. Delay a needed GLB and verify its proxy remains present while loading.
3. Rotate the camera, update the same runtime, and verify that the relevant detail is eventually loaded without losing proxy coverage.
4. Look through the portal and verify destination interest before the player's world ID changes.
5. Move far enough to exercise explicit eviction; count actual disposal, not only `visible=false`.
6. Confirm that a request failure is recorded and recoverable without corrupting physics.
7. Measure on real hardware. SwiftShader timings are useful for regression/debugging but cannot certify desktop or mobile GPU targets.

These checks are reported separately from the existing portal mathematics and gravity integration tests. A passed frustum unit test alone does not establish all of the above.
