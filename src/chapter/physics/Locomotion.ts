import { Quaternion, Vector3 } from 'three';

export type Stance = 'STAND' | 'CROUCH' | 'PRONE';
export type LocomotionMode = 'GROUND_WALK' | 'AIRBORNE' | 'ZERO_G' | 'REATTACH' | 'RECOVER';
export interface MotionInput {
  x: number; y: number; jump?: boolean; jumpPressed?: boolean; sprint?: boolean;
  crouch?: boolean; pronePressed?: boolean; descend?: boolean; brake?: boolean;
}
export interface MovementSettings {
  profile: 'explore' | 'experiment'; moveSpeed: number; jumpHeight: number;
  gravityScale: number; autoSprint: boolean;
}
export const DEFAULT_MOVEMENT: Readonly<MovementSettings> = Object.freeze({
  profile: 'explore', moveSpeed: 3, jumpHeight: 1.2, gravityScale: 1, autoSprint: false,
});
export const STANCES = Object.freeze({
  STAND: { radius: .30, halfSegment: .57, offset: .87, eye: 1.55, speed: 1 },
  CROUCH: { radius: .30, halfSegment: .25, offset: .55, eye: .94, speed: 1.6 / 3 },
  PRONE: { radius: .26, halfSegment: .365, offset: .26, eye: .40, speed: .7 / 3 },
});
export function nominalJumpSpeed(height: number): number {
  if (!Number.isFinite(height) || height < .3 || height > 3) throw new RangeError('Jump height must be 0.3–3m at 1g');
  // Deliberately independent of the current gravity magnitude.
  return Math.sqrt(2 * 9.81 * height);
}
export function validateMovement(settings: MovementSettings): MovementSettings {
  if (!['explore', 'experiment'].includes(settings.profile)
    || !Number.isFinite(settings.moveSpeed) || settings.moveSpeed < 1.5 || settings.moveSpeed > 7
    || !Number.isFinite(settings.gravityScale) || settings.gravityScale < 0 || settings.gravityScale > 2
    || typeof settings.autoSprint !== 'boolean') throw new RangeError('Invalid movement settings');
  nominalJumpSpeed(settings.jumpHeight);
  return { ...settings };
}
export function stanceLocalRotation(stance: Stance, yaw: number): Quaternion {
  return stance === 'PRONE'
    ? new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2))
    : new Quaternion();
}
