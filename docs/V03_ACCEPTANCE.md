# THRESHOLD V0.3 — development checkpoint

Status: **PARTIALLY IMPLEMENTED / NOT A COMPLETE V0.3 RELEASE**.

This branch implements the first locomotion delivery inside the existing playable chapter. It also contains tested, reusable surface geometry and a collision-constrained surface walker. G01–G12 and the four planned exploration circuits have not all been built into the browser world.

## Implemented and verified

| Item | Status | Evidence |
| --- | --- | --- |
| Adjustable 1.5–7m/s movement, sprint cap, crouch/prone speed ratios | PASS | v03-locomotion integration test |
| Jump launch along local up, physical airborne integration and collision | PASS | 1g/0.33g height/flight checks; real wall jump |
| Lower gravity preserves the nominal 1g launch speed | PASS | evidence/v03/jump-physics.json |
| Standing 1.74m, crouch 1.10m, prone 0.52m thickness / 1.25m length | PASS | Rapier shape dimensions and camera assertions |
| Posture morph checks intermediate sizes and orientations; blocked stand stays crouched | PASS | Real ceiling collider test and CR1 arc/wall posture tests |
| Crouch and prone travel through both portal directions using actual mapped shape | PASS | Two integration cases, monotonic real events |
| Zero-g thrust, inertia, braking, and restored-gravity landing | PASS | Real KCC / Rapier movement test |
| Keyboard actions, touch actions and per-source input edges | PASS | Unit and browser tests |
| Native three-pointer move + look + jump at 1170×540 and 1200×540 | PASS (browser emulation) | CDP events, actual runtime state and screenshots |
| Explicit user settings saved as v2 with v1 settings migration | PASS | Storage unit tests and browser reload |
| Old v1 checkpoint remains readable; bounded v2 posture/frame records | PASS (validator) | Persistence unit tests |
| Full source CR1 traversal, 30 reversible arcs, 100 wall-route traversals | PASS | Existing integration regression |
| G0 mapping, exit safety and 100 A→B→A loops | PASS | Existing math and Rapier regression |
| Generic circular and changing-radius chart, exact shared render/collision mesh data | PASS (component) | 3 axes/configurations, 1000 samples each, 72 real raycasts per chart |
| Generic surface walker physically rotates capsule, stops and reverses | PASS (component) | Actual new ribbon trimesh; not a browser chapter route |
| Full 360-degree chart traversal and complete reverse traversal | PASS (component) | Collision-constrained walk, inverted ceiling frame, upright return and reverse endpoint |
| Reset does not retain an unrecoverable lower-void checkpoint | PASS | Real geometry integration and final production R-key assertion |

Final command results are recorded in V03_TECHNICAL_REPORT.md. Failures and corrections are retained; a failed initial aggregate is not counted as a pass.

Executed result: 110 unit/integration tests, 37 development-browser tests, four production-browser tests, then one focused production reset/action rerun after the recovery correction. TypeScript, ESLint, production build and repository-subpath verification also passed. The report identifies the source revision covered by each run.

## Remaining V0.3 work

| Requirement | Status | Consequence |
| --- | --- | --- |
| Migrate original INVERT movement onto a common chart/controller contract | NOT COMPLETE | CR1 still uses the proven compatibility path in ChapterController |
| Register the new chart walker and constructed assets in the live chapter | NOT RUN / NOT IMPLEMENTED | Component tests are not evidence of a playable new region |
| G01–G12 full content and four continuously accessible reversible circuits | NOT IMPLEMENTED | Complete V0.3 content gate is not passed |
| Fully resolved branch collar from the original CR1 wall to an upper route | NOT RUN | Must verify the replacement support mesh and all stance sweeps before art freeze |
| Authored low-g / micro-g / zero-g rooms with safe field gradients | NOT IMPLEMENTED | Current player-facing zero/low gravity is the global free-experiment setting |
| Cross-field airborne orientation and reattachment over all future surfaces | PARTIAL | Existing arc/wall jumping works; future field intersections need integration |
| Ground acceleration / deceleration comfort tuning | NOT IMPLEMENTED | Existing immediate ground response is retained for baseline traversal |
| Rebindable keys and draggable touch-button placement | NOT IMPLEMENTED | Button size/opacity are configurable; positions use safe-area layout |
| Continuous capture of all four new circuits | NOT RUN | Routes do not yet exist in the live scene |
| Android/iPhone 10-minute real-device verification | BLOCKED | No physical device is attached |
| Commercial/mobile GPU performance gate | BLOCKED | SwiftShader measurements do not establish device performance |
| Production deployment of V0.3 | NOT RUN (intentional) | User explicitly prohibited publishing without a new instruction |

## Source and production boundaries

Work is on feat/v03-gravity-freedom, based on 0a307c666006f11cd66879153f97a9aa1283650b. The V0.2 source branch and current GitHub Pages deployment are preserved. No deployment command is part of this checkpoint.

Every engineering handoff must include the complete source ZIP download and a source/preview link. A branch link identifies this checkpoint; the existing live site remains the earlier V0.2 build.
