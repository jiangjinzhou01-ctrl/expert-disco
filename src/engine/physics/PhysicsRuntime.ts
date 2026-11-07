import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { PLAYER_HALF_HEIGHT, PLAYER_RADIUS, portalA, portalB, roomBoxes } from '../../scenes/RoomLayout';
import type { WorldId } from '../../scenes/RoomLayout';
import type { PlayerState } from '../player/PlayerState';
import type { Portal } from '../portal/PortalTypes';

let initialized: Promise<void> | undefined;
export const CHARACTER_OFFSET = 0.01;
export const CAPSULE_CYLINDER_HALF_HEIGHT = PLAYER_HALF_HEIGHT - PLAYER_RADIUS;

export interface ColliderMetadata { worldId: WorldId; id: string }
export type PortalPhysics = Pick<PhysicsRuntime, 'world'|'body'|'collider'|'metadata'|'constrainMovement'> & {allowsExitContact?:(collider:RAPIER.Collider,position:Vector3)=>boolean};

export interface ConstrainedMovement { displacement: Vector3; grounded: boolean }

/** One physics world, two disjoint regions, and one upright kinematic capsule. */
export class PhysicsRuntime {
  readonly world: RAPIER.World;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly character: RAPIER.KinematicCharacterController;
  readonly metadata = new Map<number, ColliderMetadata>();
  private blockedExits = new Map<WorldId, RAPIER.Collider>();
  private queryWorld: WorldId = 'A';
  private readonly ignoredBehindPlane = new Set<number>();
  private readonly scratchMovement = { x: 0, y: 0, z: 0 };
  private readonly scratchHalfExtents = { x: 0, y: 0, z: 0 };
  private readonly scratchTranslation = { x: 0, y: 0, z: 0 };
  private readonly scratchRotation = { x: 0, y: 0, z: 0, w: 1 };
  private readonly clipNormal = new Vector3();
  private readonly localNormal = new Vector3();
  private readonly inverseRotation = new Quaternion();
  private readonly filter = (collider: RAPIER.Collider) => {
    if (collider.handle === this.collider.handle
      || this.metadata.get(collider.handle)?.worldId !== this.queryWorld) return false;
    // Never call WASM collider accessors inside Rapier's borrowed query callback.
    return !this.ignoredBehindPlane.has(collider.handle);
  };

  private preparePlaneExclusions(portal?: Portal): void {
    this.ignoredBehindPlane.clear();
    if (!portal) return;
    this.clipNormal.set(0, 0, 1).applyQuaternion(portal.rotation);
    for (const [handle, meta] of this.metadata) {
      if (meta.worldId !== this.queryWorld) continue;
      const collider = this.world.getCollider(handle);
      const half = collider.halfExtents(this.scratchHalfExtents);
      if (!half) continue;
      const center = collider.translation(this.scratchTranslation);
      const rotation = collider.rotation(this.scratchRotation);
      this.inverseRotation.set(rotation.x, rotation.y, rotation.z, rotation.w).invert();
      this.localNormal.copy(this.clipNormal).applyQuaternion(this.inverseRotation);
      const centerDistance = (center.x - portal.position.x) * this.clipNormal.x
        + (center.y - portal.position.y) * this.clipNormal.y
        + (center.z - portal.position.z) * this.clipNormal.z;
      const support = Math.abs(this.localNormal.x) * half.x
        + Math.abs(this.localNormal.y) * half.y + Math.abs(this.localNormal.z) * half.z;
      // A capsule reaches beyond the plane before its centre crosses. Fully
      // backside source geometry belongs to replaced space; rim shapes remain.
      if (centerDistance + support < -1e-6) this.ignoredBehindPlane.add(handle);
    }
  }

  private constructor(state: PlayerState) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    for (const worldId of ['A', 'B'] as const) {
      for (const box of roomBoxes(worldId)) {
        const collider = this.world.createCollider(RAPIER.ColliderDesc
          .cuboid(box.size[0] / 2, box.size[1] / 2, box.size[2] / 2)
          .setTranslation(...box.center));
        this.metadata.set(collider.handle, { worldId, id: box.id });
      }
    }
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(state.position.x, state.position.y, state.position.z)
      .lockRotations());
    // Rapier's capsule argument is the CYLINDER half-height, not capsule half-height.
    this.collider = this.world.createCollider(RAPIER.ColliderDesc
      .capsule(CAPSULE_CYLINDER_HALF_HEIGHT, PLAYER_RADIUS), this.body);
    this.character = this.world.createCharacterController(CHARACTER_OFFSET);
    this.character.setSlideEnabled(true);
    this.character.setApplyImpulsesToDynamicBodies(false);
    this.character.enableSnapToGround(0.08);
    this.character.setMaxSlopeClimbAngle(Math.PI / 4);
    this.character.setMinSlopeSlideAngle(Math.PI / 3);
    this.world.step();
  }

  static async create(state: PlayerState): Promise<PhysicsRuntime> {
    initialized ??= RAPIER.init();
    await initialized;
    return new PhysicsRuntime(state);
  }

  /** Queries may relocate the capsule synchronously; nothing is rendered until commit. */
  constrainMovement(position: Vector3, delta: Vector3, worldId: WorldId, sourceClipPortal?: Portal): ConstrainedMovement {
    this.queryWorld = worldId;
    this.preparePlaneExclusions(sourceClipPortal);
    this.body.setTranslation(position, true);
    this.body.setNextKinematicTranslation(position);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.character.computeColliderMovement(this.collider, delta, undefined, undefined, this.filter);
    this.character.computedMovement(this.scratchMovement);
    return {
      displacement: new Vector3(this.scratchMovement.x, this.scratchMovement.y, this.scratchMovement.z),
      grounded: this.character.computedGrounded(),
    };
  }

  /** Teleport anchors cut kinematic history so Rapier never infers a 40m velocity. */
  commitMovement(start: Vector3, end: Vector3, dt: number, teleportAnchor?: Vector3): void {
    const anchor = teleportAnchor ?? start;
    this.body.setTranslation(anchor, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setNextKinematicTranslation(end);
    this.world.timestep = dt;
    this.world.step();
  }

  relocate(position: Vector3): void {
    this.body.setTranslation(position, true);
    this.body.setNextKinematicTranslation(position);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  /** A real collider, used by deterministic acceptance tests and debug controls. */
  setExitBlocked(blocked: boolean, worldId: WorldId = 'B'): void {
    const existing = this.blockedExits.get(worldId);
    if (existing) {
      this.metadata.delete(existing.handle);
      this.world.removeCollider(existing, false);
      this.blockedExits.delete(worldId);
    }
    if (blocked) {
      const portal = worldId === 'A' ? portalA : portalB;
      const normal = new Vector3(0, 0, 1).applyQuaternion(portal.rotation);
      const center = portal.position.clone().addScaledVector(normal, 0.25);
      const size = worldId === 'A' ? [2.2, 2.7, 0.6] : [0.6, 2.7, 2.2];
      const collider = this.world.createCollider(RAPIER.ColliderDesc
        .cuboid(size[0]! / 2, size[1]! / 2, size[2]! / 2)
        .setTranslation(center.x, center.y, center.z));
      this.metadata.set(collider.handle, { worldId, id: `${worldId}-exit-blocker` });
      this.blockedExits.set(worldId, collider);
    }
    const current = this.body.translation();
    this.body.setNextKinematicTranslation(current);
    this.world.step();
  }

  dispose(): void { this.world.free(); }
}
