# THRESHOLD / Atelier — actual implementation and verification

Visual implementation: **39b5d531e2b5f6d339129f794d282d5032534103**. Final resource-lifetime correction: **9abdcbd**; branch `feat/v03-art-direction`, based on the verified V0.3 movement checkpoint `952176f36b45185ea425e8c9b9f843c3ff22cb56`.

This is an implemented visual/product pass. It does not establish international AAA production quality, physical-device performance, or completion of G01–G12/four circuits. The original movement, gravity and portal systems remain active.

## Implemented result

- **Shared architectural finish library.** `src/engine/rendering/ArchitecturalFinish.ts` owns role definitions, metre-scale world-space joints, derivative antialiasing, shallow joint normals and bounded surface variation. `OrbitalMaterials.ts` supplies locally hosted albedo/roughness/OpenGL-normal maps to the source buildings, pressure envelope, proxies, loaded cells, furniture and instruments. The eight solid finish roles and glass/two emitter roles are explicit; dynamic state signals remain separately owned. The animated resonator clones its material so it cannot recolor every shared black fitting.
- **Lighting and tone.** `ArchitecturalLighting.ts` provides a static 2048² key shadow map and two bounded area emitters per world; a secondary unshadowed key/fill and shared prefiltered environment provide the remaining response. Standard PBR covers most structure. Machined metal/bronze and pressure glass use the more expensive physical BRDF. No transmission prepass is enabled. AgX tone mapping replaces the chapter's previous tone mapping. LAB keeps its controlled scene lighting and diagnostic colors.
- **Original, editable detail assets.** Six benches, two guide pylons, actual lettering and continuous curved bronze coping are generated in Blender from shared layout data. Three new cells reuse existing streaming, PBR maps and material batching. Furniture has permanent Rapier hulls and visible low-detail proxies. New fixtures sit outside the original protected round-trip route. The original CR1 support mesh is retained.
- **Complete interface treatment.** The tool rail, location heading, loading composition, settings/help/about panels, diagnostics, photography and five mobile action buttons share the new type/color/spacing system. Both typefaces are local and accompanied by OFL licenses. Paper panels improve reading contrast. Settings/help/about/photo pause simulation, clear input and restore its prior pause state on closing; diagnostics remain observational. The highest quality remains the initial default on every device.
- **Legacy LAB finish.** Real bevel geometry and the shared finish shader replace the Lambert-only room structure. Calibration marker materials and the actual portal geometry/crossing mechanism are retained. Pixel and crossing tests verify this change.

## Actual audit and asset measurements

The real-browser resident-scene audit found **176 mesh/material assignments**, **150 assignments using normal maps**, and **zero unclassified instances**. It covers source buildings and cells resident across ARRIVAL/C2/C3; the separate GLB inventory test validates material roles across all fifteen authored chapter/cell files. It is not a claim of inspecting unbuilt V0.3 rooms.

The UI test measured **12.7444:1** contrast for settings panel body text/background. This is a targeted measurement, not a complete accessibility certification. Controls were also checked for 44px targets and viewport containment. Maximum-size mobile controls were checked at 390×844, 320×740, 1170×540 and 1200×540 without overlapping the movement stick.

| New cell | Triangles | Raw GLB bytes | Deployed bytes | Maximum decoded bound error |
| --- | ---: | ---: | ---: | ---: |
| A-atelier-east | 17,628 | 1,132,200 | 354,328 | 0.000138658m |
| A-atelier-west | 17,628 | 1,132,156 | 354,436 | 0.000138658m |
| B-atelier-surface | 3,620 | 209,972 | 63,268 | 0.000092906m |
| Added total | **38,876** | **2,474,328** | **772,032** | No topology simplification |

There are now thirteen streaming cells totaling 263,588 triangles. The nine existing compressed PBR maps are reused; the new geometry does not add another photo-texture set. The area-light lookup textures have explicit shared ownership and disposal. Both focused LAB and chapter resource-lifecycle/context-restore reruns passed after the lookup-ownership correction. The complete 40-case regression subsequently passed, including these lifecycle checks.

Fixed-camera 1600×900/DPR1 browser captures: ARRIVAL previously used 90 main / 63 portal draws; this pass uses 95 / 60 at that same capture. This is a scene-work measurement, not an FPS benchmark. Captures are paused and streamed to completion for repeatable visual review. Sustained physical-GPU frame times were not measured.

## Environment

Linux x86_64 managed workspace; Node 24.22.1, npm 11.9.0; Blender **4.3.2**; Playwright Chromium **158.0.8127.18**, WebGL2 / ANGLE SwiftShader. Browser touch cases are emulation, including the existing native multi-contact tests, not actual Android/iPhone hardware.

Runtime dependencies remain pinned: React 19.3.1, R3F 9.8.2, Three 0.187.0, Rapier 0.21.0. Build/test versions remain Vite 8.3.6, TypeScript 6.0.3, Vitest 5.1.0 and Playwright 1.65.0. No new npm dependency is required.

## Commands and evidence

```sh
npm run assets:atelier
npm run typecheck
npm run lint
npm run test:unit
npx playwright test src/tests/e2e/atelier.spec.ts
npm run capture:atelier -- before
npm run capture:atelier -- after
npm run verify
```

The before capture was taken while runtime source still matched 952176f. The complete runtime verification uses 9abdcbd (the same rendering plus its resource-ownership correction). Source code remains frozen during the complete verification run.

| Verification | Current result |
| --- | --- |
| Asset generation and actual decoded Meshopt assertions | PASS |
| TypeScript / ESLint | PASS |
| Unit / physical integration | PASS: 115 tests / 23 files (17.88s in the final aggregate) |
| Focused new WebGL/UI tests | PASS: 2 tests |
| Focused maximum mobile-control layout test | PASS: 1 test |
| Full 40-case development browser regression | PASS: 40 tests, 25.3 minutes, no skips/flaky results |
| Ordinary production build and keyboard journey | PASS: 4 tests, 14.1 minutes; genuine chapter journey about 9.7 minutes |
| Production repository-subpath smoke | PASS: 73 successful responses, both local fonts HTTP 200, no mutation adapter |
| Physical-device performance and ten-minute thermal stability | BLOCKED / NOT RUN |

`npm run verify` completed with exit code 0. Raw combined output is in `evidence/atelier/verify-final.log`; individual unit/browser/production/subpath reports are archived beside it. The CI job ceiling was increased from 40 to 60 minutes because this measured SwiftShader aggregate takes roughly 41 minutes locally; assertions and failure behavior are unchanged. The YAML was parsed after that configuration-only change. GitHub Actions status is separate from these completed local results.

## Problems actually found and corrected

1. An initial icon map included a nonexistent `descend` action. The input protocol represents descent using the crouch control in zero-g. TypeScript caught the extra key; it was removed.
2. The two initially placed guide pylons intersected original side steps. The overlap test failed (113 pass / one fail). The pylons moved to Z=-12.8m and the real collision/route regression passed. The failed unit log/report is retained.
3. The first new browser case asserted an exact zero for cos(π/2). It received 6.123×10^-17, while the real wall pose was correct. Assertions now use a 1e-8 orientation tolerance. The initial failed browser report is retained.
4. An early 1600px screenshot attempt timed out during the heavier all-physical-material iteration. The final version limits expensive BRDF features to selected finishes, shares shader programs by pattern and passed all six 1600px captures. This does not establish real-GPU performance.
5. Capturing a just-opened animated panel produced an intermediate-opacity screenshot. Capture scripts now wait for the actual finite entrance animation; production animation behavior remains enabled.
6. Full regression exposed one retained GPU texture when LAB was destroyed. Three r187 keeps its shared DFG integration lookup in shader uniforms. `FinishResources.ts` now tracks that public uniform reference and releases the lookup after its final renderer owner. The real LAB and chapter teardown reruns both reached zero allocated resources. A two-renderer/deferred-uniform unit regression was added. The interrupted aggregate (21 passed, one failed, one interrupted, seventeen not run) and failure trace are retained; those counts are not presented as a successful run.

7. Large touch buttons could overlap the stick on narrow portrait screens. The responsive layout now limits horizontal growth while preserving minimum hit targets; the maximum-size layout test passed four aspect ratios.

## Limits and publication

The application has no ray-traced GI/reflections, authored high-resolution lightmap atlases or temporal reconstruction. Existing baked vertex shading is coarse; new detail parts use only coarse local vertex occlusion. Shadow-map/frustum limits and some layered/oblique geometry artifacts remain visible. The images establish the actual improvement, not a cinematic-finish guarantee.

Physical Android/iPhone, representative desktop GPU and continuous mobile tests have not been run. Highest-quality compatibility/performance therefore remains unverified. New source assets do not replace the unfinished twelve gravity nodes, four loops or shared-walker chapter migration described in V03_ACCEPTANCE.md.

No production deployment is performed in this round. The prior GitHub Pages V0.2 site remains unchanged. The feature branch/source ZIP identifies the new implementation; the older V0.2/V0.3 reports and manifests are historical snapshots for their named revisions.


## Final recorded evidence

- `evidence/atelier/measurements.json`: six matched view poses (maximum position/quaternion component difference zero), role audit, contrast and asset-byte data.
- `evidence/atelier/portal-projection-summary.json`: nineteen actual 1080p marker measurements, maximum 0.287984959px. Full records are in `evidence/atelier/regression/visual-*.json`.
- `evidence/atelier/production-journey.webm`: genuine ordinary-production keyboard recording, 573.0 seconds / 46,760,138 bytes. This is the existing complete chapter, not the unbuilt four V0.3 circuits.
- `evidence/atelier/regression-index.json`: the output from this run was archived before restoring historical V0.2/V0.3 evidence. Old reports are not silently overwritten by a newer rendering pass.
- `evidence/atelier/playwright-final.json`, `vitest-final.json`, `production-final.json`, `subpath-final.json`: real runner results. The source-archive manifest binds the delivery files by SHA-256.

The production build still warns about the existing shared engine/Rapier chunk: 5,294.45KB raw / 1,925.82KB gzip. The chapter chunk is 653.02KB raw / 213.65KB gzip, including the new lighting support. No chunk warning or failing test was suppressed. No representative hardware FPS result is available.
