import RAPIER from '@dimforge/rapier3d-compat';
import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CollisionQueries } from '../../engine/physics/CollisionQueries';
import { PhysicsRuntime } from '../../engine/physics/PhysicsRuntime';
import { PlayerController } from '../../engine/player/PlayerController';
import { PlayerState } from '../../engine/player/PlayerState';
import { PortalTransfer } from '../../engine/portal/PortalTransfer';

let physics: PhysicsRuntime | null = null;
afterEach(() => { physics?.dispose(); physics = null; });

describe('Rapier exit shape and corrected source path edge cases', () => {
  it('does not let geometry behind the SOURCE portal shorten destination residual motion', async () => {
    const state = new PlayerState();
    physics = await PhysicsRuntime.create(state);
    const transfer = new PortalTransfer(physics, state);
    const player = new PlayerController(physics, state, transfer);
    player.relocate(new Vector3(0, 0.89, -7.8), 'A');
    const behindSource = physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(1.2, 1.35, 0.3).setTranslation(0, 1.35, -9));
    physics.metadata.set(behindSource.handle, { worldId: 'A', id: 'A-behind-entrance-regression' });
    physics.world.step();
    player.step(1 / 60, new Vector3(0, 0, -120));
    expect(state.worldId).toBe('B');
    expect(transfer.events).toHaveLength(1);
    // 2m total: .2m before plane + 1.8m exclusively in destination coordinates.
    expect(Math.abs(state.position.x - 33.8005)).toBeLessThan(0.001);
    expect(transfer.events[0]!.remainingDisplacement[0]).toBeCloseTo(1.8, 3);
    expect(transfer.events[0]!.crossingT).toBeCloseTo(0.1, 4);
  });

  it('ignores a wholly source-backside box even when the pre-crossing capsule protrudes beyond the plane', async () => {
    const state = new PlayerState();
    physics = await PhysicsRuntime.create(state);
    const transfer = new PortalTransfer(physics, state);
    const player = new PlayerController(physics, state, transfer);
    player.relocate(new Vector3(0, 0.89, -7.8), 'A');
    const behindSource = physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(1.2, 1.35, 0.04).setTranslation(0, 1.35, -8.2));
    physics.metadata.set(behindSource.handle, { worldId: 'A', id: 'A-near-backside-regression' });
    physics.world.step();
    player.step(1 / 60, new Vector3(0, 0, -120));
    expect(state.worldId).toBe('B');
    expect(Math.abs(state.position.x - 33.8005)).toBeLessThan(0.001);
    expect(transfer.events).toHaveLength(1);
  });

  it('can approach at walking speed without the front of the capsule catching source-backside geometry', async () => {
    const state = new PlayerState();
    physics = await PhysicsRuntime.create(state);
    const transfer = new PortalTransfer(physics, state);
    const player = new PlayerController(physics, state, transfer);
    player.relocate(new Vector3(0, 0.89, -7.5), 'A');
    const behindSource = physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(1.2, 1.35, 0.04).setTranslation(0, 1.35, -8.2));
    physics.metadata.set(behindSource.handle, { worldId: 'A', id: 'A-walking-backside-regression' });
    physics.world.step();
    for (let i = 0; i < 30 && state.worldId === 'A'; i += 1) {
      player.step(1 / 60, new Vector3(0, 0, -3));
    }
    expect(state.worldId).toBe('B');
    expect(transfer.events).toHaveLength(1);
    expect(transfer.events[0]!.sourcePosition[2]).toBeCloseTo(-8, 5);
  });

  it('can safely reject a blocked exit and recover with a near source-backside box present', async () => {
    const state = new PlayerState();
    physics = await PhysicsRuntime.create(state);
    const transfer = new PortalTransfer(physics, state);
    const player = new PlayerController(physics, state, transfer);
    player.relocate(new Vector3(0, 0.89, -7.5), 'A');
    const behindSource = physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(1.2, 1.35, 0.04).setTranslation(0, 1.35, -8.2));
    physics.metadata.set(behindSource.handle, { worldId: 'A', id: 'A-rejection-backside-regression' });
    physics.setExitBlocked(true, 'B');
    for (let i = 0; i < 15; i += 1) player.step(1 / 60, new Vector3(0, 0, -3));
    expect(state.worldId).toBe('A');
    expect(transfer.events).toHaveLength(0);
    expect(transfer.lastRejection).toContain('exit-overlap');
    expect(state.position.z).toBeGreaterThan(-8);
    physics.setExitBlocked(false, 'B');
    for (let i = 0; i < 30 && state.worldId === 'A'; i += 1) player.step(1 / 60, new Vector3(0, 0, -3));
    expect(state.worldId).toBe('B');
    expect(transfer.events).toHaveLength(1);
  });

  it('P08: a real source obstacle prevents a nominal plane crossing after collision correction', async () => {
    const state = new PlayerState();
    physics = await PhysicsRuntime.create(state);
    const transfer = new PortalTransfer(physics, state);
    const player = new PlayerController(physics, state, transfer);
    player.relocate(new Vector3(0, 0.89, -6.5), 'A');
    physics.setExitBlocked(true, 'A');
    // Requested 2m displacement would cross z=-8, but the actual capsule stops
    // at the real source-side obstacle and must never be considered transferred.
    player.step(1 / 60, new Vector3(0, 0, -120));
    expect(state.worldId).toBe('A');
    expect(transfer.events).toHaveLength(0);
    expect(state.position.z).toBeGreaterThan(-7.2);
    expect(transfer.crossingCondition).toBe(false);
  });

  it('rejects an underground destination capsule while allowing the standing floor gap', async () => {
    physics = await PhysicsRuntime.create(new PlayerState());
    const queries = new CollisionQueries(physics);
    const underground = queries.validateExit(new Vector3(32.001, 0.82, 0), new Vector3(), 'B');
    expect(underground.valid).toBe(false);
    expect(underground.reason).toBe('exit-overlap:B-floor');
    const standing = queries.validateExit(new Vector3(32.001, 0.89, 0), new Vector3(1, -0.02, 0), 'B');
    expect(standing).toEqual({ valid: true, reason: null });
  });

  it('rejects a remaining path blocked by a real box even when the exit anchor itself is clear', async () => {
    physics = await PhysicsRuntime.create(new PlayerState());
    const obstacle = physics.world.createCollider(RAPIER.ColliderDesc
      .cuboid(0.15, 1.2, 1).setTranslation(33.1, 1.2, 0));
    physics.metadata.set(obstacle.handle, { worldId: 'B', id: 'B-sweep-obstacle' });
    physics.world.step();
    const queries = new CollisionQueries(physics);
    const anchor = new Vector3(32.001, 0.89, 0);
    expect(queries.validateExit(anchor, new Vector3(), 'B').valid).toBe(true);
    expect(queries.validateExit(anchor, new Vector3(2, 0, 0), 'B')).toEqual({
      valid: false, reason: 'exit-path-blocked:B-sweep-obstacle',
    });
  });
});
