import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface KTXRecord {
  file: string; bytes: number; sha256: string; semantic: string; source: string; sourceSha256: string;
  encoderArguments: string[]; validation: string;
  header: { width: number; height: number; mipLevels: number; dfdTransferFunction: number; dfdPrimaries: number; orientation: string };
}
interface LocalTranscoder { file: string; bytes: number; sha256: string }
const directory = resolve('public/assets/orbital/materials');
const manifest = JSON.parse(readFileSync(resolve(directory, 'compression-manifest.json'), 'utf8')) as {
  encoder: { version: string; officialPackageSha256: string };
  textures: KTXRecord[]; ktx2Bytes: number; jpegFallbackBytes: number;
  transcoder: { source: string; license: string; files: LocalTranscoder[] };
  estimatedGpuPayloadBytes: { RGBA8Mipmapped: number; ASTC4x4OrBC7Mipmapped: number; ETC2RGBMipmapped: number };
};
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('real GPU-compressed PBR texture delivery', () => {
  it('preserves exact pinned encoder provenance and truthful network-versus-GPU payload accounting', () => {
    expect(manifest.encoder.version).toBe('4.4.2');
    expect(manifest.encoder.officialPackageSha256).toBe('ca635ed489d8bf54fac8d7687056c651193de0740830a7738cc034adc63e3027');
    expect(manifest.textures).toHaveLength(9);
    expect(manifest.textures.reduce((sum, texture) => sum + texture.bytes, 0)).toBe(manifest.ktx2Bytes);
    // UASTC was chosen for high visual quality/GPU residency. These artifacts
    // are larger on the wire than JPEG; do not report JPEG byte savings.
    expect(manifest.ktx2Bytes).toBeGreaterThan(manifest.jpegFallbackBytes);
    expect(manifest.estimatedGpuPayloadBytes.ASTC4x4OrBC7Mipmapped).toBeLessThan(manifest.estimatedGpuPayloadBytes.RGBA8Mipmapped * .251);
  });

  it('has valid real KTX2 containers, all eleven offline mip levels, correct data encoding, and unchanged JPEG fallback', () => {
    for (const texture of manifest.textures) {
      const bytes = readFileSync(resolve(directory, texture.file));
      expect(bytes.subarray(0, 12).toString('hex'), texture.file).toBe('ab4b5458203230bb0d0a1a0a');
      expect(sha(bytes), texture.file).toBe(texture.sha256);
      expect(bytes.length, texture.file).toBe(texture.bytes);
      expect([bytes.readUInt32LE(20), bytes.readUInt32LE(24), bytes.readUInt32LE(40), bytes.readUInt32LE(44)], texture.file).toEqual([1024, 1024, 11, 2]);
      const dfd = bytes.readUInt32LE(48);
      expect(bytes[dfd + 12], texture.file).toBe(166); // UASTC, not a renamed JPEG.
      expect(bytes[dfd + 13], texture.file).toBe(texture.semantic === 'albedo' ? 1 : 0);
      expect(bytes[dfd + 14], texture.file).toBe(texture.semantic === 'albedo' ? 2 : 1);
      for (let level = 0; level < 11; level++) {
        const offset = Number(bytes.readBigUInt64LE(80 + level * 24));
        const length = Number(bytes.readBigUInt64LE(88 + level * 24));
        expect(length, `${texture.file} mip ${level}`).toBeGreaterThan(0);
        expect(offset + length, `${texture.file} mip ${level}`).toBeLessThanOrEqual(bytes.length);
      }
      expect(texture.header.orientation).toBe('ru');
      expect(sha(readFileSync(resolve(directory, texture.source)))).toBe(texture.sourceSha256);
      expect(texture.validation).toBe('ktx2check --warn-as-error passed');
      if (texture.semantic === 'normal') {
        expect(texture.encoderArguments).toContain('--normal_mode');
        expect(texture.encoderArguments).toContain('rgb1'); // Preserve XYZ, do not pack Y into alpha.
      }
    }
  });

  it('ships the actual installed Three transcoder and retained licenses as local hashed resources', () => {
    expect(manifest.transcoder.source).toBe('three@0.187.0/examples/jsm/libs/basis');
    expect(manifest.transcoder.license).toBe('Apache-2.0');
    expect(manifest.transcoder.files.map(file => file.file)).toEqual(['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md', 'LICENSE', 'THREE-LICENSE']);
    for (const file of manifest.transcoder.files) {
      const bytes = readFileSync(resolve('public/assets/basis', file.file));
      expect(bytes.length, file.file).toBe(file.bytes);
      expect(sha(bytes), file.file).toBe(file.sha256);
    }
    expect(readFileSync(resolve('public/assets/basis/basis_transcoder.wasm')).subarray(0, 4).toString('hex')).toBe('0061736d');
  });
});
