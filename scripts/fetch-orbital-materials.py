#!/usr/bin/env python3
"""Fetch three explicitly CC0 PBR materials; keep only three 1K GPU inputs.

Run from the repository root with Python 3 + Pillow. The upstream archives are
cached outside the repository. No asset CDN is accessed at application runtime.
`--verify` is entirely offline and checks every checked-in derivative hash.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
from zipfile import ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/assets/orbital/materials"
CACHE = Path("/tmp/threshold-orbital-material-sources")
LICENSE_URL = "https://docs.ambientcg.com/license/"
MATERIALS = [
    {"id": "concrete", "asset": "Concrete048", "role": "pale mineral architectural concrete", "creation": "PBRPhotogrammetry"},
    {"id": "metal", "asset": "Metal009", "role": "brushed metal; tint in the material for dark structural steel", "creation": "PBRProcedural"},
    {"id": "copper", "asset": "Metal047B", "role": "weathered copper for mechanical fittings", "creation": "PBRProcedural"},
]
MAPS = {"albedo": "Color", "roughness": "Roughness", "normal": "NormalGL"}


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "THRESHOLD-orbital-asset-pipeline/1.0"})
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read()


def material(item: dict) -> dict:
    asset = item["asset"]
    archive_name = f"{asset}_1K-JPG.zip"
    url = f"https://ambientcg.com/get?file={archive_name}"
    cached = CACHE / archive_name
    archive = cached.read_bytes() if cached.exists() else download(url)
    cached.write_bytes(archive)
    files = []
    with ZipFile(BytesIO(archive)) as zipped:
        for semantic, upstream_name in MAPS.items():
            expected = f"{asset}_1K-JPG_{upstream_name}.jpg"
            matches = [name for name in zipped.namelist() if Path(name).name == expected]
            if len(matches) != 1:
                raise RuntimeError(f"Expected exactly one {expected}; got {matches}")
            original = zipped.read(matches[0])
            image = Image.open(BytesIO(original)).convert("RGB")
            if image.size != (1024, 1024):
                raise RuntimeError(f"Unexpected upstream dimensions: {expected} {image.size}")
            # Explicit dimensions and quality make regeneration deterministic.
            # Normals retain RGB channels without chroma subsampling.
            encoded = BytesIO()
            image.save(encoded, format="JPEG", quality=92 if semantic == "normal" else 86,
                       subsampling=0 if semantic == "normal" else 2, optimize=True)
            data = encoded.getvalue()
            name = f"{item['id']}-{semantic}.jpg"
            (OUTPUT / name).write_bytes(data)
            files.append({"semantic": semantic, "file": name, "width": 1024, "height": 1024,
                          "bytes": len(data), "sha256": digest(data), "upstreamArchiveMember": matches[0],
                          "upstreamMapSha256": digest(original), "colorSpace": "sRGB" if semantic == "albedo" else "linear data"})
    return {**item, "source": f"https://ambientcg.com/a/{asset}", "download": url,
            "archiveBytes": len(archive), "archiveSha256": digest(archive),
            "license": "CC0-1.0", "licenseSource": LICENSE_URL, "maps": files}


def verify() -> None:
    manifest = json.loads((OUTPUT / "manifest.json").read_text())
    count = 0
    for item in manifest["materials"]:
        for entry in item["maps"]:
            data = (OUTPUT / entry["file"]).read_bytes()
            if digest(data) != entry["sha256"] or len(data) != entry["bytes"]:
                raise RuntimeError(f"Hash/size mismatch: {entry['file']}")
            if Image.open(BytesIO(data)).size != (entry["width"], entry["height"]):
                raise RuntimeError(f"Dimensions mismatch: {entry['file']}")
            count += 1
    print(f"PASS: {count} actual 1K PBR images, {manifest['deployedTextureBytes']:,} deployed bytes; all SHA-256 hashes verified")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.verify:
        verify()
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    license_html = download(LICENSE_URL)
    plain_license = re.sub("<[^>]+>", " ", license_html.decode())
    if "CC0" not in plain_license or "commercial" not in plain_license.lower():
        raise RuntimeError("Official CC0/commercial license could not be verified")
    with ThreadPoolExecutor(max_workers=3) as executor:
        materials = list(executor.map(material, MATERIALS))
    deployed_bytes = sum(entry["bytes"] for item in materials for entry in item["maps"])
    if deployed_bytes > 4 * 1024 * 1024:
        raise RuntimeError(f"Material texture budget exceeded: {deployed_bytes}")
    manifest = {"version": 1, "generator": "scripts/fetch-orbital-materials.py",
                "provider": "ambientCG", "license": "CC0-1.0", "licenseSource": LICENSE_URL,
                "licenseDocumentSha256": digest(license_html), "deployedTextureBytes": deployed_bytes,
                "upstreamArchiveBytes": sum(item["archiveBytes"] for item in materials),
                "note": "Only Color, Roughness, and tangent-space NormalGL maps are deployed. Original 1K images are recompressed as specified in the generator; no 256px synthetic texture or runtime external fetch is used. Upstream archive downloads include unused maps and are larger than deployed textures.",
                "materials": materials}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    verify()


if __name__ == "__main__":
    main()
