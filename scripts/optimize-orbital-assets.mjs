/** Production meshopt pipeline. Never simplifies geometry or touches colliders.
 * Run after build-orbital-assets.py. Raw authored exports stay in assets/source.
 */
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const deployed = resolve(root, 'public/assets/orbital/architecture');
const source = resolve(root, 'assets/source/orbital');
const raw = resolve(source, 'chunks');
await mkdir(raw, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(resolve(deployed, 'manifest.json'), 'utf8'));
const results = [];
const atelierOnly = process.argv.includes('--atelier-only');
function triangles(document) {
  return document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
    .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
}
for (const chunk of manifest.chunks.filter(chunk => !atelierOnly || chunk.id.includes('-atelier-'))) {
  const input = resolve(raw, chunk.file);
  if (atelierOnly) await copyFile(resolve(deployed, chunk.file), input);
  else { try { await stat(input); } catch { await copyFile(resolve(deployed, chunk.file), input); } }
  const sourceBytes = await readFile(input);
  const original = await io.read(input);
  const originalTriangles = triangles(original);
  const originalBounds = getBounds(original.getRoot().listScenes()[0]);
  await original.transform(
    dedup(), weld(), prune({ keepAttributes: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 12,
      quantizeTexcoord: 14, cleanup: false }),
  );
  const output = resolve(deployed, chunk.file);
  await io.write(output, original);
  const decoded = await io.read(output);
  const decodedBounds = getBounds(decoded.getRoot().listScenes()[0]);
  const decodedTriangles = triangles(decoded);
  assert.equal(decodedTriangles, originalTriangles, `${chunk.id}: topology must remain exact`);
  let maximumBoundsError = 0;
  for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
    maximumBoundsError = Math.max(maximumBoundsError, Math.abs(originalBounds[side][axis] - decodedBounds[side][axis]));
  }
  assert(maximumBoundsError < .003, `${chunk.id}: excessive quantization error ${maximumBoundsError}m`);
  const bytes = await readFile(output);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert(gltf.extensionsRequired.includes('EXT_meshopt_compression'), `${chunk.id}: real codec required`);
  const primitives = decoded.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives());
  for (const primitive of primitives) {
    assert(primitive.getAttribute('NORMAL'), `${chunk.id}: authored normals retained`);
    assert(primitive.getAttribute('TEXCOORD_0'), `${chunk.id}: authored metre UVs retained`);
  }
  Object.assign(chunk, {
    bytes: bytes.length,
    sourceBytes: sourceBytes.length,
    sha256: hash(bytes),
    sourceSha256: hash(sourceBytes),
    compression: 'EXT_meshopt_compression',
    maximumBoundsErrorMetres: maximumBoundsError,
  });
  results.push({ id: chunk.id, rawBytes: sourceBytes.length, compressedBytes: bytes.length,
    reductionPercent: 100 * (1 - bytes.length / sourceBytes.length), triangles: decodedTriangles,
    maximumBoundsErrorMetres: maximumBoundsError, sha256: chunk.sha256 });
}
manifest.totalBytes = manifest.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
manifest.totalSourceBytes = manifest.chunks.reduce((sum, chunk) => sum + chunk.sourceBytes, 0);
manifest.compression = {
  format: 'EXT_meshopt_compression',
  tool: '@gltf-transform/cli 4.5.1 / core-functions + meshoptimizer',
  positionBits: 16, normalBits: 12, texcoordBits: 14,
  geometrySimplification: false,
};
const text = JSON.stringify(manifest, null, 2) + '\n';
await writeFile(resolve(deployed, 'manifest.json'), text);
await writeFile(resolve(source, 'construction-manifest.json'), text);
const report = { result: 'PASS', command: 'node scripts/optimize-orbital-assets.mjs',
  note: 'Actual decoded meshopt topology, UV/normal preservation and world-space bounds assertions; no geometry simplification.',
  rawBytes: manifest.totalSourceBytes, compressedBytes: manifest.totalBytes,
  reductionPercent: 100 * (1 - manifest.totalBytes / manifest.totalSourceBytes),
  results };
await writeFile(resolve(source, 'compression-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
