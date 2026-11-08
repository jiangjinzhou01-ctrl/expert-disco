import { describe, expect, it } from 'vitest';
import { ActionBuffer } from '../../input/ActionBuffer';
import { GravityResolver } from '../../chapter/physics/GravityResolver';
import { Vector3 } from 'three';

describe('fixed-step action edges and independent input sources', () => {
  it('retains short taps until a physics step, consumes once and keeps other pointers held', () => {
    const actions = new ActionBuffer();
    actions.set('jump', true, 'touch:3'); actions.set('jump', false, 'touch:3');
    expect(actions.read().jumpPressed).toBe(true); expect(actions.read().jump).toBe(false);
    expect(actions.read(true).jumpPressed).toBe(true); expect(actions.read(true).jumpPressed).toBe(false);
    actions.set('sprint', true, 'ShiftLeft'); actions.set('sprint', true, 'touch:4');
    actions.set('sprint', false, 'touch:4'); expect(actions.read().sprint).toBe(true);
    actions.clear(); expect(actions.read()).toMatchObject({ jump: false, crouch: false, sprint: false, brake: false });
  });
  it('resolves competing fields by explicit priority and releases hysteresis on a fast crossing', () => {
    const resolver = new GravityResolver();
    for (const [id, priority, vector] of [['weak', 1, [0,-3.2373,0]], ['zero', 2, [0,0,0]]] as const)
      resolver.add({ id, slot: 'B', min: new Vector3(20,0,0), max: new Vector3(24,8,8), priority, acceleration: new Vector3(...vector) });
    const fallback = new Vector3(0,-9.81,0);
    expect(resolver.resolve(new Vector3(22,3,3),'B',fallback).id).toBe('zero');
    expect(resolver.resolve(new Vector3(24.02,3,3),'B',fallback).zeroG).toBe(true);
    expect(resolver.resolve(new Vector3(30,3,3),'B',fallback).id).toBe('architectural-support');
    expect(resolver.resolve(new Vector3(22,3,3),'A',fallback).acceleration.y).toBe(-9.81);
  });
});
