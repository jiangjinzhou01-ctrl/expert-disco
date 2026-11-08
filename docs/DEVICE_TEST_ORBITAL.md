# Orbital — physical device acceptance entry

Status: **BLOCKED / not executed in this environment**. Browser touch emulation and SwiftShader do not establish Android/iOS controls, GPU performance or thermal stability.

Use the published site in a fresh browser context and open `?debug=1`. Confirm settings show the highest preset before changing anything. Record the phone model, OS/browser version, viewport/orientation, device pixel ratio, screen refresh rate, power mode and initial device temperature conditions. Diagnose rendering separately from network loading.

| Minute | Operation |
| --- | --- |
| 0–1 | Cold load; inspect capsule glazing, nearby fixtures and sky. Check settings default and actual stage completion. |
| 1–4 | Walk the full A → B → wall terminal → A loop; stop/reverse mid-arc and turn back through the portal. |
| 4–6 | Slow and fast equal-distance swipes, simultaneous movement/look, open/close diagnostics/settings/photo. Confirm immediate stop after touch release. |
| 6–8 | Repeated camera turns and traversals; change orientation, background for 15 seconds and resume. Check control recovery and world membership. |
| 8–10 | Continue moving/turning with the highest preset, inspect visual quality and the frame-time trend. Reload once and verify safe checkpoint restoration. |

Export diagnostic JSON at the end of each minute and after any defect. The FPS/P95/P99 monitor is a rolling maximum 1,800-frame window; ten snapshots describe a trend and must not be mislabeled as one aggregate ten-minute percentile. Use browser profiling or a dedicated continuous frame log if an aggregate is required. Record missing GPU timing/temperature as unavailable.

Inspect loaded/resident/proxy/evicted chunk counters during turns, and confirm destination-world interests appear while looking through a portal before crossing. A failed optional detail request should retain a safe visible silhouette; a failed essential asset should show a recoverable loading error rather than a blank canvas.

Targets for a nominated representative device must be agreed and evaluated with this real data. Initial reference: 60 FPS desktop/high-performance phone; at least stable 30 FPS and P95 ≤33.3 ms for a nominated mid-range Android at the specified conditions. A device that misses the target is FAIL at that preset, not silently reclassified or automatically downgraded.

Retain the raw records, a screen recording and a defect list in a device-specific evidence folder. Only mark physical-device acceptance PASS after actually performing this test.
