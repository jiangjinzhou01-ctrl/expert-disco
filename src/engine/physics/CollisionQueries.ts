import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, type Quaternion } from 'three';
import { PLAYER_RADIUS } from '../../scenes/RoomLayout';
import type { WorldId } from '../../scenes/RoomLayout';
import { CAPSULE_CYLINDER_HALF_HEIGHT, type PortalPhysics } from './PhysicsRuntime';

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const EXIT_CLEARANCE = 0.002;

export interface ExitValidation { valid: boolean; reason: string | null }

/** Checks actual Rapier shapes, excluding self and unrelated room colliders. */
export class CollisionQueries {
  private readonly shape = new RAPIER.Capsule(CAPSULE_CYLINDER_HALF_HEIGHT, PLAYER_RADIUS + EXIT_CLEARANCE);
  private queryWorld: WorldId = 'A';
  private skipFloor = false;
  private readonly allowedFloorContacts=new Set<number>();
  private blockingId: string | null = null;
  private readonly filter = (collider: RAPIER.Collider) => {
    const meta = this.physics.metadata.get(collider.handle);
    return !this.allowedFloorContacts.has(collider.handle) && collider.handle !== this.physics.collider.handle && meta?.worldId === this.queryWorld
      && (!this.skipFloor || !meta.id.endsWith('-floor'));
  };
  private readonly onIntersection = (collider: RAPIER.Collider) => {
    this.blockingId = this.physics.metadata.get(collider.handle)?.id ?? `collider-${collider.handle}`;
    return false;
  };

  constructor(private readonly physics: PortalPhysics) {}

  validateExit(position: Vector3, remaining: Vector3, worldId: WorldId, mappedRotation?: Quaternion): ExitValidation {
    const capsule=this.physics.collisionShape?.();
    const shape=capsule?.shape??this.shape,rotation=mappedRotation??capsule?.rotation??IDENTITY;
    this.queryWorld = worldId;
    this.allowedFloorContacts.clear();
    if(this.physics.allowsExitContact)for(const [handle,meta]of this.physics.metadata){if(meta.worldId===worldId&&this.physics.allowsExitContact(this.physics.world.getCollider(handle),position))this.allowedFloorContacts.add(handle);}
    this.skipFloor = false;
    this.blockingId = null;
    this.physics.world.intersectionsWithShape(position, rotation, shape,
      this.onIntersection, undefined, undefined, this.physics.collider, this.physics.body, this.filter);
    if (this.blockingId) return { valid: false, reason: `exit-overlap:${this.blockingId}` };
    // Floors may be contacted by the remaining gravity displacement. The target
    // character controller handles that contact; walls and objects remain blocking.
    this.skipFloor = true;
    if (remaining.lengthSq() > 1e-16) {
      const hit = this.physics.world.castShape(position, rotation, remaining, shape,
        EXIT_CLEARANCE, 1, true, undefined, undefined, this.physics.collider, this.physics.body, this.filter);
      if (hit) {
        const id = this.physics.metadata.get(hit.collider.handle)?.id ?? `collider-${hit.collider.handle}`;
        return { valid: false, reason: `exit-path-blocked:${id}` };
      }
    }
    return { valid: true, reason: null };
  }
}
