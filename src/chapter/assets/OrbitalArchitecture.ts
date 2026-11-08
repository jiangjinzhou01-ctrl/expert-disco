import {
  Box3, BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial,
  TorusGeometry, Vector3, type BufferGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldId } from '../../scenes/RoomLayout';

type MaterialName = 'metal' | 'bronze' | 'limestone' | 'basalt' | 'glass' | 'luminous' | 'cool-luminous';
type Axis = 'X' | 'Y' | 'Z';
interface ProxyPrimitive {
  type: 'box' | 'cylinder' | 'torus';
  position: number[];
  material: MaterialName;
  size?: number[];
  rotation?: number[];
  radius?: number;
  radius2?: number;
  depth?: number;
  tube?: number;
  axis?: Axis;
}
interface ManifestChunk {
  id: string;
  slot: WorldId;
  description: string;
  file: string;
  bounds: [number[], number[]];
  triangles: number;
  bytes: number;
  drawCalls: number;
  proxy: ProxyPrimitive[];
}
export interface OrbitalArchitectureManifest {
  schema: number;
  license: string;
  author: string;
  totalTriangles: number;
  totalBytes: number;
  replacesVisualMeshes: string[];
  chunks: ManifestChunk[];
}

/** Detailed geometry is not fetched until the visibility/residency owner calls load. */
export interface OrbitalArchitectureChunk {
  id: string;
  slot: WorldId;
  description: string;
  bounds: Box3;
  proxy: Group;
  load: () => Promise<Group>;
  url: string;
  triangles: number;
  bytes: number;
  drawCalls: number;
}

const colors: Record<MaterialName, number> = {
  metal: 0x8b9499,
  bronze: 0xa77a49,
  limestone: 0xb0aaa0,
  basalt: 0x20292f,
  glass: 0x6c9ba8,
  luminous: 0xffc978,
  'cool-luminous': 0x80d9ee,
};

function proxyMaterial(name: MaterialName): MeshStandardMaterial {
  const light = name.endsWith('luminous');
  const glass = name === 'glass';
  return new MeshStandardMaterial({
    name: `orbital-proxy-${name}`,
    color: colors[name],
    metalness: name === 'metal' || name === 'bronze' ? .75 : .15,
    roughness: name === 'limestone' ? .8 : .45,
    transparent: glass,
    opacity: glass ? .1 : 1,
    depthWrite: !glass,
    emissive: light ? colors[name] : 0,
    emissiveIntensity: light ? 1.2 : 0,
  });
}

function makeProxy(chunk: ManifestChunk, offset: Vector3): Group {
  const group = new Group();
  group.name = `${chunk.id}-silhouette`;
  group.position.copy(offset);
  group.userData.orbitalProxy = true;
  const materials = new Map<MaterialName, MeshStandardMaterial>();
  const batches = new Map<MaterialName, BufferGeometry[]>();
  for (const primitive of chunk.proxy) {
    let material = materials.get(primitive.material);
    if (!material) {
      material = proxyMaterial(primitive.material);
      materials.set(primitive.material, material);
    }
    const geometry = primitive.type === 'box'
      ? new BoxGeometry(...primitive.size as [number, number, number])
      : primitive.type === 'cylinder'
        ? new CylinderGeometry(primitive.radius2!, primitive.radius!, primitive.depth!, 10)
        : new TorusGeometry(primitive.radius!, primitive.tube!, 4, 24);
    const mesh = new Mesh(geometry, material);
    mesh.position.fromArray(primitive.position);
    if (primitive.rotation) mesh.rotation.fromArray([...primitive.rotation, 'XYZ'] as [number, number, number, 'XYZ']);
    if (primitive.type === 'cylinder') {
      if (primitive.axis === 'X') mesh.rotation.z = -Math.PI / 2;
      if (primitive.axis === 'Z') mesh.rotation.x = Math.PI / 2;
    } else if (primitive.type === 'torus') {
      if (primitive.axis === 'X') mesh.rotation.y = Math.PI / 2;
      if (primitive.axis === 'Y') mesh.rotation.x = Math.PI / 2;
    }
    mesh.receiveShadow = true;
    mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);
    let batch = batches.get(primitive.material);
    if (!batch) { batch = []; batches.set(primitive.material, batch); }
    // All proxy primitives expose the same indexed position/normal/uv layout.
    batch.push(geometry);
  }
  for (const [name, geometries] of batches) {
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const mesh = new Mesh(merged, materials.get(name));
      mesh.name = `${chunk.id}-proxy-${name}`;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    geometries.forEach(geometry => geometry.dispose());
  }
  return group;
}

const manifests = new Map<string, Promise<OrbitalArchitectureManifest>>();

/**
 * Always-resident physical-envelope silhouette for the open orbital atrium.
 * The opaque baseline wall visuals are replaced, not their Rapier guards.
 * Every opaque piece remains inside the original wall volumes: side X=[16,17]
 * and X=[-17,-16], return Z=[21.6,22.4], gate wall Z=[-20.98,-19.98].
 * The clear four-metre entry and the exact 3.6m x5.6m portal stay open.
 * Four material batches keep this collision-visible fallback inexpensive.
 */
export function createOrbitalEnvelope(offset: Vector3): Group {
  const group = new Group();
  group.name = 'ORBITAL-GLAZED-ENVELOPE';
  group.position.copy(offset);
  group.userData.alwaysResident = true;
  group.userData.role = 'Visible glazing and construction at the retained collision envelope';
  const materials = {
    basalt: new MeshStandardMaterial({name: 'orbital-envelope-basalt', color: 0x202b31, metalness: .35, roughness: .49}),
    metal: new MeshStandardMaterial({name: 'orbital-envelope-metal', color: 0x829198, metalness: .8, roughness: .3}),
    bronze: new MeshStandardMaterial({name: 'orbital-envelope-bronze', color: 0xa97a49, metalness: .85, roughness: .31}),
    glass: new MeshStandardMaterial({name: 'orbital-envelope-glass', color: 0x8eb9c3, metalness: .12, roughness: .19,
      transparent: true, opacity: .045, depthWrite: false, side: DoubleSide}),
  };
  materials.glass.forceSinglePass = true;
  materials.glass.envMapIntensity = .35;
  const batches = new Map<keyof typeof materials, BufferGeometry[]>();
  const add = (name: keyof typeof materials, center: [number,number,number], size: [number,number,number]): void => {
    const geometry = new BoxGeometry(...size);
    geometry.translate(...center);
    let batch = batches.get(name);
    if (!batch) { batch = []; batches.set(name, batch); }
    batch.push(geometry);
  };

  // Side-wall lower pressure sill and top pressure crown.
  for (const sign of [-1, 1]) {
    const x = sign * 16.18;
    add('basalt', [x, .6, 0], [.36, 1.2, 44]);
    add('bronze', [sign * 16.025, 1.24, 0], [.05, .08, 44]);
    add('basalt', [x, 23.86, 0], [.36, .28, 44]);
    // Main piers are retained. Slender window mullions follow their structural bays.
    const stops = [-22, -17, -11, -5, 1, 7, 13, 18, 22];
    for (const z of stops) {
      const postZ = Math.min(21.9, Math.max(-21.9, z));
      add('metal', [sign * 16.13, 12.45, postZ], [.26, 22.5, .13]);
      add('bronze', [sign * 16.015, 2.0, postZ], [.03, 1.1, .18]);
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i] + .07, hi = stops[i + 1] - .07;
      add('glass', [sign * 16.018, 12.48, (lo + hi) / 2], [.025, 22.4, hi - lo]);
    }
    for (const y of [6.4, 12.4, 18.4]) add('metal', [sign * 16.08, y, 0], [.16, .055, 44]);
  }
  // The two entry returns are a visible pressure window on both sides of the
  // original 0.8m guard, with jambs and sills exactly inside its old solid volume.
  for (const sign of [-1, 1]) {
    const center = sign * 9.5;
    add('basalt', [center, .6, 22], [15, 1.2, .8]);
    add('bronze', [center, 1.24, 22], [15, .08, .8]);
    add('basalt', [center, 23.86, 22], [15, .28, .8]);
    const stops = [2.0, 5.4, 9.5, 13.6, 17.0];
    for (let i = 0; i < stops.length; i++) {
      const x = sign * Math.min(16.87, Math.max(2.13, stops[i]));
      add('metal', [x, 12.45, 22], [.26, 22.5, .8]);
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i] + .14, hi = stops[i + 1] - .14;
      add('glass', [sign * (lo + hi) / 2, 12.48, 22], [hi - lo, 22.4, .025]);
    }
    for (const y of [6.4, 12.4, 18.4]) add('metal', [center, y, 22], [15, .055, .8]);
  }
  // Front pressure wall: sky is revealed behind the existing black gate rather
  // than hidden by a 24m white plane. No primitive crosses the live aperture.
  for (const sign of [-1, 1]) {
    const center = sign * 9.15;
    add('basalt', [center, .6, -20.18], [14.7, 1.2, .4]);
    add('bronze', [center, 1.24, -20.08], [14.7, .08, .2]);
    add('basalt', [center, 23.86, -20.18], [14.7, .28, .4]);
    const stops = [1.8, 5, 9, 13, 16.5];
    for (let i = 0; i < stops.length; i++) {
      const x = sign * Math.min(16.37, Math.max(1.93, stops[i]));
      add('metal', [x, 12.45, -20.16], [.26, 22.5, .36]);
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i] + .14, hi = stops[i + 1] - .14;
      add('glass', [sign * (lo + hi) / 2, 12.48, -20.005], [hi - lo, 22.4, .025]);
    }
    for (const y of [6.4, 12.4, 18.4]) add('metal', [center, y, -20.08], [14.7, .055, .2]);
    add('basalt', [sign * 15.8, 12, -20.43], [.36, 24, .7]);
    add('bronze', [sign * 15.57, 12.05, -20.13], [.035, 23.7, .08]);
  }
  // The central upper panel begins above the original Y=6 top-wall collider;
  // the retained black portal crown covers its lower joint at Y5.6..8.
  add('glass', [0, 14.9, -20.005], [3.59, 17.65, .025]);
  add('basalt', [0, 23.86, -20.18], [3.6, .28, .4]);
  for (const y of [12.4, 18.4]) add('metal', [0, y, -20.08], [3.6, .055, .2]);
  for (const [name, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new Mesh(geometry, materials[name]);
    mesh.name = `ORBITAL-ENVELOPE-${name.toUpperCase()}`;
    mesh.castShadow = name !== 'glass';
    mesh.receiveShadow = name !== 'glass';
    if (name === 'glass') mesh.renderOrder = 2;
    group.add(mesh);
  }
  return group;
}

/** Shared small manifest request; all detailed GLBs remain absent until needed. */
export function loadOrbitalArchitectureManifest(baseURL: string): Promise<OrbitalArchitectureManifest> {
  const base = `${baseURL.replace(/\/?$/, '/')}assets/orbital/architecture/`;
  let promise = manifests.get(base);
  if (!promise) {
    promise = fetch(`${base}manifest.json`).then(async response => {
      if (!response.ok) throw new Error(`Orbital construction manifest HTTP ${response.status}`);
      const manifest = await response.json() as OrbitalArchitectureManifest;
      if (manifest.schema !== 1 || !Array.isArray(manifest.chunks)) throw new Error('Unsupported orbital construction manifest');
      return manifest;
    }).catch((error: unknown) => { manifests.delete(base); throw error; });
    manifests.set(base, promise);
  }
  return promise;
}

/**
 * Each proxy and loaded group already includes the supplied physical-world
 * offset. Bounds are likewise WORLD bounds. Chunks are joined by material at
 * authoring time, avoiding one draw per bolt or panel.
 */
export async function loadOrbitalArchitecture(
  baseURL: string,
  slot: WorldId,
  offset: Vector3,
): Promise<OrbitalArchitectureChunk[]> {
  const manifest = await loadOrbitalArchitectureManifest(baseURL);
  const base = `${baseURL.replace(/\/?$/, '/')}assets/orbital/architecture/`;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return manifest.chunks.filter(chunk => chunk.slot === slot).map(chunk => ({
    id: chunk.id,
    slot,
    description: chunk.description,
    bounds: new Box3(new Vector3().fromArray(chunk.bounds[0]), new Vector3().fromArray(chunk.bounds[1])).translate(offset),
    proxy: makeProxy(chunk, offset),
    url: base + chunk.file,
    triangles: chunk.triangles,
    bytes: chunk.bytes,
    drawCalls: chunk.drawCalls,
    load: async () => {
      const { scene } = await loader.loadAsync(base + chunk.file);
      scene.name = `${chunk.id}-detail`;
      scene.position.add(offset);
      scene.userData.orbitalChunk = chunk.id;
      scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        object.castShadow = !(object.material instanceof MeshStandardMaterial && object.material.transparent);
        object.receiveShadow = true;
        if (object.material instanceof MeshStandardMaterial) {
          object.material.envMapIntensity = .6;
          if (object.material.name === 'glass') {
            object.material.transparent = true;
            object.material.opacity = .115;
            object.material.depthWrite = false;
          }
        }
      });
      return scene;
    },
  }));
}
