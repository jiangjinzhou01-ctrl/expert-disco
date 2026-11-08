# THRESHOLD / Atelier — implemented visual direction

The product remains a continuous, playable architectural experience. This pass gives it a consistent identity, surface finishes and authored human-scale construction detail. It is not an assertion of full AAA production quality or completion of the twelve-node V0.3 content.

## Sources actually consulted

- [Apple Human Interface Guidelines: materials](https://developer.apple.com/design/human-interface-guidelines/materials). Applied interpretation: a restrained translucent control layer above the environment, with a stable opaque reading surface for settings. Legibility and visible closing controls take priority over decorative transparency.
- [Porsche Design System: typography](https://designsystem.porsche.com/v3/styles/typography/). Applied interpretation: a bounded fluid scale, consistent spacing and a clear distinction between display, heading and body text. No Porsche font, logo or component package is redistributed.
- [Geist's first-party account of designing Anthropic](https://geist.co/work/anthropic). Applied interpretation: warm neutral color, editorial serif display type and technical sans-serif controls. The actual fonts here are independently licensed Instrument Serif and Manrope, not Anthropic's proprietary fonts.
- [Cloudflare Kumo](https://github.com/cloudflare/kumo). Applied interpretation: semantic control states, keyboard navigation, focus management, ARIA naming and consistent tokens. No new component-library dependency was needed for the existing game controls.
- [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) and the installed r187 shader/area-light sources. Standard PBR covers mineral structure; the more expensive layered/anisotropic BRDF is reserved for machined metal, bronze and pressure glass.

These are references for original THRESHOLD design decisions, not brand affiliation or a copied brand skin.

## Decisions present in the application

The palette connects warm limestone, chalk mineral structure, dark basalt/blackened metal, satin aluminum and limited bronze. Cool pressure glazing and blue-white instruments provide a second light temperature. Meaningful state signals retain their own emissive colors.

Every authored chapter material and envelope alias is explicitly classified. The formerly untreated envelope, proxy silhouettes, loaded cells, devices and ornaments use the same finish library. Legacy LAB room structure now has real bevels and the shared procedural finish while its diagnostic marker colors remain controlled.

Millimetre joints are generated in world coordinates and antialiased using screen derivatives. The same metre scale applies on floors, walls and ceilings; a camera or gravity rotation cannot rotate the finish with the viewer. Photographic albedo, roughness and OpenGL normal maps remain locally served and GPU-compressed; baked vertex occlusion is retained. The shader adds shallow joint normals and bounded slab-to-slab roughness/albedo variation. It never displaces the physical surface.

AgX tone mapping, one static key shadow map per world, two bounded rectangular emitters per world and a shared prefiltered environment supply the light response. The transparent pressure glazing avoids transmission/refraction passes that could sample a different portal world. The renderer still has one active portal pass and the single existing simulation/frame scheduler.

Six manufactured gallery benches, two illuminated guide pylons, tactile lettering and curved bronze inlays add identifiable construction and scale. They are actual Blender meshes and streaming assets. Furniture collision is generated from the same layout used for modeling; no new passage or gravity node is implied by the detail kit.

UI uses larger readable controls, an original double-threshold mark, a single glass tool rail, a restrained location heading and warm paper panels. The loading composition, help, about, diagnostics, photography and mobile actions share the same type, spacing and control language. Settings remain persistent; the default quality is still highest on all devices. Motion reduction, focus outlines, close actions and 44px touch targets remain part of the implementation.

## Honest boundary

This pass does not supply ray-traced GI/reflections, authored high-resolution lightmap atlases, Nanite-like geometry, character animation, a full cinematic VFX pipeline or hardware validation. Coarse vertex occlusion and static shadow maps have visible limits. Architectural texture variation is deliberately restrained and the LAB remains a controlled engineering scene. Acceptance should use the actual paired browser images and runtime checks, not an unverified AAA label.
