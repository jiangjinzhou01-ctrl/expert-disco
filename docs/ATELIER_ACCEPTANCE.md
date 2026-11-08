# Atelier visual delivery — acceptance

Status: **IMPLEMENTED / AUTOMATED VERIFICATION PASSED for this visual pass**. International AAA quality, real-device performance and the complete V0.3 gravity content remain unverified or unfinished.

| Item | State | Evidence |
| --- | --- | --- |
| Authored chapter material roles, envelope aliases and idempotent shared finishes | PASS | atelier-finishes unit tests |
| Real new meshes with topology, bounds, UV, normal and SHA-256 assertions | PASS | orbital-architecture test; source compression report |
| Eight furniture hulls share model layout, avoid original solids and preserve protected route | PASS | atelier-furniture integration tests |
| Actual Rapier capsule cannot walk through a bench | PASS | real KCC movement and hull dimensions |
| Complete unit/integration regression | PASS | 115 tests / 23 files, final aggregate log |
| Browser shader/material coverage and UI contrast/focus checks | PASS | full 40-case browser run; atelier.spec.ts |
| Portal pixel projection and crossing continuity after LAB finish changes | PASS | 19 localized markers, maximum 0.287985px; live parallax/crossing assertions |
| Existing CR1, bidirectional portals, mobile input, streaming and lifecycle | PASS | 40 tests, no skips/retries/flaky results |
| Normal production keyboard journey and V0.3 actions | PASS | 4 tests; 573s genuine chapter recording |
| TypeScript and ESLint | PASS | final aggregate command output |
| Production build and repository-subpath loading, including local fonts | PASS | 73 successful responses; both local fonts HTTP 200 |
| Same-camera before/after review | PASS (captured and inspected) | six paired 1600×900 poses, zero pose-component difference; artistic AAA approval not implied |
| Physical Android/iPhone and representative desktop GPU | BLOCKED | no attached device/GPU |
| Sustained 10-minute mobile performance | NOT RUN | cannot substitute SwiftShader |
| International AAA production-quality claim | NOT VERIFIED | outside the evidence established by this rendering pass |
| G01–G12 and four new gravity circuits | NOT COMPLETE | unchanged scope from V03_ACCEPTANCE.md |
| Production publication | PASS | GitHub Pages run 42465477553 published the compiled Atelier build |
| Live production browser smoke test | PASS | HTTP 200, runtime ready, WebGL2 active, VESTIBULE state, zero browser errors |

`npm run verify` completed with exit code 0 on runtime revision 9abdcbd. Evidence is in `evidence/atelier/verify-final.log`. The previously interrupted resource-failure run remains separately archived.
