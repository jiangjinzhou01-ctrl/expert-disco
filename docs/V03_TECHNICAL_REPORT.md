# THRESHOLD V0.3 — locomotion checkpoint report

This is an implemented development checkpoint, with incomplete V0.3 content. It is not a claim that the twelve-node/four-circuit product is finished.

## Actual implementation

- ChapterController now accepts action input, adjustable speed, sprint, posture, jump buffering/coyote time, physical airborne velocity, zero-g thrust and braking. Ground input continues through the original CR1 contact checks and atomic portal module.
- Jump launch uses sqrt(2 × 9.81 × nominalHeight); current gravity affects integration, not launch speed. A 0.33g setting therefore produces about 3.64m for the nominal 1.2m jump where unobstructed.
- ChapterPhysics owns the actual mutable Rapier capsule. Prone uses a horizontal 0.365m half-segment / 0.26m radius capsule, aligned to local gravity and constrained heading. It is not only a low camera.
- Posture changes keep the foot anchor, validate a 12mm lift, check bounded intermediate rotations/dimensions using inflated capsules, then validate settling and the final real shape. A failed transition leaves both stance and camera unchanged.
- Large cuboid support contacts receive a geometric top-plane exemption only when the exact capsule lower bound is safely above the top. Wall/obstacle checks stay active. This resolves numerical near-contact false positives without permitting an underground capsule.
- PortalPhysics exposes optional actual-shape data. PortalTransfer measures capsule aperture bounds in the source portal frame; CollisionQueries validates the mapped shape/orientation at the destination. G0-LAB continues through its fixed-shape defaults.
- ActionBuffer retains short taps until a physics step, merges independent sources, and clears on blur/orientation/menus. Buttons use their own Pointer IDs and capture.
- Settings support explore/experiment profiles and version-2 serialization in the existing storage namespace. Old settings and v1 checkpoints remain readable. Existing checkpoints are not silently deleted after a restore rejection.
- New RingChart / SurfaceWalker components generate a continuous physical frame and a shared mesh for Three/Rapier. They have real numerical/collision tests, but are not registered as new browser rooms yet.
- Reset keeps a validated recoverable checkpoint. Existing lower void floors are excluded from updating that checkpoint, because a normal jump cannot climb back out of those pits. A real-geometry integration test and an actual production R-key reset verify recovery.

## Important implementation limits

The original compatibility controller is still active for CR1. The new chart walker does not yet replace it in the chapter. New authored field rooms, route assets, branch collars and the four circuits remain to be integrated. The free-experiment 0g control is usable now; it does not stand in for the planned G12 architectural chamber.

Posture may legitimately be refused when a long prone capsule cannot fit a curved or obstructed surface. General support-height adjustment and safe body reorientation at future multi-axis junctions remain part of the next integration work. Touch button placement is fixed; size and opacity are configurable.

Checkpoint autosave still requires grounded support. Mid-flight zero-g checkpoints are not currently restored. Legacy v1 files are migrated on the next successful save; the old namespace remains intact.

## Environment and commands

Environment: Linux x86_64 managed workspace, Node 24.22.1, npm 11.9.0. Browser: Playwright Chromium 158.0.8127.18 using WebGL2 / ANGLE SwiftShader. Mobile tests are browser emulation, not physical Android or iPhone.

Dependency versions are unchanged in package-lock.json: React 19.3.1, R3F 9.8.2, Three 0.187.0, Rapier 0.21.0, Vite 8.3.6, TypeScript 6.0.3, Vitest 5.1.0, Playwright 1.65.0.

Required actual checks:

| Command | Latest status |
| --- | --- |
| npm run typecheck | PASS, evidence/v03/typecheck.log |
| npm run lint | PASS, evidence/v03/lint.log |
| npm run test:unit | PASS: 110 tests, 20 files, 17.77s; evidence/v03/unit-final.log and vitest-final.json |
| npm run test:e2e | PASS: 37 tests, 13.5 minutes; evidence/v03/e2e-final.log and playwright-final.json |
| npm run build | PASS at 4d267eb; evidence/v03/build.log |
| npm run test:production | PASS: 4 tests, 9.5 minutes; evidence/v03/production-final.log and production-final.json |
| npx playwright test --config playwright.production.config.ts -g 'V03 normal production' --output=/tmp/threshold-v03-production-recovery | PASS: 1 test, 1.3 minutes, including real R-key reset; evidence/v03/production-recovery.log and production-recovery.json |
| npm run test:subpath | PASS: 68 successful resource responses, LAB and chapter, WebGL2, no mutation adapters; evidence/v03/subpath-final.log and subpath-final.json |

The complete browser and four-case production suites ran against source 1524f54. The later 4d267eb change only prevents checkpoints from being replaced by lower-void floor locations. The final 110-test aggregate, production rebuild, focused production action/reset rerun and repository-subpath test cover that correction. The complete browser suites were not run a second time after that correction. The delivery commit additionally records documentation, evidence and the production reset assertion; it makes no further runtime changes.

Unit evidence includes the existing fixed-seed 1000-transform portal math checks, 100 natural portal round trips, CR1 reverse traversal, and new motion/input/persistence/surface tests. The new chart walker test completes a full 360-degree physical circuit, checks the ceiling orientation, stops and completes the reverse circuit. This is a reusable-component test, not a claim that a corresponding chapter room is built.

### Recorded measurements

- At 1/60s physics steps and a nominal 1.2m jump, measured 1g apex is 1.199858m with 1.0s flight; 0.33g apex is 3.636361m with 3.0s flight. Both launch at 4.852216m/s. Source: evidence/v03/jump-physics.json.
- Portal pixel regression at fixed 1920×1080 / DPR 1 localized 19 marker samples. Maximum measured center error is 0.287985px. Separate live-motion/parallax and actual crossing-continuity assertions passed. Source: evidence/v03/portal-projection-summary.json and the visual regression JSON files in evidence/v03/regression/.
- The genuine production chapter out-and-back case took about 6.5 minutes. Its uncut browser recording is 382.68s / 30,418,649 bytes: evidence/v03/production-journey.webm. It covers the existing chapter route, not the unbuilt four V0.3 circuits.
- The two touch cases use actual browser Pointer Events with three simultaneous contacts at 1170×540 and 1200×540. Screenshots and real runtime input/physics records are in evidence/v03/touch-*.png and touch-*.json. They do not establish real-device performance.

## Failures found and corrected

1. The original forced downward grounded displacement produced measurable speed loss. Grounded contact is now handled using actual support; falling begins when that support is missing.
2. Posture queries near large cuboid floors initially refused otherwise safe crouches. Exact capsule support bounds now distinguish floor contact from overlap.
3. Inflated rotation samples initially collided with their own curved/wall support. The collision-checked lift/morph/settle sequence resolved the tested cases.
4. An optional-chain startup guard initially accessed controller before initialization. Chapter scene startup is fixed; the first failed E2E log is preserved.
5. The action-enabled input snapshot adds held/edge fields. An older E2E asserted exact axes-only object equality; it now verifies axes and all relevant released actions.
6. A new landing-buffer regression exposed a stale grounded flag after zero movement. Requiring support alone initially regressed the original low stairs. A fresh, short downward KCC probe now distinguishes valid nearby support from actual falling; landing-buffer and original traversal tests both pass.
7. A browser aggregate ran while source files were still changing, so HMR interrupted two adapter-driven routes. The frozen final suite passed all 37 cases. The previous 34-pass/3-fail aggregate is retained in evidence/v03/e2e-before-freeze.log and playwright-before-freeze.json; the earlier startup run is retained separately as e2e-first-failed.log and playwright-first-failed.json.
8. The existing lower pit floors could replace the reset checkpoint with a location the new standard jump cannot escape. The final recovery guard preserves the earlier safe point, with an actual-box-geometry regression. Production keyboard reset was rechecked after rebuilding.

## Performance and publication

No new physical-device performance measurements have been made. Highest quality remains the default. The build still reports the existing large shared Rapier/engine chunk (about 5.29MB raw / 1.92MB gzip). This checkpoint adds no per-frame React state writes or animation loop. SwiftShader startup/regression timings are not representative mobile or desktop-GPU benchmarks; there is no new sustained-FPS acceptance result.

No V0.3 production deployment has been performed. This respects the latest user instruction. The existing GitHub Pages site is the prior V0.2 release.

## Source delivery and decision

Runtime implementation commit: 1524f54. Final recovery correction: 4d267eb. The feature branch is feat/v03-gravity-freedom, based on 0a307c666006f11cd66879153f97a9aa1283650b. V03_DELIVERY_MANIFEST.json contains file hashes and evidence scope. The source-packaging script records the exact final archive commit and SHA-256 alongside its ZIP.

Source: https://github.com/jiangjinzhou01-ctrl/expert-disco/tree/feat/v03-gravity-freedom

Complete source download: https://github.com/jiangjinzhou01-ctrl/expert-disco/archive/refs/heads/feat/v03-gravity-freedom.zip

Reproduce with npm ci, npm run dev, and the commands above. The ZIP includes source assets, lockfile, tests and evidence; npm run build regenerates dist/. The original V0.2 reports and evidence remain historical records, with this run's relevant output copied into evidence/v03/.

Decision: this is a verified, usable first-stage movement delivery and reusable gravity-component checkpoint. It is not sufficient to approve the complete V0.3 experience or a commercial/mobile performance gate: twelve authored nodes, four connected circuits and the common-controller chapter migration remain unfinished.
