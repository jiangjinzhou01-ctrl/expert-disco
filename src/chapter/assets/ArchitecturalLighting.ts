import { AmbientLight, DirectionalLight, HemisphereLight, RectAreaLight, UniformsLib, Vector3, type Scene, type Texture } from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { WorldId } from '../../scenes/RoomLayout';

const owners = new Set<string>();
let lookupTextures: Texture[] = [];

export function releaseArchitecturalLighting(key: DirectionalLight): void {
  if (!owners.delete(key.uuid) || owners.size) return;
  for (const texture of lookupTextures) texture.dispose();
  lookupTextures = [];
}

/** A bounded lighting rig, identical on desktop and phone. Two area emitters per
 * world model the large fixtures; one static key shadow map belongs to each
 * scene. No extra animation loop, full-screen bloom or transmission pass. */
export function lightArchitecture(scene: Scene, slot: WorldId, offset: Vector3): DirectionalLight {
  if (!owners.size) {
    RectAreaLightUniformsLib.init();
    // Three r187 exposes these direct Texture entries at runtime, while its
    // ambient UniformsLib type describes only the default uniform collection.
    const library = UniformsLib as unknown as Record<string, Texture>;
    lookupTextures = ['LTC_FLOAT_1', 'LTC_FLOAT_2', 'LTC_HALF_1', 'LTC_HALF_2'].map(name => library[name]);
  }
  scene.add(new HemisphereLight(0xc7dce8, 0x78604b, .46));
  scene.add(new AmbientLight(0xffead4, .045));
  const sun = new DirectionalLight(slot === 'A' ? 0xffe5c3 : 0xffedda, 3.05);
  owners.add(sun.uuid);
  sun.position.copy(offset).add(new Vector3(-18, 32, 10));
  sun.target.position.copy(offset).add(new Vector3(0, 0, -5));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 40, bottom: -40, near: 1, far: 110 });
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .012;
  scene.add(sun, sun.target);

  const fill = new DirectionalLight(0x9cbdd4, .45);
  fill.position.copy(offset).add(new Vector3(16, 13, -18));
  fill.target.position.copy(offset);
  scene.add(fill, fill.target);
  const area = (name: string, color: number, intensity: number, width: number, height: number, position: Vector3, rotation: Vector3) => {
    const light = new RectAreaLight(color, intensity, width, height);
    light.name = name;
    light.position.copy(position).add(offset);
    light.rotation.set(rotation.x, rotation.y, rotation.z);
    scene.add(light);
  };
  if (slot === 'A') {
    area('CAPSULE_CEILING_EMITTER', 0xffddb0, 3.4, 2.8, 11, new Vector3(0, 4.85, 28.5), new Vector3(-Math.PI / 2, 0, 0));
    area('ATRIUM_SKYLIGHT_EMITTER', 0xddebf1, 2.1, 10, 24, new Vector3(0, 21.5, -1), new Vector3(-Math.PI / 2, 0, 0));
  } else {
    area('INVERT_CEILING_EMITTER', 0xcce1e9, 2.5, 12, 22, new Vector3(0, 14, -5), new Vector3(-Math.PI / 2, 0, 0));
    area('INVERT_WALL_WASH', 0xffdcb0, 2.4, 11, 7, new Vector3(-12, 6, -11), new Vector3(0, -Math.PI / 2, 0));
  }
  return sun;
}
