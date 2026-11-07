import { afterEach, describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { PhysicsRuntime } from '../../engine/physics/PhysicsRuntime';
import { PlayerController } from '../../engine/player/PlayerController';
import { PlayerState } from '../../engine/player/PlayerState';
import { PortalTransfer } from '../../engine/portal/PortalTransfer';
import { computeSignedPlaneDistance } from '../../engine/portal/PortalMath';
import { portalA, portalB, type WorldId } from '../../scenes/RoomLayout';

const FIXED_DT = 1 / 60;
const A_INWARD = new Vector3(0, 0, -3);
const A_OUTWARD = new Vector3(0, 0, 3);
const B_INWARD = new Vector3(-3, 0, 0);
const B_OUTWARD = new Vector3(3, 0, 0);
const runtimes: PhysicsRuntime[] = [];

async function fixture() {
  const state = new PlayerState();
  const physics = await PhysicsRuntime.create(state);
  runtimes.push(physics);
  const transfer = new PortalTransfer(physics, state);
  const controller = new PlayerController(physics, state, transfer);
  return { state, physics, transfer, controller };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function repeat(f: Fixture, velocity: Vector3, steps: number): void {
  for (let step = 0; step < steps; step += 1) f.controller.step(FIXED_DT, velocity);
}

function enter(f: Fixture, destination: WorldId, velocity: Vector3): void {
  for (let step = 0; step < 300 && f.state.worldId !== destination; step += 1) {
    f.controller.step(FIXED_DT, velocity);
  }
  expect(f.state.worldId, JSON.stringify({ position: f.state.position.toArray(), rejection: f.transfer.lastRejection })).toBe(destination);
}

function leaveAndRearm(f: Fixture, velocity: Vector3): void {
  const portal = f.state.worldId === 'A' ? portalA : portalB;
  for (let step = 0; step < 120; step += 1) {
    f.controller.step(FIXED_DT, velocity);
    if (computeSignedPlaneDistance(f.state.position, portal) >= 0.55 && f.transfer.phase === 'ARMED') return;
  }
  throw new Error(`Failed to spatially rearm: ${JSON.stringify({ world: f.state.worldId, position: f.state.position.toArray(), phase: f.transfer.phase })}`);
}

function expectValid(f: Fixture): void {
  expect([...f.state.position.toArray(), ...f.state.rotation.toArray(), ...f.state.velocity.toArray()].every(Number.isFinite)).toBe(true);
  expect(f.state.rotation.lengthSq()).toBeCloseTo(1, 5);
  expect(f.state.position.y).toBeGreaterThanOrEqual(0.869);
  expect(f.state.position.y).toBeLessThan(5.2);
  const position = f.physics.body.translation();
  expect(new Vector3(position.x, position.y, position.z).distanceTo(f.state.position)).toBeLessThan(1e-4);
  if (f.state.worldId === 'A') {
    expect(f.state.position.x).toBeGreaterThan(-8);
    expect(f.state.position.x).toBeLessThan(8);
    expect(f.state.position.z).toBeGreaterThanOrEqual(-8.001);
  } else {
    expect(f.state.position.x).toBeGreaterThanOrEqual(31.999);
    expect(f.state.position.x).toBeLessThan(48);
    expect(Math.abs(f.state.position.z)).toBeLessThan(8);
  }
}

afterEach(() => {
  runtimes.splice(0).forEach(runtime => runtime.dispose());
});

describe('Rapier capsule portal integration', () => {
  it('M08: requires spatial rearming and does not emit a second event when immediately reversed', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    expect(f.transfer.phase).toBe('WAITING_FOR_REARM');
    const firstStep = f.transfer.events[0]!.step;
    f.controller.step(FIXED_DT, B_INWARD);
    expect(f.transfer.events).toHaveLength(1);
    expect(f.state.worldId).toBe('B');
    expect(f.state.step).toBeGreaterThan(firstStep);
    leaveAndRearm(f, B_OUTWARD);
    expect(f.transfer.phase).toBe('ARMED');
    enter(f, 'A', B_INWARD);
    expect(f.transfer.events).toHaveLength(2);
    expect(f.transfer.events[1]!.step).toBeGreaterThan(firstStep);
  });

  it('M08: refuses a second explicit crossing resolution in the same committed physical step', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    const committedStep = f.transfer.events[0]!.step;
    const id = f.transfer.lastEventId;
    const result = f.transfer.resolve(
      new Vector3(32.05, f.state.position.y, 0),
      new Vector3(-0.1, 0, 0),
      false,
      committedStep,
    );
    expect(result.transferred).toBe(false);
    expect(f.transfer.events).toHaveLength(1);
    expect(f.transfer.lastEventId).toBe(id);
    expect(f.transfer.lastRejection).toBe('already-transferred-this-step');
    expect(f.state.worldId).toBe('B');
  });

  it('P01: crosses A → B through the actual aperture and atomically moves the capsule', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    expect(f.transfer.events).toHaveLength(1);
    expect(f.transfer.lastEventId).toBe(1);
    expect(f.transfer.events[0]?.sourceWorldId).toBe('A');
    expect(f.transfer.events[0]?.destinationWorldId).toBe('B');
    expect(f.state.position.x).toBeGreaterThanOrEqual(32);
    expect(Math.abs(f.state.position.z)).toBeLessThan(1e-3);
    expect(f.state.velocity.x).toBeGreaterThan(2.9);
    expectValid(f);
  });

  it('P02: returns B → A after moving away from the exit to rearm', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    leaveAndRearm(f, B_OUTWARD);
    enter(f, 'A', B_INWARD);
    expect(f.transfer.events).toHaveLength(2);
    expect(f.transfer.events[1]?.sourceWorldId).toBe('B');
    expect(f.transfer.events[1]?.destinationWorldId).toBe('A');
    expect(f.state.velocity.z).toBeGreaterThan(2.9);
    expect(f.state.rotation.angleTo(new Quaternion())).toBeLessThan(1e-4);
    expectValid(f);
  });

  it('P03: survives 100 complete natural A → B → A cycles with exactly 200 unique commits', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    for (let cycle = 0; cycle < 100; cycle += 1) {
      enter(f, 'B', A_INWARD);
      leaveAndRearm(f, B_OUTWARD);
      expectValid(f);
      enter(f, 'A', B_INWARD);
      leaveAndRearm(f, A_OUTWARD);
      expectValid(f);
      expect(f.transfer.events.length, `cycle ${cycle}`).toBe((cycle + 1) * 2);
    }
    expect(f.transfer.events).toHaveLength(200);
    expect(f.transfer.events.map(event => event.id)).toEqual(Array.from({ length: 200 }, (_, index) => index + 1));
    expect(new Set(f.transfer.events.map(event => event.step)).size).toBe(200);
    expect(f.state.worldId).toBe('A');
    expect(f.state.rotation.angleTo(new Quaternion())).toBeLessThan(1e-4);
    expect(f.transfer.phase).toBe('ARMED');
  });

  it('P04: a real solid door frame stops the capsule outside the aperture', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(1.3, 0.89, -7.2), 'A');
    repeat(f, A_INWARD, 120);
    expect(f.state.worldId).toBe('A');
    expect(f.transfer.events).toHaveLength(0);
    expect(computeSignedPlaneDistance(f.state.position, portalA)).toBeGreaterThan(0.3);
    expectValid(f);
  });

  it('P04: grazing the frame may slide into the opening, but can transfer only at a valid capsule hit', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(1.15, 0.89, -7.2), 'A');
    repeat(f, A_INWARD, 6);
    expect(f.state.worldId).toBe('A');
    expect(f.transfer.events).toHaveLength(0);
    expect(computeSignedPlaneDistance(f.state.position, portalA)).toBeGreaterThan(0.3);
    repeat(f, A_INWARD, 120);
    expect(f.transfer.events).toHaveLength(1);
    const hit = f.transfer.events[0]!.sourcePosition;
    expect(Math.abs(hit[0]!)).toBeLessThanOrEqual(0.9 + 1e-4);
    expect(Math.abs(hit[2]! + 8)).toBeLessThan(1e-4);
    expect(hit[1]).toBeGreaterThanOrEqual(0.87 - 1e-4);
    expect(hit[1]).toBeLessThanOrEqual(2.03 + 1e-4);
    expectValid(f);
  });

  it('P05: an off-centre capsule retains its actual crossing coordinates at the destination', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0.5, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    expect(f.transfer.events).toHaveLength(1);
    expect(Math.abs(f.state.position.z - 0.5)).toBeLessThan(1e-3);
    expectValid(f);
  });

  it('P06: a real exit obstacle rejects transfer and removing it restores normal passage', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    f.physics.setExitBlocked(true, 'B');
    repeat(f, A_INWARD, 60);
    expect(f.state.worldId).toBe('A');
    expect(f.transfer.events).toHaveLength(0);
    expect(f.transfer.lastRejection).toBeTruthy();
    expect(computeSignedPlaneDistance(f.state.position, portalA)).toBeGreaterThan(0.25);
    expectValid(f);
    f.physics.setExitBlocked(false, 'B');
    enter(f, 'B', A_INWARD);
    expect(f.transfer.events).toHaveLength(1);
    expectValid(f);
  });

  it('P07: a high-speed step catches the plane and preserves post-crossing residual displacement', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.4), 'A');
    f.controller.step(FIXED_DT, new Vector3(0, 0, -120));
    expect(f.state.worldId).toBe('B');
    expect(f.transfer.events).toHaveLength(1);
    expect(f.state.position.x).toBeCloseTo(33.4, 2);
    expect(f.state.velocity.x).toBeCloseTo(120, 3);
    expectValid(f);
  });

  it('P08: invalid and excessive integration steps are rejected without mutating state', async () => {
    const f = await fixture();
    const before = f.state.position.clone();
    const step = f.state.step;
    for (const dt of [0, -1 / 60, NaN, Infinity, 0.2, 5]) {
      expect(() => f.controller.step(dt, A_INWARD)).toThrow(RangeError);
      expect(f.state.position.distanceTo(before)).toBe(0);
      expect(f.state.step).toBe(step);
      expect(f.transfer.events).toHaveLength(0);
    }
  });

  it('P09: reset restores a valid checkpoint after corrupt user state and keeps event IDs monotonic', async () => {
    const f = await fixture();
    f.controller.relocate(new Vector3(0, 0.89, -7.2), 'A');
    enter(f, 'B', A_INWARD);
    const eventId = f.transfer.lastEventId;
    f.state.position.set(NaN, -100, Infinity);
    f.state.velocity.set(Infinity, NaN, -100);
    f.controller.reset();
    expect(f.state.worldId).toBe('A');
    expect(f.state.position.distanceTo(new Vector3(0, 0.89, -3))).toBeLessThan(1e-6);
    expect(f.state.velocity.length()).toBe(0);
    expect(f.transfer.phase).toBe('ARMED');
    expect(f.transfer.lastEventId).toBe(eventId);
    expectValid(f);
    enter(f, 'B', A_INWARD);
    expect(f.transfer.lastEventId).toBe(eventId + 1);
  });
});
