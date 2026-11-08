# V0.3 physical-device record

**No physical Android/iPhone test has been performed in this workspace.** The automated 1170×540 and 1200×540 records use Chromium emulation and native CDP touch injection.

Start the development branch with npm ci and npm run dev -- --host 0.0.0.0 --port 5180. On the same local network, open the host computer's LAN address on port 5180. Use the actual port printed by Vite. Production preview can be served with npm run build and npm run preview -- --host 0.0.0.0.

Record device model, OS/browser version, physical resolution, DPR, landscape CSS viewport, thermal/power state, source commit and selected quality. Highest is the default; record any explicit quality change.

For at least ten minutes:

1. Move and look with two fingers; press jump/sprint as a third contact. Check the 19.5:9 or 20:9 safe areas.
2. On ordinary floor, crouch, release to stand, toggle prone, turn, move, and rise under a deliberately low physical ceiling. A rejected rise must preserve the current shape.
3. Traverse the original portal in each posture, return, then check the original CR1 arc and wall route.
4. Use free-experiment 0.33g at nominal jump height 1.2m. Confirm larger height/flight time where the architecture provides headroom.
5. Use 0g: ascend, descend, move forward/back, release into inertia, brake, restore gravity and land. Safety reset must recover a finite valid pose.
6. Open/close settings and diagnostics repeatedly. Background the browser while holding move/action contacts; return and verify all held input is cleared.
7. Rotate/resize the viewport and repeat the three-contact sequence. Check that rendered view and collision posture stay consistent.
8. Export diagnostics at start, two minutes, five minutes and ten minutes. Include screenshots or continuous recording and note any input drop, contact jitter or unsupported body orientation.

The export contains movement settings, input diagnostics, stance, locomotion mode, capsule/camera pose, actual transfer events, physics cost, frame-time percentiles and resource counts. It does not measure GPU memory/latency on devices that do not expose those metrics.

This device procedure validates only the currently implemented chapter/movement checkpoint. The four new circuits and G01–G12 need their own uninterrupted recordings after their real assets and connections are integrated.

| Device | Duration | Input/posture | CR1/portal | Frame times/resources | Result |
| --- | --- | --- | --- | --- | --- |
| Android 19.5:9 physical handset | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| Android 20:9 physical handset | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
| iPhone physical handset | NOT RUN | NOT RUN | NOT RUN | NOT RUN | BLOCKED |
