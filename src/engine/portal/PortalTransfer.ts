import { Euler, Vector3 } from 'three';
import { PLAYER_HALF_HEIGHT, PLAYER_RADIUS, portalA, portalB } from '../../scenes/RoomLayout';
import type { WorldId } from '../../scenes/RoomLayout';
import type { PlayerState } from '../player/PlayerState';
import { CollisionQueries } from '../physics/CollisionQueries';
import { type PortalPhysics } from '../physics/PhysicsRuntime';
import { computeSignedPlaneDistance, intersectMovementWithPortal, isPointInsideAperture, transformDirection, transformPosition, transformQuaternion } from './PortalMath';
import { PortalRegistry } from './PortalRegistry';
import type { Portal } from './PortalTypes';

export type TransferPhase = 'ARMED' | 'CROSSING' | 'TRANSFERRED' | 'WAITING_FOR_REARM';
export interface TransferEvent {
  id: number; step: number; sourceId: string; destinationId: string;
  sourceWorldId: WorldId; destinationWorldId: WorldId;
  sourcePosition: number[]; destinationPosition: number[];
  velocityBefore: number[]; velocityAfter: number[];
  crossingT: number; remainingDisplacement: number[];
}
export interface TransferResolution {
  position: Vector3; grounded: boolean; transferred: boolean; anchor?: Vector3;
}

const EXIT_NUDGE = 0.0005;
const REARM_DISTANCE = PLAYER_RADIUS + 0.1;
const REJECTION_DISTANCE = PLAYER_RADIUS + 0.02;

/** Sole owner of crossing detection, rearming, and atomic mapped state changes. */
export class PortalTransfer {
  private static readonly labRegistry = new PortalRegistry([portalA, portalB], [
    { sourceId: portalA.id, destinationId: portalB.id, sourceWorldId: 'A', destinationWorldId: 'B' },
    { sourceId: portalB.id, destinationId: portalA.id, sourceWorldId: 'B', destinationWorldId: 'A' },
  ]);
  readonly events: TransferEvent[] = [];
  phase: TransferPhase = 'ARMED';
  lastRejection: string | null = null;
  crossingCondition = false;
  private eventId = 0;
  private lastCommittedStep = -1;
  private exitPortal: Portal | null = null;
  private readonly queries: CollisionQueries;

  constructor(private readonly physics: PortalPhysics, private readonly state: PlayerState, readonly registry:PortalRegistry=PortalTransfer.labRegistry) {
    this.queries = new CollisionQueries(physics);
  }

  get lastEventId(): number { return this.eventId; }

  private updateRearm(displacement: Vector3): void {
    if (this.phase !== 'WAITING_FOR_REARM' || !this.exitPortal) return;
    const normal = new Vector3(0, 0, 1).applyQuaternion(this.exitPortal.rotation);
    if (computeSignedPlaneDistance(this.state.position, this.exitPortal) >= REARM_DISTANCE
      && displacement.dot(normal) >= -1e-8) {
      this.phase = 'ARMED';
      this.exitPortal = null;
    }
  }

  private reject(source: Portal, hit: Vector3, reason: string, grounded: boolean): TransferResolution {
    this.lastRejection = reason;
    if (this.phase === 'CROSSING') this.phase = 'ARMED';
    const normal = new Vector3(0, 0, 1).applyQuaternion(source.rotation);
    const position = hit.clone().addScaledVector(normal, REJECTION_DISTANCE);
    // This is a safe source-side position, never a failed destination teleport.
    const constrained = this.physics.constrainMovement(this.state.position,
      position.sub(this.state.position), this.state.worldId, source);
    return { position: this.state.position.clone().add(constrained.displacement), grounded, transferred: false };
  }

  resolve(
    start: Vector3,
    desired: Vector3,
    _grounded: boolean,
    step: number,
  ): TransferResolution {
    this.updateRearm(desired);
    const source = this.registry.forWorld(this.state.worldId)[0]!;
    const end = start.clone().add(desired);
    const startDistance = computeSignedPlaneDistance(start, source);
    const endDistance = computeSignedPlaneDistance(end, source);
    const denominator = startDistance - endDistance;
    // Split against the infinite plane FIRST. Aperture fitting is evaluated only
    // after source collisions, since a glancing frame contact may slide into it.
    const nominalCrossing = startDistance > 1e-9 && endDistance <= 0 && denominator > 1e-9;
    this.crossingCondition = false;
    if (!nominalCrossing) {
      const approachingAperture = startDistance > 0
        && isPointInsideAperture(start, source, PLAYER_RADIUS, PLAYER_HALF_HEIGHT);
      const movement = this.physics.constrainMovement(start, desired, this.state.worldId,
        approachingAperture ? source : undefined);
      const position = start.clone().add(movement.displacement);
      const correctedDistance = computeSignedPlaneDistance(position, source);
      if (startDistance > 1e-9 && correctedDistance <= 0) {
        const t = startDistance / (startDistance - correctedDistance);
        const hit = start.clone().lerp(position, t);
        return this.reject(source, hit, 'source-deflection-requires-next-step', movement.grounded);
      }
      return { position, grounded: movement.grounded, transferred: false };
    }
    const planeT = startDistance / denominator;
    // The SOURCE solver receives only the pre-plane fraction of RAW motion.
    // It cannot see or shorten the destination remainder using source geometry.
    const prefix = this.physics.constrainMovement(start, desired.clone().multiplyScalar(planeT), this.state.worldId, source);
    const prefixEnd = start.clone().add(prefix.displacement);
    // Float32 Rapier results can stop a few ULPs before the mathematical plane.
    const normal = new Vector3(0, 0, 1).applyQuaternion(source.rotation);
    const distance = computeSignedPlaneDistance(prefixEnd, source);
    const reachesPlane = Math.abs(distance) <= 2e-5;
    const checkedEnd = reachesPlane ? prefixEnd.clone().addScaledVector(normal, -distance - 1e-7) : prefixEnd;
    const actualCrossing = intersectMovementWithPortal(start, checkedEnd, source, PLAYER_RADIUS, PLAYER_HALF_HEIGHT);
    if (!actualCrossing) {
      this.lastRejection = 'source-collision-prevented-crossing';
      if (distance <= 0) {
        const t = startDistance / (startDistance - distance);
        return this.reject(source, start.clone().lerp(prefixEnd, t), 'source-deflection-outside-aperture', prefix.grounded);
      }
      return { position: prefixEnd, grounded: prefix.grounded, transferred: false };
    }
    this.crossingCondition = true;
    if (step === this.lastCommittedStep) return this.reject(source, actualCrossing.hitPoint, 'already-transferred-this-step', prefix.grounded);
    if (this.phase !== 'ARMED') return this.reject(source, actualCrossing.hitPoint, 'waiting-for-spatial-rearm', prefix.grounded);
    this.phase = 'CROSSING';

    const destination = this.registry.destination(source.id);
    const destinationWorldId = destination.worldId as WorldId;
    const transform = this.registry.transform(source.id);
    const destinationNormal = new Vector3(0, 0, 1).applyQuaternion(destination.rotation);
    const anchor = transformPosition(actualCrossing.hitPoint, transform).addScaledVector(destinationNormal, EXIT_NUDGE);
    const consumedFraction = planeT * actualCrossing.t;
    const remaining = transformDirection(desired.clone().multiplyScalar(1 - consumedFraction), transform);
    const validation = this.queries.validateExit(anchor, remaining, destinationWorldId);
    if (!validation.valid) return this.reject(source, actualCrossing.hitPoint, validation.reason!, prefix.grounded);

    // Only the DESTINATION collision region may constrain post-plane movement.
    const target = this.physics.constrainMovement(anchor, remaining, destinationWorldId);
    const finalPosition = anchor.clone().add(target.displacement);
    const velocityBefore = this.state.velocity.toArray();
    const rotation = transformQuaternion(this.state.rotation, transform);
    const velocity = transformDirection(this.state.velocity, transform);
    const input = transformDirection(this.state.movementDirection, transform);
    const euler = new Euler().setFromQuaternion(rotation, 'YXZ');
    // Synchronous commit: no renderer or React state is published mid-transfer.
    this.state.position.copy(finalPosition);
    this.state.rotation.copy(rotation);
    this.state.velocity.copy(velocity);
    this.state.movementDirection.copy(input);
    this.state.yaw = euler.y;
    this.state.pitch = euler.x;
    this.state.worldId = destinationWorldId;
    this.state.discontinuity += 1;
    this.lastCommittedStep = step;
    this.phase = 'TRANSFERRED';
    this.eventId += 1;
    this.events.push({
      id: this.eventId, step, sourceId: source.id, destinationId: destination.id,
      sourceWorldId: source.worldId as WorldId, destinationWorldId,
      sourcePosition: actualCrossing.hitPoint.toArray(), destinationPosition: finalPosition.toArray(),
      velocityBefore, velocityAfter: velocity.toArray(), crossingT: consumedFraction,
      remainingDisplacement: target.displacement.toArray(),
    });
    this.lastRejection = null;
    this.exitPortal = destination;
    this.phase = 'WAITING_FOR_REARM';
    return { position: finalPosition, grounded: target.grounded, transferred: true, anchor };
  }

  reset(): void {
    this.phase = 'ARMED';
    this.lastRejection = null;
    this.crossingCondition = false;
    this.exitPortal = null;
    // Event numbers and committed-step guard remain monotonic across resets.
  }
}
