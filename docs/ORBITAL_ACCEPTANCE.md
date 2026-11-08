# Orbital revision — actual acceptance record

Status meanings: **PASS** = an actual check completed successfully; **FAIL** = an actual check failed; **BLOCKED** = the environment cannot execute the required check; **NOT RUN** = a check exists or is required but has not yet been executed. Pending and blocked checks are never counted as passed.

This document covers the new orbital revision. Historical G0/V0.2 logs remain historical evidence and do not certify the new art or loading behavior.

| ID | Check | Status | Evidence / limitation |
| --- | --- | --- | --- |
| R01 | Inspect actual primary GitHub LOD, frustum, cache and asynchronous queue implementations | PASS | GitHub connector reads on 2026-11-07; pinned source paths and licenses in ORBITAL_REFERENCES.md |
| R02 | Verify installed Three.js visibility APIs instead of assuming current upstream compatibility | PASS | Installed three 0.187.0 src/math/Frustum.js inspected; setFromProjectionMatrix and intersectsBox present |
| O01 | Highest-quality default on fresh desktop and touch contexts | NOT RUN | New product browser regression |
| O02 | Diagnostics opens and closes through its own button, F3 and Esc | NOT RUN | New product browser regression |
| O03 | Settings persist valid explicit choices; invalid settings do not reach runtime | NOT RUN | New product browser + pure persistence tests |
| O04 | Same-distance fast touch produces more yaw than slow touch, with no motion after release | NOT RUN | Native/synthetic Pointer Events browser test plus deterministic response unit tests |
| O05 | Photo UI hides ordinary controls, exports actual canvas image, exits cleanly | NOT RUN | New product browser regression |
| O06 | Help/about close and do not retain movement input | NOT RUN | New product browser regression |
| S01 | Deferred detailed asset requests; unloaded regions retain proxy silhouettes | NOT RUN | Network interception and actual streaming snapshot |
| S02 | Needed details eventually replace proxies after asynchronous load | NOT RUN | Delayed GLB response resumed in browser |
| S03 | Portal camera adds destination interest before player world transfer | NOT RUN | Runtime source world A + mapped B interest assertion |
| S04 | Behind/out-of-view details are culled and eventually disposed according to cache policy | NOT RUN | Actual manager state and disposal tests |
| S05 | Failed detail requests retain safe fallback and report failure | NOT RUN | Streaming failure regression |
| G01 | Existing mathematics, collision, gravity and round-trip tests remain valid | NOT RUN | Full unit/integration regression required |
| G02 | Actual production browser can complete outbound and return journey | NOT RUN | Production bundle + real keyboard/pointer input required |
| G03 | Root and repository-subpath production resources load successfully | NOT RUN | Build/subpath checks required |
| A01 | New architecture and planets inspected from player-reachable positions | NOT RUN | Actual browser images required; manifests alone are insufficient |
| A02 | Licensing and attribution for bundled external assets | NOT RUN | Asset inventory / source files required |
| P01 | Desktop real-GPU sustained frame-time target | BLOCKED | This environment only provides software-rendered browser testing; no representative GPU measurements available |
| P02 | Real Android/iOS device controls, highest-quality performance and 10-minute thermal run | BLOCKED | No physical mobile device attached; browser touch emulation does not satisfy this item |

## Reproduction commands

Commands will be accompanied by their actual result after execution. Until then they remain instructions rather than a successful run record.

```sh
npm run typecheck
npm run lint
npm run test:unit
npx playwright test src/tests/e2e/orbital.spec.ts
npm run test:e2e
npm run build
npm run test:production
npm run test:subpath
```

Performance results must name the browser, renderer, viewport, DPR, quality, sample duration, and actual percentiles. Neither INP nor a frame-rate number from a few fixed screenshots certifies continuous 3D control latency. No commercial-readiness or real-device performance claim is made by this pending record.
