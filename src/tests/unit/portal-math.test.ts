import { describe, expect, it } from 'vitest';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
  computePortalTransform,
  computeSignedPlaneDistance,
  intersectMovementWithPortal,
  isPointInsideAperture,
  portalWorldMatrix,
  transformDirection,
  transformPosition,
  transformQuaternion,
} from '../../engine/portal/PortalMath';
import type { Portal, PortalPose } from '../../engine/portal/PortalTypes';
import { PortalRegistry } from '../../engine/portal/PortalRegistry';

const SEED = 0x54485245;
const yaw = (angle: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle);
const pose = (x = 0, y = 0, z = 0, angle = 0): PortalPose => ({
  position: new Vector3(x, y, z), rotation: yaw(angle),
});
const aperture = (input: PortalPose = pose(0, 1.45, 0)): Portal => ({
  ...input, id: 'A', worldId: 'ROOM_A', width: 2.4, height: 2.9,
});

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

describe('PortalMath deterministic acceptance', () => {
  it('M01: restores position, orientation and velocity through A → B → A', () => {
    const a = pose(-2, 1.45, -7, Math.PI / 4);
    const b = pose(40, 1.45, 2, -Math.PI / 3);
    const ab = computePortalTransform(a, b);
    const ba = computePortalTransform(b, a);
    const position = new Vector3(-1, 1.1, -2);
    const orientation = new Quaternion().setFromEuler(new Euler(0.2, 0.7, 0, 'YXZ'));
    const velocity = new Vector3(1.1, -0.2, -2.4);
    expect(transformPosition(transformPosition(position, ab), ba).distanceTo(position)).toBeLessThan(1e-4);
    expect(transformQuaternion(transformQuaternion(orientation, ab), ba).angleTo(orientation) * 180 / Math.PI).toBeLessThan(0.001);
    expect(transformDirection(transformDirection(velocity, ab), ba).distanceTo(velocity)).toBeLessThan(1e-4);
    const inverse = ab.matrix.clone().invert();
    ba.matrix.elements.forEach((value, index) => expect(value).toBeCloseTo(inverse.elements[index]!, 10));
  });

  it('M02: 1000 seeded portal pose properties preserve metrics and invert exactly', () => {
    const random = randomGenerator(SEED);
    const coordinate = () => (random() - 0.5) * 200;
    const randomPose = (): PortalPose => pose(coordinate(), coordinate(), coordinate(), random() * Math.PI * 2);
    for (let index = 0; index < 1000; index += 1) {
      const a = randomPose();
      const b = randomPose();
      const point = new Vector3(coordinate(), coordinate(), coordinate());
      const secondPoint = new Vector3(coordinate(), coordinate(), coordinate());
      const velocity = new Vector3(coordinate(), coordinate(), coordinate());
      const orientation = new Quaternion().setFromEuler(new Euler(random(), random(), random()));
      const context = JSON.stringify({ seed: SEED, index, a, b, point, secondPoint, velocity, orientation });
      const ab = computePortalTransform(a, b);
      const ba = computePortalTransform(b, a);
      const mappedPoint = transformPosition(point, ab);
      const mappedVelocity = transformDirection(velocity, ab);
      expect(transformPosition(mappedPoint, ba).distanceTo(point), context).toBeLessThan(1e-4);
      expect(Math.abs(mappedPoint.distanceTo(transformPosition(secondPoint, ab)) - point.distanceTo(secondPoint)), context).toBeLessThan(1e-4);
      expect(Math.abs(mappedVelocity.length() / velocity.length() - 1), context).toBeLessThan(1e-4);
      expect(transformQuaternion(transformQuaternion(orientation, ab), ba).angleTo(orientation) * 180 / Math.PI, context).toBeLessThan(0.001);
      const inverse = ab.matrix.clone().invert();
      expect(Math.max(...ba.matrix.elements.map((value, i) => Math.abs(value - inverse.elements[i]!))), context).toBeLessThan(1e-9);
    }
  });

  it('M03: rotates velocity and input motion without applying translation or normalizing', () => {
    const transform = computePortalTransform(pose(), pose(40, 0, 0, Math.PI / 2));
    expect(transformDirection(new Vector3(0, -2, -3), transform).distanceTo(new Vector3(3, -2, 0))).toBeLessThan(1e-10);
    expect(transformDirection(new Vector3(), transform).length()).toBe(0);
    expect(transformDirection(new Vector3(1, 2, 3), transform).length()).toBeCloseTo(Math.sqrt(14), 12);
  });

  it('M04: finds the actual plane hit, time fraction and unconsumed displacement', () => {
    const portal = aperture();
    const start = new Vector3(0, 0.87, 1);
    const end = new Vector3(0.2, 0.87, -3);
    const crossing = intersectMovementWithPortal(start, end, portal, 0.3, 0.87);
    expect(crossing?.t).toBe(0.25);
    expect(crossing?.hitPoint.distanceTo(new Vector3(0.05, 0.87, 0))).toBeLessThan(1e-10);
    expect(crossing?.remainingDisplacement.distanceTo(new Vector3(0.15, 0, -3))).toBeLessThan(1e-10);
    expect(computeSignedPlaneDistance(start, portal)).toBe(1);
    expect(computeSignedPlaneDistance(end, portal)).toBe(-3);
    const rotated = aperture(pose(40, 1.45, 4, Math.PI / 2));
    const localToWorld = portalWorldMatrix(rotated);
    const rotatedStart = new Vector3(0, -0.58, 1).applyMatrix4(localToWorld);
    const rotatedEnd = new Vector3(0, -0.58, -1).applyMatrix4(localToWorld);
    expect(intersectMovementWithPortal(rotatedStart, rotatedEnd, rotated, 0.3, 0.87)?.t).toBeCloseTo(0.5, 10);
  });

  it('M05: rejects frame, head, floor and outside-aperture crossings', () => {
    const portal = aperture();
    const cross = (x: number, y: number) => intersectMovementWithPortal(new Vector3(x, y, 1), new Vector3(x, y, -1), portal, 0.3, 0.87);
    expect(cross(0.9001, 0.87)).toBeNull();
    expect(cross(-0.9001, 0.87)).toBeNull();
    expect(cross(0, 2.031)).toBeNull();
    expect(cross(0, 0.869)).toBeNull();
    expect(cross(0.9, 0.87)).not.toBeNull();
    expect(cross(0, 2.03)).not.toBeNull();
    expect(isPointInsideAperture(new Vector3(0, 1.45, 0), portal, 1.21, 0)).toBe(false);
  });

  it('M06: parallel, reverse, tangent and near-zero movement cannot cause a false crossing', () => {
    const portal = aperture();
    expect(intersectMovementWithPortal(new Vector3(0, 1, 1), new Vector3(0.1, 1, 1), portal)).toBeNull();
    expect(intersectMovementWithPortal(new Vector3(0, 1, -1), new Vector3(0, 1, 1), portal)).toBeNull();
    expect(intersectMovementWithPortal(new Vector3(0, 1, 0), new Vector3(0.1, 1, 0), portal)).toBeNull();
    expect(intersectMovementWithPortal(new Vector3(0, 1, 1e-12), new Vector3(0, 1, -1e-12), portal)).toBeNull();
    expect(intersectMovementWithPortal(new Vector3(0, 1, 1), new Vector3(0, 1, 0), portal)?.t).toBe(1);
  });

  it('M07: rejects malformed poses, matrices, vectors, dimensions and quaternions', () => {
    const invalidMatrices = [
      new Matrix4().makeScale(0, 0, 0),
      new Matrix4().makeScale(2, 1, 1),
      new Matrix4().makeScale(-1, 1, 1),
      new Matrix4().makeRotationX(0.2),
      new Matrix4().set(1, 0.2, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
      new Matrix4().set(1, 0, 0, NaN, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1),
      new Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.1, 0, 0, 1),
    ];
    invalidMatrices.forEach(matrix => expect(() => computePortalTransform(matrix, pose())).toThrow(RangeError));
    expect(() => computePortalTransform(pose(NaN), pose())).toThrow(RangeError);
    expect(() => computePortalTransform(pose(Infinity), pose())).toThrow(RangeError);
    expect(() => computePortalTransform({ ...pose(), rotation: new Quaternion(0, 0, 0, 0) }, pose())).toThrow(RangeError);
    expect(() => computePortalTransform({ ...pose(), rotation: new Quaternion(NaN, 0, 0, 1) }, pose())).toThrow(RangeError);
    expect(() => transformPosition(new Vector3(NaN, 0, 0), new Matrix4())).toThrow(RangeError);
    expect(() => transformDirection(new Vector3(0, Infinity, 0), new Matrix4())).toThrow(RangeError);
    expect(() => transformPosition(new Vector3(1e308, 0, 0), new Matrix4().makeTranslation(1e308, 0, 0))).toThrow(RangeError);
    expect(() => transformDirection(new Vector3(1.7e308, 0, 1.7e308), new Matrix4().makeRotationY(Math.PI / 4))).toThrow(RangeError);
    expect(() => transformQuaternion(new Quaternion(0, 0, 0, 3), new Quaternion())).toThrow(RangeError);
    expect(() => isPointInsideAperture(new Vector3(), { ...aperture(), width: -1 })).toThrow(RangeError);
    expect(() => intersectMovementWithPortal(new Vector3(), new Vector3(), aperture(), -1)).toThrow(RangeError);
  });

  it('keeps a consistent explicit bidirectional registry and rejects invalid topology', () => {
    const a = aperture();
    const b = { ...aperture(pose(40, 1.45, 0, Math.PI / 2)), id: 'B', worldId: 'ROOM_B' };
    const links = [
      { sourceId: 'A', destinationId: 'B', sourceWorldId: 'ROOM_A', destinationWorldId: 'ROOM_B' },
      { sourceId: 'B', destinationId: 'A', sourceWorldId: 'ROOM_B', destinationWorldId: 'ROOM_A' },
    ];
    const registry = new PortalRegistry([a, b], links);
    expect(registry.destination('A')).toBe(b);
    expect(registry.destination('B')).toBe(a);
    expect(registry.forWorld('ROOM_A')).toEqual([a]);
    expect(registry.transform('A').matrix.determinant()).toBeCloseTo(1, 12);
    expect(() => registry.get('missing')).toThrow('Unknown portal');
    expect(() => new PortalRegistry([a, a], links)).toThrow('duplicate');
    expect(() => new PortalRegistry([a, b], [{ ...links[0]!, sourceWorldId: 'ROOM_B' }])).toThrow('Invalid portal link');
  });
});
