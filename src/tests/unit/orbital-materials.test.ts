import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface TextureRecord {
  semantic: string; file: string; bytes: number; sha256: string;
  width: number; height: number; upstreamMapSha256: string; upstreamArchiveMember: string; colorSpace: string;
}
interface MaterialRecord {
  id: string; asset: string; license: string; source: string; archiveSha256: string; maps: TextureRecord[];
}
const directory = resolve('public/assets/orbital/materials');
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')) as {
  materials: MaterialRecord[]; deployedTextureBytes: number; license: string; licenseSource: string;
};

describe('licensed orbital PBR material delivery', () => {
  it('preserves source provenance and a bounded three-set desktop/mobile texture budget', () => {
    expect(manifest.license).toBe('CC0-1.0');
    expect(manifest.licenseSource).toBe('https://docs.ambientcg.com/license/');
    expect(manifest.materials.map(material => material.asset)).toEqual(['Concrete048', 'Metal009', 'Metal047B']);
    expect(manifest.deployedTextureBytes).toBeLessThan(4 * 1024 * 1024);
    let bytes = 0;
    for (const material of manifest.materials) {
      expect(material.license).toBe('CC0-1.0');
      expect(material.source).toBe(`https://ambientcg.com/a/${material.asset}`);
      expect(material.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(material.maps.map(map => map.semantic)).toEqual(['albedo', 'roughness', 'normal']);
      for (const map of material.maps) bytes += map.bytes;
    }
    expect(bytes).toBe(manifest.deployedTextureBytes);
  });

  it('ships actual complete 1K JPEG maps matching every recorded hash and correct data color space', () => {
    for (const material of manifest.materials) for (const map of material.maps) {
      const data = readFileSync(resolve(directory, map.file));
      expect(data.length, map.file).toBe(map.bytes);
      expect([...data.subarray(0, 2)], map.file).toEqual([0xff, 0xd8]);
      expect([...data.subarray(-2)], map.file).toEqual([0xff, 0xd9]);
      expect(createHash('sha256').update(data).digest('hex'), map.file).toBe(map.sha256);
      expect([map.width, map.height], map.file).toEqual([1024, 1024]);
      expect(map.upstreamMapSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(map.colorSpace).toBe(map.semantic === 'albedo' ? 'sRGB' : 'linear data');
      if (map.semantic === 'normal') expect(map.upstreamArchiveMember).toContain('NormalGL');
    }
  });
});
