#!/usr/bin/env python3
"""Create real mipmapped UASTC KTX2 PBR textures using pinned Khronos tools.

Python standard library only. On Linux x86_64 the official encoder is verified
and extracted into /tmp without installing a system package. --verify needs no
network or encoder. JPEG originals remain available as a runtime fallback.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
import os
from pathlib import Path
import platform
import struct
import subprocess
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/orbital/materials"
VERSION = "4.4.2"
PACKAGE_URL = f"https://github.com/KhronosGroup/KTX-Software/releases/download/v{VERSION}/KTX-Software-{VERSION}-Linux-x86_64.deb"
# Published GitHub release asset digest, verified against the downloaded file.
PACKAGE_SHA256 = "ca635ed489d8bf54fac8d7687056c651193de0740830a7738cc034adc63e3027"
TOOL_ROOT = Path(f"/tmp/threshold-ktx-{VERSION}")
PACKAGE = Path(f"/tmp/KTX-Software-{VERSION}-Linux-x86_64.deb")
MANIFEST = OUTPUT / "compression-manifest.json"
KTX_MAGIC = b"\xabKTX 20\xbb\r\n\x1a\n"
BASIS_LICENSE_URL = "https://raw.githubusercontent.com/BinomialLLC/basis_universal/2e18939796bfb0784e30d4ec0eb69a0554391b7c/LICENSE"
BASIS_LICENSE_SHA256 = "065fcf48d6af21c0b75e23be5ed5753aee75c892e1c2cf178fa6736305614a5c"


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def tool_path() -> Path:
    specified = os.environ.get("TOKTX_PATH")
    if specified:
        encoder = Path(specified).resolve()
    else:
        if platform.system() != "Linux" or platform.machine() not in ("x86_64", "AMD64"):
            raise RuntimeError("Automatic encoder extraction requires Linux x86_64; provide TOKTX_PATH for pinned toktx v4.4.2 on other platforms")
        if not PACKAGE.exists():
            request = Request(PACKAGE_URL, headers={"User-Agent": "THRESHOLD-KTX2-pipeline/1.0"})
            with urlopen(request, timeout=120) as response:
                PACKAGE.write_bytes(response.read())
        if digest(PACKAGE.read_bytes()) != PACKAGE_SHA256:
            raise RuntimeError("Official KTX encoder package SHA-256 mismatch")
        encoder = TOOL_ROOT / "usr/bin/toktx"
        if not encoder.exists():
            subprocess.run(["dpkg-deb", "-x", str(PACKAGE), str(TOOL_ROOT)], check=True)
    version_result = subprocess.run([str(encoder), "--version"], check=True, capture_output=True, text=True)
    version = (version_result.stdout + version_result.stderr).strip()
    if version != f"toktx v{VERSION}":
        raise RuntimeError(f"Unsupported encoder: {version}; expected toktx v{VERSION}")
    return encoder


def read_header(data: bytes) -> dict:
    if data[:12] != KTX_MAGIC or len(data) < 80:
        raise RuntimeError("Not a complete KTX 2.0 file")
    values = struct.unpack_from("<13I2Q", data, 12)
    vk_format, type_size, width, height, depth, layers, faces, levels, supercompression, dfd_offset, dfd_length, kvd_offset, kvd_length, sgd_offset, sgd_length = values
    if (vk_format, type_size, width, height, depth, layers, faces, levels, supercompression) != (0, 1, 1024, 1024, 0, 0, 1, 11, 2):
        raise RuntimeError(f"Unexpected UASTC/mipmap header: {values[:9]}")
    if dfd_offset + dfd_length > len(data) or dfd_length < 28:
        raise RuntimeError("Invalid KTX2 data format descriptor")
    color_model, primaries, transfer, flags = struct.unpack_from("4B", data, dfd_offset + 12)
    if color_model != 166:
        raise RuntimeError(f"Expected UASTC DFD model 166, got {color_model}")
    mips = []
    for level in range(levels):
        offset, length, uncompressed_length = struct.unpack_from("<3Q", data, 80 + level * 24)
        if length <= 0 or offset + length > len(data):
            raise RuntimeError(f"Invalid mip level {level}")
        mips.append({"level": level, "width": max(1, width >> level), "height": max(1, height >> level),
                     "encodedBytes": length, "uastcBytes": uncompressed_length})
    metadata = data[kvd_offset:kvd_offset + kvd_length]
    if b"KTXorientation\x00ru" not in metadata:
        raise RuntimeError("Expected physically lower-left-oriented texture matching the previous TextureLoader flipY upload")
    return {"width": width, "height": height, "mipLevels": levels, "supercompression": "Zstandard",
            "dfdColorModel": color_model, "dfdPrimaries": primaries, "dfdTransferFunction": transfer,
            "dfdFlags": flags, "orientation": "ru", "mips": mips}


def gpu_estimates(header: dict) -> dict:
    # Bounds are estimates for texture payload only, not total device memory.
    mip_sizes = [(mip["width"], mip["height"]) for mip in header["mips"]]
    rgba = sum(width * height * 4 for width, height in mip_sizes)
    blocks = sum(((width + 3) // 4) * ((height + 3) // 4) for width, height in mip_sizes)
    return {"RGBA8Mipmapped": rgba, "ASTC4x4OrBC7Mipmapped": blocks * 16,
            "ETC2RGBMipmapped": blocks * 8,
            "note": "Estimated block payload bytes, excluding driver allocations. Runtime actual compressed format and mip payloads are measured separately; unsupported GPUs may use RGBA8 fallback."}


def encode(item: tuple[Path, dict], encoder: Path) -> dict:
    source, source_record = item
    if digest(source.read_bytes()) != source_record["sha256"]:
        raise RuntimeError(f"Source JPEG hash mismatch: {source.name}")
    semantic = source_record["semantic"]
    destination = source.with_suffix(".ktx2")
    arguments = ["--t2", "--genmipmap", "--encode", "uastc", "--uastc_quality", "3",
                 "--uastc_rdo_l", "0.25" if semantic == "normal" else "1",
                 "--uastc_rdo_m", "--zcmp", "18", "--threads", "2",
                 "--lower_left_maps_to_s0t0", "--assign_oetf", "srgb" if semantic == "albedo" else "linear",
                 "--assign_primaries", "bt709" if semantic == "albedo" else "none"]
    if semantic == "normal":
        # Preserve XYZ for Three MeshStandardMaterial.normalMap. --normal_mode
        # alone would repack XY into RGB/A and require a custom reconstruction.
        arguments.extend(["--normal_mode", "--normalize", "--input_swizzle", "rgb1"])
    environment = {key: value for key, value in os.environ.items() if key != "TOKTX_OPTIONS"}
    subprocess.run([str(encoder), *arguments, str(destination), str(source)], check=True,
                   capture_output=True, text=True, env=environment)
    validator = encoder.with_name("ktx2check")
    subprocess.run([str(validator), "--warn-as-error", str(destination)], check=True, capture_output=True, text=True)
    data = destination.read_bytes()
    header = read_header(data)
    expected_transfer = 2 if semantic == "albedo" else 1
    expected_primaries = 1 if semantic == "albedo" else 0
    if header["dfdTransferFunction"] != expected_transfer or header["dfdPrimaries"] != expected_primaries:
        raise RuntimeError(f"Incorrect color encoding in {destination.name}")
    return {"file": destination.name, "semantic": semantic, "bytes": len(data), "sha256": digest(data),
            "source": source.name, "sourceSha256": source_record["sha256"], "encoderArguments": arguments,
            "validation": "ktx2check --warn-as-error passed", "header": header,
            "estimatedGpuPayloadBytes": gpu_estimates(header)}


def copy_transcoder() -> dict:
    source = ROOT / "node_modules/three/examples/jsm/libs/basis"
    destination = ROOT / "public/assets/basis"
    destination.mkdir(parents=True, exist_ok=True)
    files = []
    for name in ["basis_transcoder.js", "basis_transcoder.wasm", "README.md"]:
        data = (source / name).read_bytes()
        (destination / name).write_bytes(data)
        files.append({"file": name, "bytes": len(data), "sha256": digest(data)})
    license_file = destination / "LICENSE"
    if license_file.exists():
        license_bytes = license_file.read_bytes()
    else:
        request = Request(BASIS_LICENSE_URL, headers={"User-Agent": "THRESHOLD-KTX2-pipeline/1.0"})
        with urlopen(request, timeout=45) as response:
            license_bytes = response.read()
    if digest(license_bytes) != BASIS_LICENSE_SHA256:
        raise RuntimeError("Pinned Basis Universal Apache-2.0 license hash mismatch")
    license_file.write_bytes(license_bytes)
    files.append({"file": "LICENSE", "bytes": len(license_bytes), "sha256": digest(license_bytes)})
    three_license = (ROOT / "node_modules/three/LICENSE").read_bytes()
    (destination / "THREE-LICENSE").write_bytes(three_license)
    files.append({"file": "THREE-LICENSE", "bytes": len(three_license), "sha256": digest(three_license)})
    package = json.loads((ROOT / "node_modules/three/package.json").read_text())
    return {"source": f"three@{package['version']}/examples/jsm/libs/basis", "license": "Apache-2.0",
            "licenseSource": "https://github.com/BinomialLLC/basis_universal/blob/2e18939796bfb0784e30d4ec0eb69a0554391b7c/LICENSE",
            "files": files}


def verify() -> None:
    manifest = json.loads(MANIFEST.read_text())
    for texture in manifest["textures"]:
        data = (OUTPUT / texture["file"]).read_bytes()
        if digest(data) != texture["sha256"] or len(data) != texture["bytes"]:
            raise RuntimeError(f"KTX2 hash/size mismatch: {texture['file']}")
        if read_header(data) != texture["header"]:
            raise RuntimeError(f"KTX2 header/mipmap mismatch: {texture['file']}")
        if digest((OUTPUT / texture["source"]).read_bytes()) != texture["sourceSha256"]:
            raise RuntimeError(f"Source JPEG mismatch: {texture['source']}")
    for record in manifest["transcoder"]["files"]:
        data = (ROOT / "public/assets/basis" / record["file"]).read_bytes()
        if digest(data) != record["sha256"]:
            raise RuntimeError(f"Local transcoder hash mismatch: {record['file']}")
    print(f"PASS: {len(manifest['textures'])} validated mipmapped UASTC KTX2 files, {manifest['ktx2Bytes']:,} transferred texture bytes; JPEG+KTX2+local transcoder hashes verified offline")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.verify:
        verify()
        return
    encoder = tool_path()
    sources = json.loads((OUTPUT / "manifest.json").read_text())
    records = [(OUTPUT / entry["file"], entry) for material in sources["materials"] for entry in material["maps"]]
    with ThreadPoolExecutor(max_workers=2) as executor:
        textures = list(executor.map(lambda item: encode(item, encoder), records))
    transcoder = copy_transcoder()
    estimate_keys = ["RGBA8Mipmapped", "ASTC4x4OrBC7Mipmapped", "ETC2RGBMipmapped"]
    manifest = {"version": 1, "generator": "scripts/compress-orbital-textures.py", "format": "KTX2/UASTC + Zstandard",
                "encoder": {"version": VERSION, "officialPackage": PACKAGE_URL, "officialPackageSha256": PACKAGE_SHA256,
                            "binarySha256": digest(encoder.read_bytes())},
                "ktx2Bytes": sum(texture["bytes"] for texture in textures),
                "jpegFallbackBytes": sources["deployedTextureBytes"],
                "estimatedGpuPayloadBytes": {key: sum(texture["estimatedGpuPayloadBytes"][key] for texture in textures) for key in estimate_keys},
                "estimatesNote": "Texture payload estimates only. These are not measured GPU allocation statistics or FPS. Actual runtime transcoding depends on WebGL compressed-texture extensions. JPEG is smaller over the network in this dataset; KTX2 adds offline mipmaps and reduces supported GPU residency.",
                "transcoder": transcoder, "textures": textures}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    verify()


if __name__ == "__main__":
    main()
