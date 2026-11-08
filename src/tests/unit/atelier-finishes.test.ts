import { readFileSync, readdirSync } from 'node:fs';
import { Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { architecturalRole, FINISHES } from '../../engine/rendering/ArchitecturalFinish';
import { createOrbitalEnvelope } from '../../chapter/assets/OrbitalArchitecture';
import { OrbitalMaterials } from '../../chapter/assets/OrbitalMaterials';

it('covers every authored chapter and streaming-cell material, including envelope aliases', () => {
  const paths = ['public/assets/v02/vestibule.glb', 'public/assets/v02/invert.glb',
    ...readdirSync('public/assets/orbital/architecture').filter(p => p.endsWith('.glb')).map(p => 'public/assets/orbital/architecture/' + p)];
  const names = new Set<string>();
  for (const path of paths) {
    const bytes = readFileSync(path);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { materials: { name: string }[] };
    for (const m of gltf.materials) { names.add(m.name); expect(architecturalRole(m.name), `${path}: ${m.name}`).not.toBeNull(); }
  }
  expect(names.has('mineral')).toBe(true);
  expect(architecturalRole('orbital-envelope-metal')).toBe('metal');
  expect(architecturalRole('orbital-proxy-bronze.001')).toBe('bronze');
  expect(architecturalRole('unknown-placeholder')).toBeNull();
  expect(FINISHES.mineral.metalness).toBe(0);
  expect(FINISHES.metal.metalness).toBeGreaterThan(.9);
});

it('upgrades every real envelope batch once and preserves shared material ownership', () => {
  const root = createOrbitalEnvelope(new Vector3());
  const library = new OrbitalMaterials();
  library.apply(root);
  const first: MeshStandardMaterial[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const m = object.material as MeshStandardMaterial;
    expect(m.userData.sharedOrbitalPBR, object.name).toBe(true);
    expect(m.userData.finishRole, object.name).toBeTruthy();
    first.push(m);
    if (m.userData.finishRole === 'glass') { expect(object.castShadow).toBe(false); expect(m.depthWrite).toBe(false); }
  });
  const size = library.snapshot().sharedMaterials;
  library.apply(root);
  const second: MeshStandardMaterial[] = [];
  root.traverse(object => { if (object instanceof Mesh) second.push(object.material as MeshStandardMaterial); });
  expect(second).toEqual(first); expect(library.snapshot().sharedMaterials).toBe(size);
  root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
  library.dispose();
});
