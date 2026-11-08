# Orbital revision — actual acceptance record

Status meanings: **PASS** = an actual check completed successfully; **FAIL** = an actual check failed; **BLOCKED** = the environment cannot execute the required check; **NOT RUN** = a check exists or is required but has not yet been executed. Pending and blocked checks are never counted as passed.

This document covers the new orbital revision. Historical G0/V0.2 logs remain historical evidence and do not certify the new art or loading behavior.

| ID | Check | Status | Evidence / limitation |
| --- | --- | --- | --- |
| R01 | Inspect actual primary GitHub LOD, frustum, cache and asynchronous queue implementations | PASS | GitHub connector reads on 2026-11-07; pinned source paths and licenses in ORBITAL_REFERENCES.md |
| R02 | Verify installed Three.js visibility APIs instead of assuming current upstream compatibility | PASS | Installed three 0.187.0 src/math/Frustum.js inspected; setFromProjectionMatrix and intersectsBox present |
| O01 | Highest-quality default on fresh desktop and touch contexts | PASS | orbital product/touch browser tests; fresh desktop and emulated-touch contexts both quality=1 |
| O02 | Diagnostics opens and closes through its own button, F3 and Esc | PASS | orbital product browser test; own close button, F3 and Esc all executed |
| O03 | Settings persist valid explicit choices; invalid settings do not reach runtime | PASS | 91-test unit/integration run; settings reload browser check; real production checkpoint reload regression |
| O04 | Same-distance fast touch produces more yaw than slow touch, with no motion after release | PASS | deterministic LookResponse tests plus browser Pointer Events and two native-CDP chapter journeys |
| O05 | Photo UI hides ordinary controls, exports actual canvas image, exits cleanly | PASS | actual PNG export inspected: 640×360, 100% opaque, 378 sampled color bins; product regression passed |
| O06 | Help/about close and do not retain movement input | PASS | product browser test closes both dialogs; input adapters clear held state on cancellation/blur |
| S01 | Deferred detailed asset requests; unloaded regions retain proxy silhouettes | PASS | delayed real GLB network responses; actual proxies and deferred request counts in streaming.json |
| S02 | Needed details eventually replace proxies after asynchronous load | PASS | delayed responses resumed; resident geometry replaces proxies in streaming.json |
| S03 | Portal camera adds destination interest before player world transfer | PASS | world A remained active while a cropped mapped B interest requested destination cells |
| S04 | Behind/out-of-view details are culled and eventually disposed according to cache policy | PASS | 7 pure residency tests + actual browser eviction; resize regression repeats warmed views; final resources zero |
| S05 | Failed detail requests retain safe fallback and report failure | PASS | actual optional GLB abort retained proxy and valid support; explicit failure diagnostics recorded |
| G01 | Existing mathematics, collision, gravity and round-trip tests remain valid | PASS | npm run test:unit: 91 passed; includes 1,000 seeded transformations and 100 round trips / 200 commits |
| G02 | Actual production browser can complete outbound and return journey | PASS | production ordinary bundle: actual keyboard/mouse chapter terminal+return, no mutation adapter; 381.16 s continuous video |
| G03 | Root and repository-subpath production resources load successfully | PASS | production build and repository-subpath smoke passed; 68 successful requests, no page/request errors |
| A01 | New architecture and planets inspected from player-reachable positions | PASS | CAPSULE/ARRIVAL/CROSSING/C3 real browser captures plus native-touch, free-look and full-path images |
| A02 | Licensing and attribution for bundled external assets | PASS | actual source/encoder SHA checks, asset manifests, local license files and in-app CC BY attribution |
| P01 | Desktop real-GPU sustained frame-time target | BLOCKED | This environment only provides software-rendered browser testing; no representative GPU measurements available |
| P02 | Real Android/iOS device controls, highest-quality performance and 10-minute thermal run | BLOCKED | No physical mobile device attached; browser touch emulation does not satisfy this item |

## Reproduction commands

Final local software checks have completed. Intermediate failed runs are preserved and explained below; physical-device items remain blocked.

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

## Actual local execution record (2026-11-08)

| Command | Actual result | Record |
| --- | --- | --- |
| `npm run typecheck` | PASS | `evidence/orbital/typecheck.log` |
| `npm run lint` | PASS | `evidence/orbital/lint.log` |
| `npm run test:unit` | PASS, 91 tests / 15 files | `evidence/orbital/unit-final.log`, `evidence/vitest.json` |
| `npm run test:e2e` | First full run: 33 passed, one failed | `evidence/orbital/e2e-final.log`, `e2e-full-first.json` |
| `npx playwright test src/tests/e2e/v02.spec.ts -g 'offscreen portal culling' --output=/tmp/threshold-orbital-resize-regression --reporter=list` | PASS, corrected regression 1/1 | `evidence/orbital/resize-regression.log` |
| `npm run test:production` | First run: two passed, checkpoint comparison failed | `evidence/orbital/production-final.log`, `production-first.json` |
| `npx playwright test --config playwright.production.config.ts -g 'real walked checkpoint' --output=/tmp/threshold-production-checkpoint --reporter=list` | PASS, corrected regression 1/1 | `evidence/orbital/checkpoint-regression.log`, `production-checkpoint.json` |
| `node scripts/collect-v02-video.js` | PASS, actual recording 31,123,692 bytes / 381.16 s | `evidence/orbital/production-video.log`, `evidence/v02/video.json` |
| `npm run test:subpath` | PASS after software-renderer screenshot adjustment | `evidence/orbital/subpath-final.log`, `evidence/subpath-smoke.json` |
| `node scripts/capture-orbital.mjs` | PASS, four actual views | `evidence/orbital/art-final.log`, `art-capture.json` |
| `node scripts/measure-orbital.mjs` | Executed, software-renderer data only | `evidence/orbital/software-performance.json` |

The 34 distinct development-browser scenarios and three production-browser scenarios have each passed after the specific corrections above. This is not described as an uninterrupted green aggregate run: the original failing reports are retained. GitHub independently runs the aggregate `npm run verify`; an in-progress workflow is not counted as a completed PASS. [Workflow results](https://github.com/jiangjinzhou01-ctrl/expert-disco/actions/workflows/ci.yml).

### Corrections made during validation

1. Settings links now have stable explicit accessible names; the previously blocked About action is exercised successfully.
2. A camera-placement regression performs a real physics step before asserting support, instead of treating a deliberate test relocation as a completed collision query.
3. A wider viewport legitimately loads new cells and keeps them briefly. The resize test now warms the same viewport sequence and then checks repeated allocation stability, retaining strict zero-resource teardown checks.
4. Navigation flushes a newer safe checkpoint than the earlier periodic save. The production test now compares the restored pose with the actual persisted checkpoint after navigation. In the real rerun, persisted and restored Z both equal 23.456019792713988 m.
5. The original 1280×720 subpath screenshot exceeded 30 seconds on SwiftShader even though assets/runtime passed. The smoke test now uses a recorded 640×360 viewport and 90-second screenshot timeout; highest preset remains 1 and all resource/runtime assertions remain mandatory. Full portal pixel projection tests continue at their original fixed viewport.

Shared portal pixel regression measured 23 marker centers; maximum center error was **0.287985 px**, below the 2 px assertion. This checks the shared renderer in G0-LAB; the chapter's additional architectural visibility is validated separately.

Overall: **PARTIALLY VERIFIED**. All distinct local software scenarios above are verified after corrections. Physical-device and commercial art/performance acceptance remain outstanding; a running independent CI workflow is not marked PASS.
