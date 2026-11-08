# THRESHOLD — Orbital revision

This revision upgrades the existing V0.2 chapter. It preserves the two independent Three.js worlds, reversible portal mapping and physically rotated capsule. It is an implemented interactive chapter; the label “commercial quality” remains a design/validation target, not an assertion established by screenshots or software rendering.

## Implemented experience

- Original Blender-authored transfer capsule with open-bottom ribs, glazing, fasteners, conduits, service panels and sealed rear airlock. The original corridor guards remain physically active, with visible replacement glass and construction at those boundaries.
- Ten independently requested architectural cells: capsule, arrival, galleries, gate, roof trusses, two exterior orbital structures and two INVERT detail regions. A permanent pressure envelope replaces opaque side/front walls while preserving the portal's clear aperture.
- Eleven actual spherical celestial bodies, including a textured ringed hero planet, three middle-distance bodies, seven distant bodies and 1,900 seeded stars. Planet rotation, day/night shading, atmospheric rim and ring shadows are computed in the real scene and remain available through the portal.
- Shared photogrammetric concrete, brushed metal and patinated copper materials. Existing exact collision support geometry and original-axis architectural witnesses are retained.
- A real observatory information panel; a sample-release action that resets the existing Rapier body and lets its actual local force move it; animated resonance rings on return.
- Velocity-based touch turning, independent movement/look pointer IDs, no camera inertia after release, saved sensitivity/acceleration/inversion, quality, field of view, volume and comfort preferences.
- Highest configured quality preset on desktop and mobile, DPR capped at 2 for that preset; no device-class-based automatic downgrade. Lower quality remains an explicit saved choice.
- Independently closable diagnostic panel, F3/Esc, help/about, active touch-stick feedback, photography mode with actual canvas PNG export, safe UI/input transitions and versioned local checkpoints.
- Gesture-unlocked original procedural Web Audio: machinery/air bed, spatial portal tone, material footsteps and deduplicated transfer/terminal/return cues. No remote music or autoplay dependency.

## Loading and resource ownership

The custom manager follows primary Three.js and NASA AMMOS references documented in [ORBITAL_REFERENCES.md](ORBITAL_REFERENCES.md). It implements actual deferred requests, rather than merely hiding already downloaded meshes.

The camera-interest set contains the player frustum plus the mapped destination frustum when the door is visible. The latter is cropped to the projected doorway rectangle and respects the exit side. High-detail cells are prioritized by distance, with two concurrent requests. A coarse authored silhouette remains visible while a request is pending or fails. Near cells are prefetched to support a rapid turn. Unneeded detail is retained for six seconds before disposal, with a seven-cell soft cache target. Visible required content is not removed to fabricate smaller statistics.

Structural floors, safety guards, small interface artifacts and physical collision are permanent. The base architecture is batched by material and spatial cell so Three.js frustum culling remains useful. This implementation does not claim hardware occlusion queries, terrain-scale 3D Tiles, or perfect knowledge of visibility behind every opaque wall. Browser HTTP cache may retain downloaded bytes after GPU geometry is released.

The R3F `useFrame(..., 1)` owner remains the only core loop. It advances fixed 60 Hz simulation, commits the player, updates visual state and streaming interest, prepares changed static shadows, renders at most one portal target pass, then the main view. Asset promises never change player world membership.

## Actual asset measurements

| Asset group | Measurement |
| --- | ---: |
| Detailed architecture | 10 cells, 224,712 triangles |
| Original uncompressed detailed GLBs | 14,750,964 bytes |
| Meshopt detailed GLBs | 6,882,984 bytes; 53.34% smaller |
| Maximum decoded world-bound error | 0.0002641 m |
| All detailed architectural cells visible together | 41 authored material draws before view culling |
| Permanent pressure envelope | 1,584 triangles, four material batches |
| Planet/ring maps | 2,258,031 bytes; five locally hosted source maps |
| PBR JPEG source/fallback | 1,783,030 bytes; nine 1024² images |
| PBR UASTC KTX2 | 6,714,783 bytes; nine textures, 11 mip levels each |
| Local Basis decoder | 584,862 bytes of JS/WASM, licenses bundled |
| Actual Chromium BC7 mip payload | 12,583,152 bytes |
| Equivalent RGBA8 mip payload estimate | 50,331,636 bytes |

The UASTC files are larger over the network than JPEG. Their benefit is a GPU-supported compressed payload and precomputed mip chain. The 75% payload reduction above is measured transcode data versus a calculated RGBA8 equivalent; it is not a driver VRAM measurement. A failed KTX2 request falls back to a local JPEG and is reported in diagnostics. Planet textures currently remain JPEG/PNG.

## Validation record

Actual command output is kept in `evidence/orbital/`; historical V0.2 logs are not reused as proof for this revision. The acceptance table is [ORBITAL_ACCEPTANCE.md](ORBITAL_ACCEPTANCE.md). Final test counts and browser results are populated only after execution.

Real browser art captures: `CAPSULE.png`, `ARRIVAL.png`, `CROSSING.png`, `C3.png`, with runtime snapshots in `art-capture.json`. The encoder/decode record is `ktx2-browser.json`. Source validation covers all ten compressed GLBs, source hashes, preserved normals/UVs and real decoded bounds; pressure-glazing and capsule clearance checks are also retained in the source reports.

## Reproducible asset work

```sh
npm ci
npm run assets:orbital
python3 scripts/fetch-orbital-materials.py
python3 scripts/compress-orbital-textures.py --help
python3 scripts/fetch-space-assets.py
npm run capture:orbital
```

Blender and the pinned Khronos encoder are authoring tools, not runtime requirements. The committed deployable assets allow normal `npm ci && npm run build` without those tools or remote asset services. All external imagery is locally hosted with provenance and licenses; see material/space source reports and the in-app credits.

## Remaining verification

There is no attached physical Android/iPhone or representative desktop GPU. Real-device frame time, touch feel, browser-specific behavior and a ten-minute thermal run remain BLOCKED. The executable entry, operator sequence and collection limitations are documented in [DEVICE_TEST_ORBITAL.md](DEVICE_TEST_ORBITAL.md). SwiftShader timings must never be presented as phone results. The project has no blanket promise of maximum-quality 60 FPS on every device.

The art is an original real-time architectural exhibit with selected authored assets and static shadow baking. It does not include a full offline GI bake or photorealistic cinematic rendering. It needs human art-direction and representative-device acceptance before being described as commercially qualified.

## Measured cloud software-renderer sample

Chromium 158.0.8127.18, Linux, ANGLE Vulkan SwiftShader, 640×360, DPR 1, highest preset. These short fixed-view samples include any outstanding driver work after scene preparation and do not certify sustained controls or physical-device performance.

| View | Actual seconds | Samples | FPS | P95 ms | P99 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| ARRIVAL | 15.01 | 33 | 2.190 | 2231.20 | 2290.40 |
| C3 | 15.01 | 18 | 1.215 | 2680.20 | 2680.20 |

This software environment misses the real-device design targets; those targets remain unverified. It must not be reported as mainstream desktop or Android performance. The actual payload reduction and deferred loading results are independently evidenced, rather than inferred from these frame rates.

## Environment and command outcome

Runtime/assets were frozen at source commit `61a1bf3`; subsequent changes correct regression expectations and software-renderer screenshot conditions, plus documentation/evidence. Local verification: TypeScript and ESLint passed, 91 unit/integration tests passed, all 34 distinct development-browser and three production-browser scenarios passed after the recorded corrections, build/root/repository-subpath checks passed. The exact intermediate command failures and targeted reruns are preserved in the acceptance record rather than rewritten into a green aggregate log.

The production keyboard recording contains 381.16 continuous seconds (31,123,692 bytes). It includes real input and rendering; simulation advances at a bounded fixed step on this slow software renderer, so video duration is not a real-device completion-time benchmark. Checkpoint recovery also passed in the normal production bundle with no mutation adapter.

Build still warns about the large Rapier-compatible embedded-WASM/shared engine chunk (about 5.29 MB raw / 1.92 MB gzip). The warning is retained; dependencies were not downgraded or replaced to silence it. Assets use actual Meshopt and KTX2 compression; no claim is made that JPEG file size measures GPU memory.
