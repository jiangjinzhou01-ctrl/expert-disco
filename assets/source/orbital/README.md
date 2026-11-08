# THRESHOLD orbital construction kit

Original architectural geometry, authored for the current CR1 route. CC0-1.0.

## Reproduce

Run from the project root with Blender 4.3.2 and the locked npm dependencies:

```sh
blender -b --python scripts/build-orbital-assets.py -- "$PWD"
node scripts/optimize-orbital-assets.mjs
```

The first command creates metre-scale UVs, real edge bevels, weighted construction normals and material batches. The second performs actual meshopt compression with 16-bit position / 12-bit normal quantization and retains UVs for runtime PBR assignment. It does not simplify triangles. Raw exports are preserved in `chunks/`; the deployed detailed GLBs live under `public/assets/orbital/architecture/`.

`compression-report.json` records actual decoded topology counts, normals/UV retention, before/after byte counts, SHA256 and world-space bounds differences. `construction-manifest.json` is the exact production cell manifest, including open silhouette primitives. The editable Blender project is `threshold-orbital-construction.blend`.

## Construction

- Capsule: open extruded octagonal structural ribs, framed side/overhead glazing, floor plates, panel joints, countersunk fixings, conduits, ventilation grilles, tubular handrails and sealed split-leaf rear airlock.
- Arrival: heavy jamb/lintel assembly, inset wall services and route markers.
- Galleries: coursed wall joints, bolted service plates, actual recessed panels, coffered soffits, bronze framing and pier base collars.
- Gate: layered bronze reveals, service slot arrays, overhead suspended housings, hangers and approach inlays; exact portal aperture stays clear.
- Open roof: three triangulated steel transfer trusses and connected crown edges.
- Exterior: two separate full-3D tapered-core orbital buildings, ring decks, radial trusses, longitudinal members, radiator wings, observation crown and navigation light rings.
- INVERT: built-in service panels, fabrication joints, pipe collars, thin inlays generated from the same R=3.2 gravity curve and a terminal mechanism backing ring.

## Physical boundary

These details preserve the existing shared physical support surfaces. Capsule side glazing is at the existing X=+-2 wall planes; the old opaque compression-wall visual meshes can be suppressed while retaining physical guards. Detail plates remain at existing built-in surfaces. No new obstacle occupies the established route or either portal aperture. Remote orbital buildings are outside the navigable enclosure.

Both lightweight proxies and detailed groups returned by `loadOrbitalArchitecture(baseURL, slot, offset)` already include the supplied world offset. Descriptor bounds are WORLD bounds. Only the tiny manifest is requested initially; each detailed GLB is fetched when the streaming owner calls its `load()` method. Both proxy and detailed geometry are batched by material.

`capsule-clearance-validation.json` checks referenced construction vertices against the capsule's unchanged clear width and rear guard. The ribs are open at the floor, their inner edges align with X=+-2 and the rear airlock sits behind Z=36. `envelope-clearance-validation.json` checks the permanent runtime glazing/construction vertices against every retained guard volume, including the exact clear portal aperture. Neither file substitutes for browser visual acceptance.
