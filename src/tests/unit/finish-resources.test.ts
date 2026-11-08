import { expect, it, vi } from 'vitest';
import { Texture, type WebGLRenderer } from 'three';
import { releaseFinishResources, trackFinishResources } from '../../engine/rendering/FinishResources';

it('releases the deferred shared BRDF lookup only after its last renderer, idempotently', () => {
  const texture = new Texture(), disposed = vi.fn(); texture.addEventListener('dispose', disposed);
  const a = {} as WebGLRenderer, b = {} as WebGLRenderer;
  const compile = (renderer: WebGLRenderer) => {
    const lookup: { value: Texture | null } = { value: null };
    trackFinishResources(renderer, { dfgLUT: lookup });
    // Match Three's real order: value is assigned after the compile callback.
    lookup.value = texture;
  };
  compile(a); compile(a); compile(b);
  releaseFinishResources(a); expect(disposed).not.toHaveBeenCalled();
  releaseFinishResources(b); expect(disposed).toHaveBeenCalledTimes(1);
  releaseFinishResources(a); releaseFinishResources(b); expect(disposed).toHaveBeenCalledTimes(1);
});
