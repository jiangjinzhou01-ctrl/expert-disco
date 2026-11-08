import type { MeshStandardMaterial } from 'three';
import { trackFinishResources } from './FinishResources';

/** Metres, linear-light shading and authored material roles. No geometry or
 * collider displacement: the CR1 contact surface remains exactly the same. */
export const FINISHES = {
  mineral: { color: 0xddd6c6, set: 'concrete', roughness: .97, metalness: 0, clearcoat: 0, pattern: 1 },
  limestone: { color: 0xded0b5, set: 'concrete', roughness: .76, metalness: 0, clearcoat: .16, pattern: 2 },
  cold: { color: 0x9eafb0, set: 'metal', roughness: .62, metalness: .45, clearcoat: .22, pattern: 3 },
  obsidian: { color: 0x1e292c, set: 'metal', roughness: .43, metalness: .7, clearcoat: .18, pattern: 0 },
  basalt: { color: 0x384345, set: 'concrete', roughness: .87, metalness: .05, clearcoat: 0, pattern: 1 },
  copper: { color: 0xc6a174, set: 'copper', roughness: .46, metalness: .92, clearcoat: .12, pattern: 0 },
  metal: { color: 0xa6b1b4, set: 'metal', roughness: .51, metalness: .93, clearcoat: .12, pattern: 3 },
  bronze: { color: 0xb59668, set: 'copper', roughness: .45, metalness: .9, clearcoat: .12, pattern: 0 },
} as const;
export type FinishRole = keyof typeof FINISHES;
export type ArchitecturalRole = FinishRole | 'glass' | 'luminous' | 'cool-luminous';

export function architecturalRole(name: string): ArchitecturalRole | null {
  const role = name.toLowerCase().replace(/^orbital-(?:proxy-|envelope-|pbr-)/, '').replace(/\.\d+$/, '');
  return role in FINISHES || ['glass', 'luminous', 'cool-luminous'].includes(role) ? role as ArchitecturalRole : null;
}

/** Screen-derivative antialiasing keeps millimetre joints stable at oblique
 * angles. Surface coordinates are world-space, including instanced transforms;
 * walking onto the wall cannot make a pattern follow the camera. */
export function installArchitecturalFinish(material: MeshStandardMaterial, role: FinishRole): void {
  const pattern = FINISHES[role].pattern;
  material.customProgramCacheKey = () => `threshold-atelier-4:pattern-${pattern}`;
  material.onBeforeCompile = (shader, renderer) => {
    trackFinishResources(renderer, shader.uniforms);
    shader.vertexShader = `varying vec3 vAtelierPosition; varying vec3 vAtelierNormal;\n${shader.vertexShader}`
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 atelierWorld = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          atelierWorld = batchingMatrix * atelierWorld;
        #endif
        #ifdef USE_INSTANCING
          atelierWorld = instanceMatrix * atelierWorld;
        #endif
        vAtelierPosition = (modelMatrix * atelierWorld).xyz;
        vAtelierNormal = inverseTransformDirection(transformedNormal, viewMatrix);
      `);
    shader.fragmentShader = `
      varying vec3 vAtelierPosition;
      varying vec3 vAtelierNormal;
      float atelierHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float atelierJoint(vec2 p, vec2 size) {
        vec2 cell = fract(p / size);
        vec2 edge = min(cell, 1.0-cell) * size;
        vec2 aa = max(fwidth(p)*.75, vec2(.0007));
        vec2 line = 1.0-smoothstep(vec2(.002), vec2(.004)+aa, edge);
        return max(line.x,line.y);
      }
      vec3 atelierBump(vec3 n, vec3 surfacePosition, float height) {
        vec3 sx = dFdx(surfacePosition), sy = dFdy(surfacePosition);
        vec3 r1 = cross(sy,n), r2 = cross(n,sx);
        float determinant = dot(sx,r1);
        vec3 gradient = sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
        return normalize(abs(determinant)*n-gradient);
      }
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 atelierN = abs(normalize(vAtelierNormal));
        vec3 atelierWeights = pow(atelierN, vec3(12.0));
        atelierWeights /= max(dot(atelierWeights,vec3(1.0)),.0001);
        vec3 atelierP = vAtelierPosition;
        // Dominant-plane coordinates keep the same metre scale on floor,
        // ceiling and walls. Blend only the joints, never positions across seams.
        vec2 atelierSize = ${pattern === 2 ? 'vec2(1.6,1.6)' : pattern === 3 ? 'vec2(1.2,2.4)' : 'vec2(2.4,1.2)'};
        float atelierSeam = ${pattern === 0 ? '0.0' : `dot(atelierWeights, vec3(
          atelierJoint(atelierP.zy,atelierSize),
          atelierJoint(atelierP.xz,atelierSize),
          atelierJoint(atelierP.xy,atelierSize)))`};
        float atelierVariation = dot(atelierWeights,vec3(
          atelierHash(floor(atelierP.zy/atelierSize)),
          atelierHash(floor(atelierP.xz/atelierSize)),
          atelierHash(floor(atelierP.xy/atelierSize))));
        diffuseColor.rgb *= (1.0-.10*atelierVariation)*(1.0-.38*atelierSeam);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + atelierSeam*.18 + (atelierVariation-.5)*.045,.16,1.0);
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = atelierBump(normal, -vViewPosition, -atelierSeam*.00065);
      `);
  };
}
