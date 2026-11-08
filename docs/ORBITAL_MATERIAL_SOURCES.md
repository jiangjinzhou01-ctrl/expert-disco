# Orbital architectural material sources

The orbital upgrade uses three external PBR material sets from ambientCG. The
official [ambientCG license](https://docs.ambientcg.com/license/) identifies its
assets as **CC0 1.0**, including commercial use. Source pages are preserved here
even though attribution is not mandatory under CC0.

| Deployed prefix | Original asset | Use | Original creation method |
| --- | --- | --- | --- |
| `concrete-` | [Concrete048](https://ambientcg.com/a/Concrete048) | Pale mineral architectural concrete | Photogrammetry |
| `metal-` | [Metal009](https://ambientcg.com/a/Metal009) | Brushed metal, optionally tinted dark in the material | Procedural PBR |
| `copper-` | [Metal047B](https://ambientcg.com/a/Metal047B) | Weathered copper mechanical fittings | Procedural PBR |

Each material includes **1024×1024 Color, Roughness, and NormalGL** maps. Albedo
uses sRGB; roughness and normals are linear data. Normal maps use OpenGL tangent
space, so do not invert the green channel. The metal and copper sets need the
appropriate metallic surface parameters in the renderer; a color map alone is
not a complete metal material.

All nine deployed JPEG images total **1,783,030 bytes**. The three original
archives total **18,969,393 bytes** because ambientCG bundles unused higher-bit
maps and other channels in its 1K JPG packages. Original archives are cached in
`/tmp/threshold-orbital-material-sources`, not deployed. No external asset server
is required when the application runs.

Regenerate with Python 3 and Pillow:

```sh
python3 scripts/fetch-orbital-materials.py
```

Verify the existing checked-in images without accessing the network:

```sh
python3 scripts/fetch-orbital-materials.py --verify
```

`public/assets/orbital/materials/manifest.json` records source archive and original
map SHA-256 hashes, exact upstream archive member names, final file hashes,
dimensions, byte counts, and the official license URL. The generator specifies
the derivative JPEG encoding: quality 86 for color/roughness and quality 92 with
no chroma subsampling for normals. Pillow encoder-version changes can alter
derivative bytes; the checked-in manifest makes that change visible.

## Actual GPU texture compression

The same nine source images also have real **KTX2/UASTC** derivatives, each with
eleven precomputed mip levels from 1024×1024 down to 1×1. They are produced by
[Khronos KTX-Software v4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2).
The official Linux x86_64 package is pinned to GitHub's published SHA-256:

```text
ca635ed489d8bf54fac8d7687056c651193de0740830a7738cc034adc63e3027
```

The generator uses UASTC quality 3, Zstandard level 18, deterministic RDO
(lambda 0.25 for normal maps and 1 for other maps), and an explicit two-thread
encoder budget per job. Albedo is tagged sRGB/BT.709. Roughness and normals are
tagged linear with no color primaries. Normal encoding uses
`--normal_mode --normalize --input_swizzle rgb1` so standard Three.js XYZ normal
sampling remains correct; XY is not packed into RGB/alpha.

Images are physically flipped with `--lower_left_maps_to_s0t0`, matching the
previous JPEG `TextureLoader.flipY=true` GPU upload. KTX2 compressed textures
therefore retain `flipY=false`; no runtime upload flip is needed.

```sh
python3 scripts/compress-orbital-textures.py
python3 scripts/compress-orbital-textures.py --verify
npx vitest run src/tests/unit/orbital-ktx2.test.ts
node scripts/verify-ktx2-browser.mjs
```

The encoder is extracted under `/tmp`, without installing a system package.
`TOKTX_PATH` can point to an already installed encoder of the same version.
Offline `--verify` checks all source hashes, KTX2 headers, mip payload bounds,
output hashes, color descriptors, and local transcoder hashes. Every produced
file also passed the actual official `ktx2check --warn-as-error` command.

| Quantity | Bytes | Evidence |
| --- | ---: | --- |
| JPEG fallback image downloads | 1,783,030 | Actual file sizes |
| KTX2 image downloads | 6,714,783 | Actual file sizes |
| Local Basis transcoder JS + WASM | 584,862 | Actual file sizes |
| Decoded BC7 mip payloads, nine maps | 12,583,152 | Measured from actual Chromium decoded mip buffers |
| Equivalent RGBA8 mip payloads, nine maps | 50,331,636 | Calculated estimate, not measured driver allocation |

The high-quality UASTC files are **larger over the network** than these JPEGs.
Their benefit is precomputed mipmaps and approximately 75% less texture payload
on GPUs that choose BC7/ASTC 4×4, rather than a claim of faster downloads.
Device-specific compressed format choice and driver allocation overhead vary.
GPUs without a supported compressed format can require an RGBA8 fallback.

The actual lightweight browser harness loaded all nine files through the
installed Three.js `KTX2Loader` in Chromium **158.0.8127.18** with SwiftShader.
All nine transcoded to `RGBA_BPTC_Format` (BC7), with all eleven mip levels and
correct sRGB/linear declarations. Real framebuffer samples verified that XYZ
normals retain their blue component. This is an actual decoder/GPU-format test,
not a whole-scene FPS or physical-device performance measurement.

Evidence:

- `evidence/orbital/ktx2-browser.json`
- `evidence/orbital/ktx2-browser.png`
- `public/assets/orbital/materials/compression-manifest.json`

The Basis transcoder is copied from `three@0.187.0/examples/jsm/libs/basis` and
served locally from `public/assets/basis/`. Its Apache-2.0 license, the package's
Three.js MIT license, original README, and exact file hashes are retained.
