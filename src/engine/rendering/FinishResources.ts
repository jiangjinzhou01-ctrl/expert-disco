import type { Texture, WebGLRenderer } from 'three';

type TextureUniform = { value: unknown };
const owners = new Map<WebGLRenderer, Set<TextureUniform>>();
const isTexture = (value: unknown): value is Texture => Boolean(value && typeof value === 'object' && (value as Texture).isTexture);

/** Three r187 assigns its shared DFG integration lookup after onBeforeCompile.
 * Retain the public shader uniform reference, rather than importing a private
 * renderer module or guessing which GPU allocation remains on teardown. */
export function trackFinishResources(renderer: WebGLRenderer, uniforms: Record<string, TextureUniform>): void {
  const lookup = uniforms.dfgLUT;
  if (!lookup) return;
  let references = owners.get(renderer);
  if (!references) { references = new Set(); owners.set(renderer, references); }
  references.add(lookup);
}

/** Other live renderers can share Three's lookup. Only its final registered
 * owner releases it. Scene-owned maps and render targets retain their owners. */
export function releaseFinishResources(renderer: WebGLRenderer): void {
  const references = owners.get(renderer);
  if (!references) return;
  owners.delete(renderer);
  const textures = new Set([...references].map(u => u.value).filter(isTexture));
  for (const texture of textures) {
    const shared = [...owners.values()].some(refs => [...refs].some(u => u.value === texture));
    if (!shared) texture.dispose();
  }
}
