import {
  AdditiveBlending, BackSide, BufferGeometry, Color, DoubleSide,
  Float32BufferAttribute, Group, Mesh, Points, PointsMaterial, RingGeometry,
  ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3,
  type Texture,
} from 'three';

/** An authored orbital vista, not an astronomically scaled solar system. */
export const ORBITAL_BODIES = [
  { id: 'AUREOLE', label: '环冠 / AUREOLE', map: 'saturn.jpg', position: [-105, 104, -222], radius: 64, speed: .007, tint: 0xf6e5c8, atmosphere: 0xcbbca3, ring: true },
  { id: 'PELAGIC', label: '深蓝 / PELAGIC', map: 'neptune.jpg', position: [162, 81, -285], radius: 31, speed: -.011, tint: 0xa6d5fa, atmosphere: 0x77b5f0, ring: false },
  { id: 'EMBER', label: '余烬 / EMBER', map: 'mars.jpg', position: [76, 37, 162], radius: 19, speed: .014, tint: 0xe4b69a, atmosphere: 0xd3a183, ring: false },
  { id: 'SELENE', label: '静月 / SELENE', map: 'moon.jpg', position: [-94, 26, 71], radius: 13, speed: .004, tint: 0xe5e4d9, atmosphere: 0x9daeb7, ring: false },
  { id: 'MOON-01', label: '01', map: 'moon.jpg', position: [-32, 34, -125], radius: 4.4, speed: .008, tint: 0xc4c1b9, atmosphere: 0x838a9c, ring: false },
  { id: 'MOON-02', label: '02', map: 'moon.jpg', position: [-202, 58, -87], radius: 6.8, speed: -.006, tint: 0xb3c0cc, atmosphere: 0x8bafc6, ring: false },
  { id: 'MOON-03', label: '03', map: 'mars.jpg', position: [286, 120, -100], radius: 5.9, speed: .008, tint: 0xb2a99e, atmosphere: 0x929bb6, ring: false },
  { id: 'MOON-04', label: '04', map: 'moon.jpg', position: [165, 182, 180], radius: 7.2, speed: .005, tint: 0xc9cfd4, atmosphere: 0x9baebe, ring: false },
  { id: 'MOON-05', label: '05', map: 'moon.jpg', position: [-264, 169, 142], radius: 9.1, speed: -.007, tint: 0xb9c4cb, atmosphere: 0x8ba7c9, ring: false },
  { id: 'MOON-06', label: '06', map: 'mars.jpg', position: [34, 249, -306], radius: 6.6, speed: .006, tint: 0xd6c5ad, atmosphere: 0xab9c8b, ring: false },
  { id: 'MOON-07', label: '07', map: 'neptune.jpg', position: [-338, 48, -287], radius: 8.7, speed: -.005, tint: 0xb5cad7, atmosphere: 0x7eaccb, ring: false },
] as const;

const vertexShader = /* glsl */ `
#include <clipping_planes_pars_vertex>
varying vec2 vOrbitalUv;
varying vec3 vOrbitalNormal;
varying vec3 vOrbitalPosition;
void main() {
  vOrbitalUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vOrbitalPosition = world.xyz;
  vOrbitalNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const planetFragment = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform sampler2D uMap;
uniform sampler2D uRing;
uniform vec3 uTint;
uniform vec3 uSun;
uniform vec3 uCenter;
uniform vec3 uRingNormal;
uniform float uRadius;
uniform float uHasRing;
varying vec2 vOrbitalUv;
varying vec3 vOrbitalNormal;
varying vec3 vOrbitalPosition;
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vOrbitalNormal);
  float illumination = max(dot(n, uSun), 0.0);
  float shadow = 1.0;
  float denom = dot(uSun, uRingNormal);
  if (uHasRing > 0.5 && abs(denom) > 0.001) {
    float t = -dot(vOrbitalPosition-uCenter, uRingNormal) / denom;
    float radial = length(vOrbitalPosition + uSun*t - uCenter) / uRadius;
    if (t > 0.0 && radial > 1.23 && radial < 2.24) {
      float density = texture2D(uRing, vec2((radial-1.23)/1.01, 0.5)).a;
      shadow = 1.0 - density * 0.66;
    }
  }
  vec3 albedo = texture2D(uMap, vOrbitalUv).rgb * uTint;
  // Low blue bounce preserves a credible night side without flattening the terminator.
  vec3 bounce = vec3(0.018, 0.026, 0.041);
  vec3 lit = albedo * (bounce + 1.35 * illumination * shadow);
  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const atmosphereFragment = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform vec3 uSun;
varying vec3 vOrbitalNormal;
varying vec3 vOrbitalPosition;
void main() {
  #include <clipping_planes_fragment>
  vec3 n = normalize(vOrbitalNormal);
  vec3 viewDir = normalize(cameraPosition-vOrbitalPosition);
  float rim = pow(1.0-abs(dot(n,viewDir)), 4.2);
  float daylight = smoothstep(-0.35, 0.85, dot(n,uSun));
  gl_FragColor = vec4(uColor * (0.4+daylight*0.6), rim*(0.12+daylight*0.36));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ringFragment = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform sampler2D uMap;
uniform vec3 uSun;
uniform vec3 uCenter;
uniform float uRadius;
varying vec2 vOrbitalUv;
varying vec3 vOrbitalNormal;
varying vec3 vOrbitalPosition;
void main() {
  #include <clipping_planes_fragment>
  vec4 band = texture2D(uMap, vOrbitalUv);
  if (band.a < 0.05) discard;
  vec3 towardsCenter = uCenter-vOrbitalPosition;
  float t = dot(towardsCenter,uSun);
  float d = length(towardsCenter-uSun*t);
  float planetaryShadow = t > 0.0 ? smoothstep(uRadius*0.98,uRadius*1.02,d) : 1.0;
  float light = 0.15+0.95*abs(dot(normalize(vOrbitalNormal),uSun))*planetaryShadow;
  gl_FragColor = vec4(band.rgb*light,band.a*0.86);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface OrbitalSky {
  group: Group;
  update(elapsed: number, returned: boolean): void;
  dispose(): void;
  diagnostics(): {
    bodies: number; stars: number; textureCount: number; textureBytes: number;
    triangles: number; elapsed: number; returned: boolean; heroRotation: number;
    positions: { id: string; position: number[]; radius: number }[];
  };
}

/** Seeded stars avoid asset/network cost and stay repeatable in visual tests. */
function makeStars(): Points {
  const positions: number[] = [], colors: number[] = [];
  let seed = 0x7a12a95;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < 1900; i++) {
    const y = random() * 2 - 1, a = random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.push(Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900);
    const intensity = Math.pow(random(), 3) * .55 + .12;
    const warmth = random();
    colors.push(intensity * (warmth > .8 ? 1.1 : .8), intensity * .94, intensity * (warmth > .8 ? .8 : 1.12));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new PointsMaterial({ size: 1.15, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
  material.toneMapped = false;
  const stars = new Points(geometry, material);
  stars.name = 'ORBITAL_SEEDED_STARS';
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  return stars;
}

/**
 * Locally hosted CC BY 4.0 maps. All resources are allocated once; update only
 * rotates sphere meshes. No extra animation loop, light, render target or pass.
 * Parent renderer must use camera.far >= 1500 and a near-black A background.
 */
export async function loadOrbitalSky(baseURL: string, offset: Vector3): Promise<OrbitalSky> {
  const loader = new TextureLoader();
  const names = ['saturn.jpg', 'moon.jpg', 'neptune.jpg', 'mars.jpg', 'saturn-ring.png'];
  const results = await Promise.allSettled(names.map(name => loader.loadAsync(`${baseURL.replace(/\/?$/, '/')}assets/orbital/space/${name}`)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') {
    for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
    throw new Error(`Orbital planet texture could not be loaded: ${String(failed.reason)}`);
  }
  const loaded = results.map(result => (result as PromiseFulfilledResult<Texture>).value);
  const textures = new Map<string, Texture>();
  names.forEach((name, i) => {
    const texture = loaded[i]; texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4; texture.name = `SSS-${name}`; textures.set(name, texture);
  });
  const group = new Group(); group.name = 'ORBITAL_VISTA'; group.position.copy(offset);
  const stars = makeStars(); group.add(stars);
  const materials: ShaderMaterial[] = [], geometries: BufferGeometry[] = [];
  const bodies: Mesh[] = [];
  const sun = new Vector3(-.62, .49, .61).normalize();
  const ringNormal = new Vector3(-.24, .80, .55).normalize();
  for (const body of ORBITAL_BODIES) {
    const center = new Vector3().fromArray(body.position).add(offset);
    const anchor = new Group(); anchor.name = `ORBITAL_${body.id}`;
    anchor.position.fromArray(body.position);
    anchor.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), body.ring ? ringNormal : new Vector3(.08, 1, .12).normalize());
    const segments = body.ring ? 80 : body.radius > 12 ? 48 : 24;
    const geometry = new SphereGeometry(body.radius, segments, Math.round(segments * .6)); geometries.push(geometry);
    const material = new ShaderMaterial({
      name: `ORBITAL_PLANET_${body.id}`, vertexShader, fragmentShader: planetFragment, fog: false, clipping: true,
      uniforms: {
        uMap: { value: textures.get(body.map) }, uRing: { value: textures.get('saturn-ring.png') },
        uTint: { value: new Color(body.tint) }, uSun: { value: sun }, uCenter: { value: center },
        uRingNormal: { value: ringNormal }, uRadius: { value: body.radius }, uHasRing: { value: body.ring ? 1 : 0 },
      },
    });
    materials.push(material);
    const mesh = new Mesh(geometry, material); mesh.name = `ORBITAL_SURFACE_${body.id}`;
    mesh.rotation.y = body.id === 'AUREOLE' ? 1.4 : .71 * bodies.length;
    mesh.userData.orbitalSpeed = body.speed; mesh.userData.initialRotation = mesh.rotation.y;
    bodies.push(mesh); anchor.add(mesh);
    if (body.radius > 12) {
      const shellGeometry = new SphereGeometry(body.radius * 1.027, 48, 28); geometries.push(shellGeometry);
      const shellMaterial = new ShaderMaterial({
        name: `ORBITAL_ATMOSPHERE_${body.id}`, vertexShader, fragmentShader: atmosphereFragment,
        side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false, clipping: true,
        uniforms: { uColor: { value: new Color(body.atmosphere) }, uSun: { value: sun } },
      });
      materials.push(shellMaterial);
      const shell = new Mesh(shellGeometry, shellMaterial); shell.name = `ORBITAL_RIM_${body.id}`; anchor.add(shell);
    }
    if (body.ring) {
      const ringGeometry = new RingGeometry(body.radius * 1.23, body.radius * 2.24, 192, 1);
      const positions = ringGeometry.getAttribute('position'), uv = ringGeometry.getAttribute('uv');
      for (let i = 0; i < positions.count; i++) {
        const radius = Math.hypot(positions.getX(i), positions.getY(i));
        uv.setXY(i, (radius / body.radius - 1.23) / 1.01, .5);
      }
      geometries.push(ringGeometry);
      const ringMaterial = new ShaderMaterial({
        name: 'ORBITAL_RING_DENSITY', vertexShader, fragmentShader: ringFragment,
        side: DoubleSide, transparent: true, depthWrite: false, fog: false, clipping: true,
        uniforms: { uMap: { value: textures.get('saturn-ring.png') }, uSun: { value: sun }, uCenter: { value: center }, uRadius: { value: body.radius } },
      });
      materials.push(ringMaterial);
      const rings = new Mesh(ringGeometry, ringMaterial); rings.name = 'ORBITAL_AUREOLE_RINGS'; rings.rotation.x = -Math.PI / 2;
      anchor.add(rings);
    }
    group.add(anchor);
  }
  let lastElapsed = 0, lastReturned = false, disposed = false;
  return {
    group,
    update(elapsed, returned) {
      if (disposed || !Number.isFinite(elapsed)) return;
      lastElapsed = elapsed; lastReturned = returned;
      for (const mesh of bodies) mesh.rotation.y = Number(mesh.userData.initialRotation) + elapsed * Number(mesh.userData.orbitalSpeed);
      // The architectural response owns the large light change; the sky stays stable.
    },
    diagnostics() {
      return {
        bodies: ORBITAL_BODIES.length, stars: 1900, textureCount: loaded.length,
        textureBytes: 2258031, triangles: geometries.reduce((n, g) => n + (g.index?.count ?? g.getAttribute('position').count) / 3, 0),
        elapsed: lastElapsed, returned: lastReturned, heroRotation: bodies[0].rotation.y,
        positions: ORBITAL_BODIES.map(body => ({ id: body.id, position: [...body.position], radius: body.radius })),
      };
    },
    dispose() {
      if (disposed) return; disposed = true;
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); loaded.forEach(t => t.dispose());
      stars.geometry.dispose(); (stars.material as PointsMaterial).dispose();
      group.clear(); group.removeFromParent();
    },
  };
}
