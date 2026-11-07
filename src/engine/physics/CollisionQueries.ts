import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { PLAYER_RADIUS } from '../../scenes/RoomLayout';
import type { WorldId } from '../../scenes/RoomLayout';
import { CAPSULE_CYLINDER_HALF_HEIGHT, PhysicsRuntime } from './PhysicsRuntime';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const EXIT_CLEARANCE = 0.002;

export interface ExitValidation { valid: boolean; reason: string | null }

/** Checks actual Rapier shapes, excluding self and unrelated room colliders. */
export class CollisionQueries {
  private readonly shape = new RAPIER.Capsule(CAPSULE_CYLINDER_HALF_HEIGHT, PLAYER_RADIUS + EXIT_CLEARANCE);
  private queryWorld: WorldId = 'A';
  private skipFloor = false;
  private blockingId: string | null = null;
  private readonly filter = (collider: RAPIER.Collider) => {
    const meta = this.physics.metadata.get(collider.handle);
    return collider.handle !== this.physics.collider.handle && meta?.worldId === this.queryWorld
      && (!this.skipFloor || !meta.id.endsWith('-floor'));
  };
  private readonly onIntersection = (collider: RAPIER.Collider) => {
    this.blockingId = this.physics.metadata.get(collider.handle)?.id ?? `collider-${collider.handle}`;
    return false;
  };

  constructor(private readonly physics: PhysicsRuntime) {}

  validateExit(position: Vector3, remaining: Vector3, worldId: WorldId): ExitValidation {
    this.queryWorld = worldId;
    this.skipFloor = false;
    this.blockingId = null;
    this.physics.world.intersectionsWithShape(position, IDENTITY, this.shape,
      this.onIntersection, undefined, undefined, this.physics.collider, this.physics.body, this.filter);
    if (this.blockingId) return { valid: false, reason: `exit-overlap:${this.blockingId}` };
    // Floors may be contacted by the remaining gravity displacement. The target
    // character controller handles that contact; walls and objects remain blocking.
    this.skipFloor = true;
    if (remaining.lengthSq() > 1e-16) {
      const hit = this.physics.world.castShape(position, IDENTITY, remaining, this.shape,
        EXIT_CLEARANCE, 1, true, undefined, undefined, this.physics.collider, this.physics.body, this.filter);
      if (hit) {
        const id = this.physics.metadata.get(hit.collider.handle)?.id ?? `collider-${hit.collider.handle}`;
        return { valid: false, reason: `exit-path-blocked:${id}` };
      }
    }
    return { valid: true, reason: null };
  }
}
