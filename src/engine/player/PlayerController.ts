import { Euler, Vector3 } from 'three';
import type { WorldId } from '../../scenes/RoomLayout';
import { PhysicsRuntime } from '../physics/PhysicsRuntime';
import { PortalTransfer } from '../portal/PortalTransfer';
import { PlayerState } from './PlayerState';

/** Input-driven upright capsule motion. Rendering and cameras are separate. */
export class PlayerController {
  constructor(
    readonly physics: PhysicsRuntime,
    readonly state: PlayerState,
    readonly transfer: PortalTransfer,
  ) {}

  step(dt: number, moveVector: Vector3): void {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw new RangeError('Physics dt must be in (0, 0.1]');
    if (![moveVector.x, moveVector.y, moveVector.z].every(Number.isFinite)) throw new RangeError('Movement must be finite');
    if (![this.state.position.x, this.state.position.y, this.state.position.z].every(Number.isFinite)) {
      throw new RangeError('Invalid player position; reset to the checkpoint');
    }
    this.state.step += 1;
    this.state.movementDirection.copy(moveVector);
    this.state.velocity.x = moveVector.x;
    this.state.velocity.z = moveVector.z;
    this.state.velocity.y = this.state.grounded ? -0.5 : Math.max(-30, this.state.velocity.y - 9.81 * dt);
    const start = this.state.position.clone();
    const desired = this.state.velocity.clone().multiplyScalar(dt);
    // Transfer clips the source query at the plane before asking Rapier to solve
    // collisions. A source-side solver must never consume destination motion.
    const resolution = this.transfer.resolve(start, desired, this.state.grounded, this.state.step);
    this.physics.commitMovement(start, resolution.position, dt, resolution.anchor);
    const actual = this.physics.body.translation();
    this.state.position.set(actual.x, actual.y, actual.z);
    this.state.grounded = resolution.grounded;
    if (this.state.grounded) this.state.velocity.y = 0;
  }

  reset(): void {
    const step = this.state.step;
    this.state.reset();
    this.state.step = step;
    this.physics.relocate(this.state.position);
    this.transfer.reset();
  }

  /** Called only through the mode-gated deterministic browser test adapter. */
  relocate(position: Vector3, worldId: WorldId, yaw = 0, pitch = 0): void {
    if (![position.x, position.y, position.z, yaw, pitch].every(Number.isFinite)) throw new RangeError('Test pose must be finite');
    this.state.position.copy(position);
    this.state.worldId = worldId;
    this.state.yaw = yaw;
    this.state.pitch = pitch;
    this.state.rotation.setFromEuler(new Euler(pitch, yaw, 0, 'YXZ'));
    this.state.velocity.set(0, 0, 0);
    this.state.grounded = false;
    this.state.discontinuity += 1;
    this.physics.relocate(position);
    this.transfer.reset();
  }
}
