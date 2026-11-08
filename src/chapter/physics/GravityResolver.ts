import { Vector3 } from 'three';
import type { WorldId } from '../../scenes/RoomLayout';

export interface GravityField {
  id: string; slot: WorldId; min: Vector3; max: Vector3; priority: number;
  acceleration: Vector3;
}
export interface GravityDecision { id: string; acceleration: Vector3; zeroG: boolean }
/** Deterministic authored priorities, with spatial hysteresis. No averaging of
 * opposing vectors, and no time latch that can hold a fast player in an old room. */
export class GravityResolver {
  readonly fields: GravityField[] = [];
  private previous: GravityField | undefined;
  add(field: GravityField): void {
    if (!field.id || this.fields.some(f => f.id === field.id)
      || ![...field.min.toArray(), ...field.max.toArray(), ...field.acceleration.toArray(), field.priority].every(Number.isFinite)
      || field.min.toArray().some((n, i) => n >= field.max.getComponent(i))) throw new RangeError('Invalid gravity field');
    this.fields.push(field);
    this.fields.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }
  resolve(position: Vector3, slot: WorldId, fallback: Vector3): GravityDecision {
    const contains = (f: GravityField, margin = 0) => f.slot === slot
      && position.toArray().every((v, i) => v >= f.min.getComponent(i) - margin && v <= f.max.getComponent(i) + margin);
    let selected = this.fields.find(f => contains(f));
    if (this.previous && contains(this.previous, .08)
      && (!selected || selected.priority <= this.previous.priority)) selected = this.previous;
    this.previous = selected;
    const acceleration = (selected?.acceleration ?? fallback).clone();
    return { id: selected?.id ?? 'architectural-support', acceleration, zeroG: acceleration.lengthSq() < 1e-10 };
  }
  reset(): void { this.previous = undefined; }
}
