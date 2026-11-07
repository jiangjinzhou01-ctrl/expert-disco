# G0 reproducible browser validation protocol

This document defines checks. It is not a record of successful execution. Execution results belong in `G0_ACCEPTANCE.md`, `G0_TECHNICAL_REPORT.md`, JSON reports and screenshots.

## Environment and deterministic setup

Use the Playwright-installed Chromium build, a 1920 × 1080 viewport, device scale factor 1 and a fixed seeded scene. Record the Chromium version, OS, WebGL vendor/renderer, WebGL 2 support, renderer pixel ratio and canvas drawing-buffer size. Software WebGL is valid for correctness but does not establish desktop hardware or Android performance. Keep animation time deterministic during projection comparisons by pausing the simulation at an explicit tick. Capture the actual canvas after at least two rendered frames following a pose change. Use `page.screenshot()` for PNG evidence and `pngjs` to inspect pixel bytes. Never replace rendering with mocked screenshot data.

Expose deterministic placement, stepping, input and projection inspection only in a dedicated E2E build (`import.meta.env.MODE === 'e2e'`) or development. The normal production bundle must expose no unconditional teleport or forced-step API. Production smoke tests use real DOM/keyboard/pointer controls and read-only diagnostic snapshots. Diagnostics may publish committed state and event IDs without permitting state mutation.

## Projection measurement algorithm

1. Freeze the scene animation clock and set a legal source camera pose. Read back the actual committed main camera matrix and projection matrix after rendering.
2. Independently calculate `T = M_destination * rotationY(pi) * inverse(M_source)` in the test or calculate expected values from known door transforms. Compute `mappedCameraWorld = T * mainCameraWorld`; its inverse is the expected target view matrix. Verify the renderer's mapped camera against this independently computed matrix.
3. For each known target marker center `P`, calculate `clip = projection * inverse(mappedCameraWorld) * vec4(P,1)`. Reject `clip.w <= 0`. Divide by `w` and convert NDC to canvas pixels: `x=(ndc.x+1)*W/2`, `y=(1-ndc.y)*H/2`. Use drawing-buffer dimensions rather than CSS dimensions if DPR differs.
4. Before testing a marker, independently intersect the virtual-camera-to-marker ray with the destination plane. The intersection must lie inside the aperture by a margin at least equal to the projected marker radius. Check destination-side signed distance and occlusion against known walls. A marker hidden by a valid wall is not a projection failure, but each pose must require at least one deliberately visible marker. Do not silently skip every marker in an oblique pose.
5. Segment saturated marker colors in the actual screenshot. Use dominance rules robust to sRGB and antialiasing, for example green `g > 140 && g > 1.8*r && g > 1.5*b`, magenta `r > 140 && b > 100 && r > 1.7*g && b > 1.5*g`, cyan `g > 120 && b > 140 && g > 1.7*r && b > 1.7*r`. Restrict matching to a small region around the independently predicted location and require a minimum connected component area. The test must fail if no pixels are found. Prefer uniformly colored unlit spheres or small front-facing geometric targets, without bloom or shadows.
6. Calculate the matching component's pixel-center centroid using coordinates `(x+0.5,y+0.5)`. Require Euclidean center error ≤ 2 pixels at DPR 1 and save the expected/observed coordinates, component area, error and pose in JSON. Use the same matrix/pixel checks after a viewport resize.

Existing ROOM B markers are at `(38,1.55,1.5)`, `(39,2.2,-1)` and `(41,.8,0)`. Some are correctly occluded at a 60° view because the aperture is narrow. Include an additional small marker near `(33,1.55,0)` or choose a known per-pose marker close to the exit plane so every required pose has measurable evidence. Its real geometry must exist in ROOM B and remain visible after crossing; never draw an artificial screenshot-only overlay.

## Required visual poses

For source local aperture center `O`, local +Z normal `N`, local +X right `R`, camera eye offset `dy` and distance `d`, use `cameraPosition = O + d*cos(theta)*N + d*sin(theta)*R + dy*Y`, looking toward `O + dy*Y`. Test front `theta=0`, oblique `theta=30°`, oblique `theta=60°`, close front `d=1m`, very close front `d=.1m`, and a pose near the aperture's side edge. Fix the main FOV and camera pitch. If physical player placement cannot reach a visual-only pose, isolate the visual camera probe in the E2E build; retain separate real-physics traversal checks.

A marker beyond the exit plane must render when geometrically visible. A deliberately identifiable marker behind the destination plane must never leak through the aperture. Check expected marker-color pixel absence in the aperture region for that behind-plane sentinel. Check frame pixels and source-side wall pixels remain opaque. At the source plane-crossing tick, capture the before and after committed states and screenshots; no intermediate state may pair a B camera with an A collider. Do not demand pixel equality across different-world screenshots; assert mapped pose, world, event count and the absence of a full black canvas.

## Dynamic, perspective and temporal checks

Read the live moving object's real scene transform at two deterministic simulation times and verify it changed. Require a corresponding image-region change at its projected position. Capture two lateral camera poses while holding simulation time fixed and require both the expected projection displacement and the actual segmented-marker displacement. This rules out a static image and a fixed-UV flat display. After crossing, verify the moving object's simulation clock did not restart.

## Physics browser checks

Read committed runtime snapshots, collider translation and transfer events. Drive the character with deterministic movement input in fixed 1/60 second steps: A to B, spatial rearm, turn around, B to A. Require unique monotonically increasing event IDs and one transfer maximum per step. Assert transformed position, rotation, velocity, world ID and remaining displacement, rather than relying on room text. Repeat enough forward/back cycles in Vitest for 100 complete round trips, and at least one real browser traversal in each direction. Test keyboard WASD, drag/pointer-lock look, R reset and F3 diagnostics separately through DOM input.

## Renderer state and resource checks

Create a pre-render renderer-state sentinel in tests: non-default target, viewport, scissor/test, clipping planes, clear color/alpha, auto-clear and XR enabled flag. Execute the portal pass and compare every owned state afterward, including the exceptional cleanup path. The portal pass must restore a hidden target surface even when rendering throws. Assert there is no recursive invocation and only one active offscreen pass per displayed frame.

At several sizes and quality factors inspect actual render-target width/height and require the viewport aspect ratio to be preserved. Repeatedly resize and toggle quality, then dispose/unmount the experience. Check explicit resource counters and `renderer.info.memory` trends; do not claim a GPU memory-byte value because Three reports object counts, not bytes. Trigger `WEBGL_lose_context` when supported, verify the app records loss and stops unsafe drawing, request restoration, then verify the app resumes valid rendering and input. An unsupported extension is reported as unavailable, not passed.

## Mobile and interruption checks

Use a mobile Chromium context with touch enabled and dispatch real Pointer Events to the left movement zone and right look zone with distinct pointer IDs. Hold both simultaneously; movement and yaw/pitch must both change. Cover pointercancel, lostpointercapture, blur, visibility changes and portrait/landscape resize. Verify inputs clear after interruptions and the page never scrolls. Use the UI reset and diagnostics controls, then complete forward/reverse traversal with touch movement/look. Browser emulation validates input logic only; it cannot certify Safari, Android driver performance or phone thermal behavior.

## Production smoke and performance evidence

Build with normal production mode, serve `dist/` through Vite preview, and run a second Playwright config against that preview. Check there is no mutation test API, establish WebGL 2, exercise real input and confirm real committed transfer events. Use the normal read-only diagnostics for evidence.

Export runtime frame-time samples, sample duration/count, FPS, mean/P95/P99 frame time, main/offscreen draw calls, physics CPU time, RT size, resource counts and context status. GPU timing is shown as unavailable without a valid timer-query extension and disjoint handling. Real midrange Android acceptance requires 10 continuous minutes of operation, repeated bidirectional crossings, view rotation, background/foreground and resizing. Without physical hardware access this item is BLOCKED and its 33.3ms P95 requirement is unverified. Desktop software-renderer measurements cannot substitute for it.

## Implemented pixel-test suitability rule

`visual.spec.ts` measures uniformly colored spheres only when their predicted projected radius is at most 30 pixels. Its 45-pixel search region therefore contains the entire marker silhouette. This avoids both cropping a large sphere into a region centered on the expected answer and interpreting perspective silhouette offset as a center-projection error. Every pose still requires at least one measurable marker. The visibility calculation checks the aperture at the source frame's front, the portal plane and the destination frame's front (the frame is 0.55m deep), rather than checking only the infinitesimal plane. Each selected marker must yield real matching pixels and stay within the 2-pixel limit. Motion validation fixes the camera, advances simulation by exactly 120 × 1/60 seconds and compares the actual screenshot region containing the moving object.
